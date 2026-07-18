import { DarkTheme, DefaultTheme, ThemeProvider, useNavigationState } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import 'react-native-reanimated';

import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import AuthLoadingScreen from '@/components/auth-loading-screen';
import { FirebaseErrorBoundary } from '@/components/FirebaseErrorBoundary';
import { GlobalErrorBoundary } from '@/components/GlobalErrorBoundary';
import AlertContainer from '@/components/ui/AlertContainer';
import { AlertProvider } from '@/contexts/AlertContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { CacheProvider } from '@/contexts/CacheContext';
import { ThemeProvider as AppThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { useThemeColor } from '@/hooks/use-theme-color';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import CallService from '@/utils/call-service';
import { getErrorLog, setupGlobalErrorHandlers } from '@/utils/global-error-handler';
import { disconnectSocket, initSocket, offVoiceCallEnd, offVoiceCallOffer, onVoiceCallEnd, onVoiceCallOffer } from '@/utils/socket';
import { supabase } from '@/utils/supabase';
import { checkAppVersion, useUpdateAlert, setUpdateAlertStateDirect } from '@/utils/app-version';
import { UpdateAvailableAlert } from '@/components/ui/UpdateAvailableAlert';
import AsyncStorage from '@react-native-async-storage/async-storage';

type TimeoutHandle = ReturnType<typeof setTimeout>;

function safeJsonStringify(value: unknown): string | undefined {
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function getNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

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
  const currentRouteName = useNavigationState((state) => state.routes[state.index]?.name);
  const updateAlert = useUpdateAlert();

  // Initialize push notifications
  const { 
    hasPermission, 
    token: pushToken, 
    error: pushError, 
    registerPushToken, 
    reRegisterOnLogin,
    setupNotificationChannels,
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

  type NotificationData = {
    type?: string;
    callId?: string;
    chatId?: string;
    userId?: string;
    postId?: string;
    caller?: {
      username?: string;
      profilePhoto?: string;
      [key: string]: unknown;
    };
    offer?: unknown;
  };

  useEffect(() => {
    let notificationResponseSubscription: any = null;
    let timer: TimeoutHandle;
    
    // Delay setting up notification listener until app is ready
    timer = setTimeout(() => {
      if (Notifications) {
        // Set up notification response listener
        notificationResponseSubscription = Notifications.addNotificationResponseReceivedListener((response: any) => {
          if (!isAppReadyRef.current) return;
          
          const data = response?.notification?.request?.content?.data as NotificationData | undefined;

          if (!data) return;

          const notificationType = data.type;

          switch (notificationType) {
            case 'incoming-call':
              if (!CallService.isCallActive(data.callId)) {
                return;
              }
              const caller = data.caller || {};
              router.push({
                pathname: '/chat/voice-call',
                params: {
                  chatId: data.chatId || '',
                  name: caller.username || 'User',
                  image: caller.profilePhoto,
                  offer: data.offer ? JSON.stringify(data.offer) : undefined,
                }
              });
              break;
            case 'message':
            case 'new-message':
              if (data.chatId) {
                router.push({
                  pathname: '/chat/[id]',
                  params: { id: data.chatId as string }
                });
              }
              break;
            case 'friend-request':
              if (data.userId) {
                router.push({
                  pathname: '/user/[id]',
                  params: { id: data.userId as string }
                });
              }
              break;
            case 'like':
            case 'post-like':
              if (data.postId) {
                router.push({
                  pathname: '/post/[id]',
                  params: { id: data.postId as string }
                });
              }
              break;
            case 'comment':
            case 'post-comment':
              if (data.postId) {
                router.push({
                  pathname: '/post/[id]',
                  params: { id: data.postId as string }
                });
              }
              break;
            case 'mention':
              if (data.postId) {
                router.push({
                  pathname: '/post/[id]',
                  params: { id: data.postId as string }
                });
              } else if (data.chatId) {
                router.push({
                  pathname: '/chat/[id]',
                  params: { id: data.chatId as string }
                });
              }
              break;
            case 'match':
              if (data.userId) {
                router.push({
                  pathname: '/user/[id]',
                  params: { id: data.userId as string }
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

        onVoiceCallEnd(() => {
          CallService.onEndCall({ callUUID: (CallService as any).currentCallId });
        });

        onVoiceCallOffer(({ offer, caller, chatId }) => {
        if (AppState.currentState === 'background' || AppState.currentState === 'inactive') {
          // Generate a random UUID for the call
          const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            let r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
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
      offVoiceCallEnd();
      disconnectSocket();
    };
  }, [isSignedIn, user?._id]);


  useEffect(() => {
    // Check Supabase session on app start
    const checkSupabaseSession = async () => {
      try {
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Session check timeout')), 5000)
        );

        const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]);
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

    // Mark app as ready after initial navigation
    isAppReadyRef.current = true;

    // Check for app updates once the app is ready (non-blocking; never
    // prevents the user from reaching the app on failure).
    checkAppVersion();

    // Force signed-in users to tabs regardless of notification state
    if (isSignedIn) {
      router.replace('/(tabs)');
      return;
    }

    // If there is a valid Supabase session (e.g. from a magic link / OAuth
    // callback), let the auth callback screen finish the flow. Do NOT send the
    // user back to login, otherwise the callback's redirect is overwritten.
    if (hasSupabaseSession) {
      if (currentRouteName !== '/auth/callback') {
        console.log('Supabase session present but not on callback - navigating to login');
        router.replace('/login');
      }
      return;
    }

    console.log('App navigation ready, not signed in');

    // Not signed in - go to login
    router.replace('/login');
  }, [isLoading, isCheckingSupabase, isSignedIn, hasSupabaseSession, router]);

  // Handle push notification registration on login
  useEffect(() => {
    // Detect when user logs in (transition from not signed in to signed in)
    if (prevSignedInRef.current === false && isSignedIn) {
      // User just logged in - register push notifications
      console.log('🔔 User logged in, registering push notifications...');
      setupNotificationChannels();
      reRegisterOnLogin();
    }
    
    // Update the ref for next comparison
    prevSignedInRef.current = isSignedIn;
    
    // Initial registration if already signed in
    if (isSignedIn && !prevSignedInRef.current) {
      console.log('🔔 Initial push notification registration...');
      setupNotificationChannels();
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
      <UpdateAvailableAlert
        visible={updateAlert.visible}
        forceUpdate={updateAlert.forceUpdate}
        currentVersion={updateAlert.currentVersion}
        newVersion={updateAlert.newVersion}
        releaseNotes={updateAlert.releaseNotes}
        storeUrl={updateAlert.storeUrl}
        onDismiss={() => setUpdateAlertStateDirect({ ...updateAlert, visible: false })}
      />
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
