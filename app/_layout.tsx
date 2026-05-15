import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppState } from 'react-native';

import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider as AppThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { CacheProvider } from '@/contexts/CacheContext';
import { AlertProvider } from '@/contexts/AlertContext';
import { FirebaseErrorBoundary } from '@/components/FirebaseErrorBoundary';
import { GlobalErrorBoundary } from '@/components/GlobalErrorBoundary';
import AlertContainer from '@/components/ui/AlertContainer';
import { initSocket, disconnectSocket, onVoiceCallOffer, offVoiceCallOffer } from '@/utils/socket';
import { setupGlobalErrorHandlers, getErrorLog } from '@/utils/global-error-handler';
import CallService from '@/utils/call-service';
import { useThemeColor } from '@/hooks/use-theme-color';
import AuthLoadingScreen from '@/components/auth-loading-screen';
import { supabase } from '@/utils/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePushNotifications } from '@/hooks/usePushNotifications';

// Conditionally import expo-notifications
let Notifications: any = null;
try {
  Notifications = require('expo-notifications');
} catch (e) {
  console.warn('expo-notifications not available, notifications will be disabled');
}

function RootLayoutNav() {
  const { isSignedIn, isLoading, user } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const primaryColor = useThemeColor('primary');
  const [hasSupabaseSession, setHasSupabaseSession] = useState(false);
  const [isCheckingSupabase, setIsCheckingSupabase] = useState(true);
  const isAppReadyRef = useRef(false);
  
  // Initialize push notifications
  const { 
    hasPermission, 
    token: pushToken, 
    error: pushError, 
    registerPushToken, 
    reRegisterOnLogin 
  } = usePushNotifications();
  
  // Track previous sign-in state for detecting login
  const prevSignedInRef = useRef<boolean | null>(null);

  const navigationTheme = useMemo(() => {
    const baseTheme = theme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        primary: primaryColor,
      },
    };
  }, [theme, primaryColor]);

  useEffect(() => {
    let notificationResponseSubscription: any = null;
    let timer: NodeJS.Timeout;
    
    // Delay setting up notification listener until app is ready
    timer = setTimeout(() => {
      if (Notifications) {
        // Set up notification response listener
notificationResponseSubscription = Notifications.addNotificationResponseReceivedListener((response: any) => {
          // Always check isSignedIn first - signed-in users go to tabs
          if (isSignedIn) {
            router.replace('/(tabs)');
            return;
          }
          
          if (!isAppReadyRef.current) return;
          
          const data = response.notification.request.content.data as any;
          
          switch (data.type) {
            case 'incoming-call':
              router.push({
                pathname: '/chat/voice-call',
                params: {
                  chatId: data.chatId,
                  name: data.caller?.username || 'User',
                  image: data.caller?.profilePhoto,
                  offer: data.offer ? JSON.stringify(data.offer) : undefined,
                }
              });
              break;
            case 'message':
            case 'new-message':
              if (data.chatId) {
                router.push({
                  pathname: '/chat/[id]',
                  params: { id: data.chatId }
                });
              }
              break;
            case 'friend-request':
              if (data.userId) {
                router.push({
                  pathname: '/user/[id]',
                  params: { id: data.userId }
                });
              }
              break;
            case 'like':
            case 'post-like':
              if (data.postId) {
                router.push({
                  pathname: '/post/[id]',
                  params: { id: data.postId }
                });
              }
              break;
            case 'comment':
            case 'post-comment':
              if (data.postId) {
                router.push({
                  pathname: '/post/[id]',
                  params: { id: data.postId }
                });
              }
              break;
            case 'mention':
              if (data.postId) {
                router.push({
                  pathname: '/post/[id]',
                  params: { id: data.postId }
                });
              } else if (data.chatId) {
                router.push({
                  pathname: '/chat/[id]',
                  params: { id: data.chatId }
                });
              }
              break;
            case 'match':
              if (data.userId) {
                router.push({
                  pathname: '/user/[id]',
                  params: { id: data.userId }
                });
              }
              break;
            case 'notification':
            default:
              router.push('/notifications');
              break;
          }
        });
      }
    }, 1000);

    // Socket initialization for voice calls
    if (isSignedIn && user?._id) {
      const socket = initSocket(user._id);

      onVoiceCallOffer(({ offer, caller, chatId }) => {
        if (AppState.currentState === 'background' || AppState.currentState === 'inactive') {
          // Generate a random UUID for the call
          const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });

          CallService.displayIncomingCall(uuid, caller.username, caller.username, chatId, caller, offer);
        } else {
          router.push({
            pathname: '/chat/incoming-call',
            params: {
              offer: JSON.stringify(offer),
              caller: JSON.stringify(caller),
              chatId: chatId,
            },
          });
        }
      });

    } else {
      disconnectSocket();
    }

    return () => {
      if (notificationResponseSubscription) {
        notificationResponseSubscription.remove();
      }
      if (timer) clearTimeout(timer);
      offVoiceCallOffer();
      disconnectSocket();
    };
  }, [isSignedIn, user?._id]);


  useEffect(() => {
    // Check Supabase session on app start
    const checkSupabaseSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setHasSupabaseSession(!!session);
        
        // If there's a Supabase session but no MongoDB token, check if profile is complete
        if (session) {
          const mongoToken = await AsyncStorage.getItem('authToken');
          if (!mongoToken) {
            // User has Supabase session but no MongoDB - needs to complete profile
            setHasSupabaseSession(true);
          }
        }
      } catch (error) {
        console.warn('Error checking Supabase session:', error);
      } finally {
        setIsCheckingSupabase(false);
      }
    };
    
    checkSupabaseSession();
  }, [router]);

  useEffect(() => {
    if (isLoading || isCheckingSupabase) return;

    // Force signed-in users to tabs regardless of notification state
    if (isSignedIn) {
      router.replace('/(tabs)');
      return;
    }
    
    // Mark app as ready after initial navigation
    isAppReadyRef.current = true;
    console.log('App navigation ready, not signed in');
    
    // Not signed in - go to login
    router.replace('/login');
  }, [isLoading, isCheckingSupabase, isSignedIn, router]);

  // Handle push notification registration on login
  useEffect(() => {
    // Detect when user logs in (transition from not signed in to signed in)
    if (prevSignedInRef.current === false && isSignedIn) {
      // User just logged in - register push notifications
      console.log('🔔 User logged in, registering push notifications...');
      reRegisterOnLogin();
    }
    
    // Update the ref for next comparison
    prevSignedInRef.current = isSignedIn;
    
    // Initial registration if already signed in
    if (isSignedIn && !prevSignedInRef.current) {
      console.log('🔔 Initial push notification registration...');
      registerPushToken();
    }
  }, [isSignedIn, registerPushToken, reRegisterOnLogin]);

  // Log push notification errors for debugging
  useEffect(() => {
    if (pushError) {
      console.warn('⚠️ Push notification error:', pushError);
    }
    if (pushToken) {
      console.log('✅ Push token registered:', pushToken.substring(0, 20) + '...');
    }
  }, [pushError, pushToken]);

  if (isLoading || isCheckingSupabase) {
    return <AuthLoadingScreen />;
  }

  return (
    <ThemeProvider value={navigationTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="signup" options={{ headerShown: false }} />
        <Stack.Screen name="complete-profile" options={{ headerShown: false }} />
        <Stack.Screen name="reset-password" options={{ headerShown: false }} />
        <Stack.Screen name="verify-email" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        <Stack.Screen name="muted-users" options={{ title: 'Muted Users' }} />
        <Stack.Screen name="privacy-settings" options={{ title: 'Privacy' }} />
        <Stack.Screen name="blocked-users" options={{ title: 'Blocked Users' }} />
        <Stack.Screen name="notifications" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="help" options={{ title: 'Help & Support' }} />
        <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="chat/favorites" options={{ headerShown: false }} />
        <Stack.Screen name="community/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="chat/incoming-call" options={{ headerShown: false }} />
        <Stack.Screen name="chat/voice-call" options={{ headerShown: false }} />
        <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  // Set up global error handlers once on app start
  const [errorHandlersReady, setErrorHandlersReady] = useState(false);
  
  useEffect(() => {
    // Initialize global error handlers
    setupGlobalErrorHandlers();
    setErrorHandlersReady(true);
    
    // Log any previous errors on startup
    const previousErrors = getErrorLog();
    if (previousErrors.length > 0) {
      console.log('Previous errors found:', previousErrors.length);
    }
  }, []);
  
  return (
    <GlobalErrorBoundary>
      <FirebaseErrorBoundary>
        <AuthProvider>
          <CacheProvider>
            <AppThemeProvider>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <AlertProvider>
                  <RootLayoutNav />
                  <AlertContainer />
                </AlertProvider>
              </GestureHandlerRootView>
            </AppThemeProvider>
          </CacheProvider>
        </AuthProvider>
      </FirebaseErrorBoundary>
    </GlobalErrorBoundary>
  );
}
