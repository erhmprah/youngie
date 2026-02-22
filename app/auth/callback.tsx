// app/auth/callback.tsx
// This page handles the OAuth callback from Supabase
// It parses the URL parameters and exchanges the auth code for a session

import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Alert, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { supabase, handleOAuthCallback } from '@/utils/supabase';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

// Make sure WebBrowser completes the session on web
WebBrowser.maybeCompleteAuthSession();

export default function AuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const backgroundColor = useThemeColor('background');
  const textColor = useThemeColor('text');

  useEffect(() => {
    let isMounted = true;

    const processCallback = async () => {
      try {
        console.log('Processing auth callback...');

        // First, check if we already have a session (from the deep link handler in login.tsx)
        const { data: { session } } = await supabase.auth.getSession();
        if (session && isMounted) {
          console.log('Session already established');
          setStatus('success');
          
          // Get user data and navigate to signup
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.email) {
            router.replace({
              pathname: '/signup',
              params: {
                email: user.email,
                name: user.user_metadata?.full_name || user.user_metadata?.name || '',
                photo: user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
              },
            });
          } else {
            router.replace('/(tabs)');
          }
          return;
        }

        // Get the initial URL from Linking
        const initialUrl = await Linking.getInitialURL();
        console.log('Initial URL from Linking:', initialUrl);

        if (!initialUrl && isMounted) {
          // No URL and no session - wait for auth state change
          console.log('No initial URL and no session - waiting for auth state change');
          return;
        }

        console.log('Processing callback URL:', initialUrl);

        // Handle the OAuth callback
        const newSession = await handleOAuthCallback(initialUrl!);
        
        if (newSession && isMounted) {
          setStatus('success');
          
          // Get user data and navigate to signup
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.email) {
            router.replace({
              pathname: '/signup',
              params: {
                email: user.email,
                name: user.user_metadata?.full_name || user.user_metadata?.name || '',
                photo: user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
              },
            });
          } else {
            router.replace('/(tabs)');
          }
        }
      } catch (error: any) {
        console.error('Auth callback error:', error);
        
        // Check if we have a session despite the error
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session && isMounted) {
            console.log('Session exists despite error');
            setStatus('success');
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.email) {
              router.replace({
                pathname: '/signup',
                params: {
                  email: user.email,
                  name: user.user_metadata?.full_name || user.user_metadata?.name || '',
                  photo: user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
                },
              });
            } else {
              router.replace('/(tabs)');
            }
            return;
          }
        } catch (e) {
          // Ignore
        }
        
        if (isMounted) {
          setStatus('error');
          Alert.alert(
            'Authentication Error',
            error.message || 'Failed to complete authentication. Please try again.',
            [
              {
                text: 'OK',
                onPress: () => router.replace('/login'),
              },
            ]
          );
        }
      }
    };

    // Listen for auth state changes as a fallback
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session && isMounted) {
        console.log('Session established via auth state change');
        setStatus('success');
        
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          router.replace({
            pathname: '/signup',
            params: {
              email: user.email,
              name: user.user_metadata?.full_name || user.user_metadata?.name || '',
              photo: user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
            },
          });
        } else {
          router.replace('/(tabs)');
        }
      }
    });

    processCallback();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <ActivityIndicator size="large" color="#007AFF" />
      <ThemedText style={[styles.text, { color: textColor }]}>
        {status === 'processing' && 'Completing authentication...'}
        {status === 'success' && 'Authentication successful! Redirecting...'}
        {status === 'error' && 'Authentication failed. Please try again.'}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
});
