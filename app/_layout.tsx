import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect, useMemo, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppState } from 'react-native';

import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider as AppThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { CacheProvider } from '@/contexts/CacheContext';
import { FirebaseErrorBoundary } from '@/components/FirebaseErrorBoundary';
import { GlobalErrorBoundary } from '@/components/GlobalErrorBoundary';
import { initSocket, disconnectSocket, onVoiceCallOffer, offVoiceCallOffer } from '@/utils/socket';
import { setupGlobalErrorHandlers, getErrorLog } from '@/utils/global-error-handler';
import CallService from '@/utils/call-service';
import { useThemeColor } from '@/hooks/use-theme-color';
import AuthLoadingScreen from '@/components/auth-loading-screen';

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
        if (data.type === 'incoming-call') {
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
    if (isLoading) return;

    if (isSignedIn) {
      router.replace('/(tabs)');
    } else {
      router.replace('/login');
    }
  }, [isLoading, isSignedIn, user, router]);

  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  return (
    <ThemeProvider value={navigationTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="signup" options={{ headerShown: false }} />
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
                <RootLayoutNav />
              </GestureHandlerRootView>
            </AppThemeProvider>
          </CacheProvider>
        </AuthProvider>
      </FirebaseErrorBoundary>
    </GlobalErrorBoundary>
  );
}
