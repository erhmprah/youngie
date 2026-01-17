import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppState } from 'react-native';

import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { initSocket, disconnectSocket, onVoiceCallOffer, offVoiceCallOffer } from '@/utils/socket';
import CallService from '@/utils/call-service';

// Conditionally import expo-notifications
let Notifications: any = null;
try {
  Notifications = require('expo-notifications');
} catch (e) {
  console.warn('expo-notifications not available, notifications will be disabled');
}

function RootLayoutNav() {
  const { isSignedIn, isLoading, restoreToken, user } = useAuth();
  const [isRestoring, setIsRestoring] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let notificationResponseSubscription: any = null;
    if (Notifications) {
      // Set up notification response listener
      notificationResponseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
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
    const restore = async () => {
      try {
        await restoreToken();
      } catch (error) {
        console.error('Failed to restore token:', error);
      } finally {
        setIsRestoring(false);
      }
    };
    restore();
  }, []);

  useEffect(() => {
    if (isRestoring || isLoading) return;

    if (isSignedIn) {
      router.replace('/(tabs)');
    } else {
      router.replace('/login');
    }
  }, [isRestoring, isLoading, isSignedIn, user, router]);

  if (isRestoring || isLoading) {
    return null; // Or a proper splash screen
  }

  return (
    <ThemeProvider value={DarkTheme}>
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
        <Stack.Screen name="help" options={{ title: 'Help & Support' }} />
        <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="community/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="chat/incoming-call" options={{ headerShown: false }} />
        <Stack.Screen name="chat/voice-call" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="light" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <RootLayoutNav />
      </GestureHandlerRootView>
    </AuthProvider>
  );
}
