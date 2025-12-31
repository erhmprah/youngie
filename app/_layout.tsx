import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { initSocket, disconnectSocket } from '@/utils/socket';

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { isSignedIn, isLoading, restoreToken, user } = useAuth();
  const [isRestoring, setIsRestoring] = useState(true);

  useEffect(() => {
    if (isSignedIn && user?._id) {
      initSocket(user._id);
    } else {
      disconnectSocket();
    }

    return () => {
      disconnectSocket();
    };
  }, [isSignedIn, user?._id]);

  useEffect(() => {
    const restore = async () => {
      console.log('Starting token restoration...');
      try {
        await restoreToken();
        console.log('Token restoration completed');
      } catch (error) {
        console.error('Failed to restore token:', error);
      } finally {
        setIsRestoring(false);
        console.log('isRestoring set to false');
      }
    };
    restore();
  }, []);

  console.log('isRestoring:', isRestoring, 'isLoading:', isLoading, 'isSignedIn:', isSignedIn);

  if (isRestoring || isLoading) {
    console.log('Showing null (loading screen)');
    return null; // Or show a splash screen
  }

  const initialRoute = isSignedIn ? "(tabs)" : "login";
  console.log('Initial route:', initialRoute);

  return (
    <ThemeProvider value={DarkTheme}>
      <Stack initialRouteName={initialRoute}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="signup" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="community/[id]" options={{ headerShown: false }} />
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
