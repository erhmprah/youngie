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
    if (Notifications) {
      // Set up notification response listener
      notificationResponseSubscription = Notifications.addNotificationResponseReceivedListener((response: any) => {
        const data = response.notification.request.content.data as any;
        
        // Handle different notification types
        switch (data.type) {
          case 'incoming-call':
            // Handle incoming call notification tap
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
            // Navigate to chat
            if (data.chatId) {
              router.push({
                pathname: '/chat/[id]',
                params: { id: data.chatId }
              });
            }
            break;
            
          case 'friend-request':
            // Navigate to profile of requester
            if (data.userId) {
              router.push({
                pathname: '/user/[id]',
                params: { id: data.userId }
              });
            }
            break;
            
          case 'like':
          case 'post-like':
            // Navigate to post
            if (data.postId) {
              router.push({
                pathname: '/post/[id]',
                params: { id: data.postId }
              });
            }
            break;
            
          case 'comment':
          case 'post-comment':
            // Navigate to post with focus on comments
            if (data.postId) {
              router.push({
                pathname: '/post/[id]',
                params: { id: data.postId }
              });
            }
            break;
            
          case 'mention':
            // Navigate to post or chat depending on context
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
            // Navigate to user profile who matched
            if (data.userId) {
              router.push({
                pathname: '/user/[id]',
                params: { id: data.userId }
              });
            }
            break;
            
          case 'notification':
          default:
            // Navigate to notifications screen
            router.push('/notifications');
            break;
        }
      });
    }

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

    // If user is signed in with MongoDB, go to main app
    if (isSignedIn) {
      router.replace('/(tabs)');
    } else {
      // Not signed in with MongoDB - go to login
      // The login screen will handle checking if user has Supabase session
      router.replace('/login');
    }
  }, [isLoading, isCheckingSupabase, isSignedIn, user, router]);

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
