import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { initSocket, disconnectSocket, onVoiceCallOffer, offVoiceCallOffer } from '@/utils/socket';

function RootLayoutNav() {
  const { isSignedIn, isLoading, restoreToken, user } = useAuth();
  const [isRestoring, setIsRestoring] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (isSignedIn && user?._id) {
      const socket = initSocket(user._id);
      
      onVoiceCallOffer(({ offer, caller, chatId }) => {
        router.push({
          pathname: '/chat/incoming-call',
          params: {
            offer: JSON.stringify(offer),
            caller: JSON.stringify(caller),
            chatId: chatId,
          },
        });
      });

    } else {
      disconnectSocket();
    }

    return () => {
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
