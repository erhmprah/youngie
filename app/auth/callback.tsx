// app/auth/callback.tsx
// This page handles the OAuth callback from Supabase and magic link clicks
// It parses the URL parameters and exchanges the auth code for a session

import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Alert, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { supabase, handleOAuthCallback } from '@/utils/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '@/utils/api';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/contexts/AuthContext';

// Make sure WebBrowser completes the session on web
WebBrowser.maybeCompleteAuthSession();

export default function AuthCallback() {
  const router = useRouter();
  const { updateUser } = useAuth();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const backgroundColor = useThemeColor('background');
  const textColor = useThemeColor('text');

  useEffect(() => {
    let isMounted = true;
    let hasNavigated = false;

    // Resolve once a session has been established (by magic link / OAuth). The
    // processCallback promise waits on this so a redirect to /login doesn't win
    // the race against Supabase's asynchronous session detection.
    let resolveSession: ((session: any) => void) | null = null;
    const sessionReady = new Promise<any>((resolve) => {
      resolveSession = resolve;
    });

    // Listen for the magic-link URL being opened while the app is already running
    // (warm start). On cold start the URL is delivered via Linking.getInitialURL().
    const onDeepLink = (event: { url: string }) => {
      console.log('Deep link received while running:', event.url);
      // Supabase's detectSessionInUrl will pick up the params from the URL and
      // establish the session automatically; nothing else to do here.
    };
    const linkingSubscription = Linking.addEventListener('url', onDeepLink);

    const navigateToNextScreen = async (session: any) => {
      if (hasNavigated) return;
      hasNavigated = true;
      
      console.log('navigateToNextScreen called');
      
      try {
        // Use timeout to avoid hanging on getUser
        const userPromise = supabase.auth.getUser();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('getUser timeout')), 5000)
        );
        
        let user: any = null;
        try {
          const result = await Promise.race([userPromise, timeoutPromise]) as any;
          user = result?.data?.user;
        } catch (e) {
          console.log('getUser timed out or failed, proceeding without user data');
        }
        
        if (!user?.email) {
          await AsyncStorage.setItem('pendingProfileCompletion', 'true');
          router.replace('/complete-profile');
          return;
        }
        
        // Check with backend if profile is already completed
        try {
          const supabaseToken = session.access_token;
          const response = await authAPI.supabaseLogin(supabaseToken);
          
          if (response.data?.needsProfileCompletion === false && response.data?.token) {
            // Profile is complete - store tokens and go to tabs
            await AsyncStorage.setItem('authToken', response.data.token);
            await AsyncStorage.setItem('sessionId', response.data.sessionId);
            await AsyncStorage.setItem('profileCompleted', 'true');
            await AsyncStorage.setItem('supabaseUserId', user.id);
            await AsyncStorage.setItem('userEmail', user.email);
            
            // Update AuthContext with user data if available
            if (response.data?.user) {
              updateUser(response.data.user);
            }
            
            router.replace('/(tabs)');
            return;
          } else if (response.data?.needsProfileCompletion === true) {
            // Profile not complete - go to complete profile
            await AsyncStorage.setItem('supabaseUserId', response.data.supabaseUserId);
            await AsyncStorage.setItem('userEmail', response.data.email);
            await AsyncStorage.setItem('pendingProfileCompletion', 'true');
            router.replace('/complete-profile');
            return;
          }
        } catch (apiError: any) {
          console.error('Supabase login API failed:', apiError?.message || apiError);
          // On connection/API error, do NOT navigate — stay on this screen and show error
          setStatus('error');
          return;
        }
      } catch (error: any) {
        console.error('Error in navigateToNextScreen:', error?.message || error);
        setStatus('error');
      }
    };

    const processCallback = async () => {
      try {
        console.log('Processing auth callback...');

        // First, check if we already have a session
        const { data: { session } } = await supabase.auth.getSession();
        if (session && isMounted) {
          console.log('Session already established - navigating directly');
          setStatus('success');
          // Use setTimeout to ensure navigation happens in next tick
          setTimeout(() => navigateToNextScreen(session), 100);
          return;
        }

        // If no session yet, wait briefly for Supabase to process the URL (magic link)
        // as it may take a moment to establish the session from URL params
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check again after waiting
        if (isMounted) {
          const { data: { session: delayedSession } } = await supabase.auth.getSession();
          if (delayedSession) {
            console.log('Session established after delay - navigating');
            setStatus('success');
            setTimeout(() => navigateToNextScreen(delayedSession), 100);
            return;
          }
        }

        // Get the initial URL from Linking
        let initialUrl = await Linking.getInitialURL();
        console.log('Initial URL from Linking:', initialUrl);
        
        // Log all available URL parameters for debugging
        if (initialUrl) {
          try {
            // Handle hash-based tokens (Supabase sometimes uses hash)
            let urlToParse = initialUrl;
            if (initialUrl.includes('#')) {
              const hashPart = initialUrl.split('#')[1];
              urlToParse = '?' + hashPart.replace(/&/g, '&');
            }
            
            const urlObj = new URL(urlToParse);
            console.log('URL params:', Object.fromEntries(urlObj.searchParams));
            console.log('URL hash:', initialUrl.split('#')[1] || 'none');
            
            // Check for Supabase token in URL (magic link flow)
            const token = urlObj.searchParams.get('token') || 
                          urlObj.searchParams.get('access_token') || 
                          urlObj.searchParams.get('accessToken');
            const refreshToken = urlObj.searchParams.get('refresh_token') || 
                                 urlObj.searchParams.get('refreshToken');
            const type = urlObj.searchParams.get('type');
            console.log('Token found:', !!token, 'type:', type, 'refreshToken:', !!refreshToken);
            
            // If token exists, manually set the session
            if (token) {
              console.log('Setting session with token...');
              const { error: setSessionError } = await supabase.auth.setSession({
                access_token: token,
                refresh_token: refreshToken || '',
              });
              
              if (setSessionError) {
                console.log('setSession error:', setSessionError.message);
              } else {
                // Check if session was set successfully
                const { data: { session: newSession } } = await supabase.auth.getSession();
                if (newSession && isMounted) {
                  console.log('Session set successfully');
                  setStatus('success');
                  setTimeout(() => navigateToNextScreen(newSession), 100);
                  return;
                }
              }
            }
          } catch (e) {
            console.log('Failed to parse URL:', e);
          }
        }
        
        // After trying to parse URL, always check if session was created automatically
        // (Supabase may have stored session from magic link click)
        if (isMounted) {
          const { data: { session: autoSession } } = await supabase.auth.getSession();
          if (autoSession) {
            console.log('Session found after URL parsing - navigating');
            setStatus('success');
            setTimeout(() => navigateToNextScreen(autoSession), 100);
            return;
          }
        }

        // Handle development client URLs
        if (initialUrl && initialUrl.includes('expo-development-client')) {
          try {
            const urlParams = new URLSearchParams(initialUrl.split('?')[1]);
            const encodedUrl = urlParams.get('url');
            if (encodedUrl) {
              initialUrl = decodeURIComponent(encodedUrl);
              console.log('Extracted URL from dev client:', initialUrl);
              
              // Now check if the extracted URL contains auth parameters
              const extractedUrlObj = new URL(initialUrl);
              const extractedToken = extractedUrlObj.searchParams.get('token') || 
                                     extractedUrlObj.searchParams.get('access_token');
              const extractedRefreshToken = extractedUrlObj.searchParams.get('refresh_token') || 
                                            extractedUrlObj.searchParams.get('refreshToken');
              console.log('Extracted URL params:', Object.fromEntries(extractedUrlObj.searchParams));
              console.log('Extracted token found:', !!extractedToken);
              
              // If extracted URL has token, set session
              if (extractedToken) {
                console.log('Setting session from extracted token...');
                const { error: setSessionError } = await supabase.auth.setSession({
                  access_token: extractedToken,
                  refresh_token: extractedRefreshToken || '',
                });
                
                if (setSessionError) {
                  console.log('setSession error:', setSessionError.message);
                } else {
                  // Get the session after setting it
                  const { data: { session: extractedSession } } = await supabase.auth.getSession();
                  if (extractedSession && isMounted) {
                    console.log('Session set from extracted token successfully');
                    setStatus('success');
                    setTimeout(() => navigateToNextScreen(extractedSession), 100);
                    return;
                  }
                }
              }
            }
          } catch (e) {
            console.log('Failed to parse dev client URL');
          }
        }

        // If URL is dev server URL, check for session
        if (initialUrl && (initialUrl.includes('172.20.10.2') || initialUrl.includes('localhost') || initialUrl.includes('expo-development-client'))) {
          const { data: { session: postCallbackSession } } = await supabase.auth.getSession();
          if (postCallbackSession && isMounted) {
            console.log('Session exists, navigating to next screen');
            setStatus('success');
            setTimeout(() => navigateToNextScreen(postCallbackSession), 100);
            return;
          }
        }

        // Give Supabase's asynchronous session detection (detectSessionInUrl)
        // one last chance to establish the session before giving up. This
        // avoids redirecting to /login while the magic-link session is still
        // being created.
        const settledSession = await Promise.race([
          sessionReady,
          new Promise<any>((resolve) => setTimeout(() => resolve(undefined), 4000)),
        ]);

        if (settledSession) {
          console.log('Session established via deferred auth state change');
          setStatus('success');
          setTimeout(() => navigateToNextScreen(settledSession), 100);
          return;
        }

        console.log('No valid auth URL and no session - redirecting to login');
        router.replace('/login');
      } catch (error: any) {
        console.error('Auth callback error:', error);
        if (isMounted) {
          setStatus('error');
          router.replace('/login');
        }
      }
    };

    // Listen for auth state changes. Supabase fires SIGNED_IN (and, for magic
    // links, often TOKEN_REFRESHED/INITIAL_SESSION) once it has processed the
    // URL and established the session.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change in callback:', event);
      if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')) {
        if (resolveSession) resolveSession(session);
      }
      if (session && event === 'SIGNED_IN' && isMounted && !hasNavigated) {
        console.log('Session established via auth state change');
        setStatus('success');
        setTimeout(() => navigateToNextScreen(session), 100);
      }
    });

    processCallback();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      linkingSubscription.remove();
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
