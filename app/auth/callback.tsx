// app/auth/callback.tsx
// This page handles the OAuth callback from Supabase and magic link clicks
// It parses the URL parameters and exchanges the auth code for a session

import React, { useEffect, useState } from 'react';
import {
  View,
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase, handleOAuthCallback } from '@/utils/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '@/utils/api';
import { getClientLocation, getDeviceName } from '@/utils/deviceInfo';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { typography } from '@/constants/design-tokens';
import { useAuth } from '@/contexts/AuthContext';

// Make sure WebBrowser completes the session on web
WebBrowser.maybeCompleteAuthSession();

const BRAND = '#FF009D';
const SUCCESS = '#34C759';
const DANGER = '#FF4D4D';

const STEPS = [
  { label: 'Verifying your secure link' },
  { label: 'Signing you in' },
  { label: 'Preparing your space' },
];

export default function AuthCallback() {
  const router = useRouter();
  const { updateUser } = useAuth();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [stepIndex, setStepIndex] = useState(0);

  const [spin] = useState(() => new Animated.Value(0));
  const [pulse] = useState(() => new Animated.Value(0));
  const [badge] = useState(() => new Animated.Value(0));
  const [progress] = useState(() => new Animated.Value(0));

  // Ambient rotation for the progress ring while we work.
  useEffect(() => {
    if (status !== 'processing') return;

    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1100,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    loop.start();
    return () => loop.stop();
  }, [spin, status]);

  // Slow breathing glow behind the badge.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [pulse]);

  // Badge entrance: scales up on mount, pops again on success.
  useEffect(() => {
    Animated.spring(badge, {
      toValue: 1,
      friction: 6,
      tension: 70,
      useNativeDriver: true,
    }).start();
  }, [badge]);

  useEffect(() => {
    if (status !== 'success') return;

    Animated.sequence([
      Animated.timing(badge, {
        toValue: 1.14,
        duration: 180,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.spring(badge, {
        toValue: 1,
        friction: 5,
        tension: 90,
        useNativeDriver: true,
      }),
    ]).start();
  }, [badge, status]);

  // Indeterminate progress bar while processing.
  useEffect(() => {
    if (status !== 'processing') {
      Animated.timing(progress, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }).start();
      return;
    }

    progress.setValue(0);

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: 0,
          useNativeDriver: false,
        }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [progress, status]);

  // Walk the checklist forward while the callback resolves.
  useEffect(() => {
    if (status !== 'processing') return;

    const timer = setInterval(() => {
      setStepIndex((current) => (current < STEPS.length - 1 ? current + 1 : current));
    }, 900);

    return () => clearInterval(timer);
  }, [status]);

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
          const [deviceName, clientLocation] = await Promise.all([
            getDeviceName(),
            getClientLocation(),
          ]);
          const response = await authAPI.supabaseLogin(supabaseToken, deviceName, clientLocation);

          if (response.status === 403) {
            setStatus('error');
            return;
          }

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

  const accent = status === 'success' ? SUCCESS : status === 'error' ? DANGER : BRAND;

  const ringSpin = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const glowScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1.25],
  });

  const glowOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.18, 0.5],
  });

  const barWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['6%', '100%'],
  });

  const badgeScale = badge.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 1],
  });

  const copy = {
    processing: {
      title: 'Signing you in',
      subtitle: 'Hold tight while we securely finish setting up your account.',
      badgeIcon: 'lock' as const,
    },
    success: {
      title: 'You’re signed in!',
      subtitle: 'Authentication successful. Taking you to your feed…',
      badgeIcon: 'checkmark' as const,
    },
    error: {
      title: 'Something went wrong',
      subtitle: 'We couldn’t complete your sign-in. Please try again.',
      badgeIcon: 'alert' as const,
    },
  }[status];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />

      <LinearGradient
        colors={['#150221', '#120018', '#0A000E']}
        locations={[0, 0.5, 1]}
        style={styles.container}
      >
        <View style={styles.glowTop} pointerEvents="none">
          <LinearGradient
            colors={[`${accent}33`, '#00000000']}
            style={styles.glowBlob}
          />
        </View>

        <View style={styles.brandRow}>
          <Image
            source={require('@/assets/images/youngie_icon.png')}
            style={styles.brandIcon}
            resizeMode="contain"
          />
          <ThemedText style={styles.brandName}>youngie</ThemedText>
        </View>

        <View style={styles.progressTrack}>
          <Animated.View
            style={[styles.progressBar, { width: barWidth, backgroundColor: accent }]}
          />
        </View>

        <View style={styles.content}>
          <Animated.View style={[styles.glow, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]} />

          <Animated.View style={[styles.badge, { transform: [{ scale: badgeScale }] }]}>
            {status === 'processing' && (
              <Animated.View
                style={[styles.ring, { borderTopColor: accent, transform: [{ rotate: ringSpin }] }]}
              />
            )}

            {status === 'success' && (
              <LinearGradient
                colors={[SUCCESS, '#1FBF63']}
                style={styles.badgeFill}
              />
            )}

            {status === 'error' && (
              <LinearGradient
                colors={[DANGER, '#C32B2B']}
                style={styles.badgeFill}
              />
            )}

            <IconSymbol
              name={copy.badgeIcon}
              size={46}
              color={status === 'processing' ? accent : '#FFFFFF'}
            />
          </Animated.View>

          <LinearGradient
            colors={['#FF009D', '#FF009D00']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.accentBar}
          />

          <ThemedText style={styles.title}>{copy.title}</ThemedText>
          <ThemedText style={styles.subtitle}>{copy.subtitle}</ThemedText>

          <View style={styles.stepsCard}>
            <View style={styles.stepsHeader}>
              <ThemedText style={styles.stepsEyebrow}>
                {status === 'success' ? 'All set' : 'SECURE SIGN-IN'}
              </ThemedText>
              <ThemedText style={[styles.stepsCounter, { color: accent }]}>
                {status === 'success'
                  ? `${STEPS.length}/${STEPS.length}`
                  : `${Math.min(stepIndex + 1, STEPS.length)}/${STEPS.length}`}
              </ThemedText>
            </View>

            {STEPS.map((step, index) => {
              const done = status === 'success' || index < stepIndex;
              const active = status === 'processing' && index === stepIndex;

              return (
                <View key={step.label} style={styles.stepRow}>
                  <View
                    style={[
                      styles.stepDot,
                      done && { backgroundColor: SUCCESS, borderColor: SUCCESS },
                      active && { borderColor: accent },
                    ]}
                  >
                    {done ? (
                      <IconSymbol name="checkmark" size={12} color="#FFFFFF" />
                    ) : active ? (
                      <View style={[styles.stepDotInner, { backgroundColor: accent }]} />
                    ) : null}
                  </View>

                  <ThemedText
                    style={[
                      styles.stepLabel,
                      done && styles.stepLabelDone,
                      active && { color: '#FFFFFF' },
                    ]}
                  >
                    {step.label}
                  </ThemedText>

                  {active && <ActivityIndicator size="small" color={accent} />}
                </View>
              );
            })}
          </View>

          {status === 'error' && (
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => router.replace('/login')}
              activeOpacity={0.85}
            >
              <IconSymbol name="arrow.uturn.backward" size={18} color="#FFFFFF" />
              <ThemedText style={styles.retryButtonText}>Back to sign in</ThemedText>
            </TouchableOpacity>
          )}

          {status !== 'error' && (
            <View style={styles.trustRow}>
              <IconSymbol name="shield-check" size={15} color="#8E7E92" />
              <ThemedText style={styles.trustText}>
                Encrypted connection · Your data stays private
              </ThemedText>
            </View>
          )}
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0A000E',
  },

  container: {
    flex: 1,
    backgroundColor: '#0A000E',
  },

  glowTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 380,
    alignItems: 'center',
    overflow: 'hidden',
  },

  glowBlob: {
    width: 420,
    height: 420,
    borderRadius: 210,
  },

  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 26,
    paddingTop: 18,
  },

  brandIcon: {
    width: 32,
    height: 32,
  },

  brandName: {
    color: BRAND,
    fontFamily: typography.families.bold,
    fontSize: 22,
    letterSpacing: -0.2,
  },

  progressTrack: {
    height: 3,
    marginHorizontal: 26,
    marginTop: 18,
    borderRadius: 2,
    backgroundColor: '#FFFFFF14',
    overflow: 'hidden',
  },

  progressBar: {
    height: '100%',
    borderRadius: 2,
  },

  content: {
    flex: 1,    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 26,
    paddingBottom: 40,
    gap: 12,
  },

  glow: {
    position: 'absolute',
    top: '18%',
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: BRAND,
    opacity: 0.2,
  },

  badge: {
    width: 116,
    height: 116,
    borderRadius: 58,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1B0722',
    borderWidth: 1,
    borderColor: '#FFFFFF1F',
    overflow: 'hidden',
    marginBottom: 14,
  },

  ring: {
    position: 'absolute',
    width: 116,
    height: 116,
    borderRadius: 58,
    borderWidth: 3,
    borderColor: '#FFFFFF14',
    borderTopColor: BRAND,
    borderRightColor: `${BRAND}66`,
  },

  badgeFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  accentBar: {
    width: 78,
    height: 3,
    borderRadius: 2,
    marginBottom: 6,
  },

  title: {
    color: '#FFFFFF',
    fontFamily: typography.families.bold,
    fontSize: 28,
    letterSpacing: -0.8,
    textAlign: 'center',
  },

  subtitle: {
    color: '#B7A9BC',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 300,
  },

  stepsCard: {
    alignSelf: 'stretch',
    marginTop: 22,
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#FFFFFF14',
    backgroundColor: '#1A0620CC',
    gap: 14,
  },

  stepsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },

  stepsEyebrow: {
    color: '#8E7E92',
    fontSize: 11,
    letterSpacing: 1.4,
    fontFamily: typography.families.bold,
  },

  stepsCounter: {
    fontSize: 12,
    fontFamily: typography.families.bold,
  },

  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#FFFFFF26',
    alignItems: 'center',
    justifyContent: 'center',
  },

  stepDotInner: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },

  stepLabel: {
    flex: 1,
    color: '#9C8FA2',
    fontSize: 15,
  },

  stepLabelDone: {
    color: '#D9CEDC',
  },

  retryButton: {
    marginTop: 24,
    height: 54,
    alignSelf: 'stretch',
    borderRadius: 27,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: BRAND,
  },

  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: typography.families.bold,
  },

  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 26,
  },

  trustText: {
    color: '#8E7E92',
    fontSize: 12,
  },
});
