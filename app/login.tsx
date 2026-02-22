// app/login.tsx

import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, TextInput, ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeColor } from '@/hooks/use-theme-color';
import { spacing, borderRadius, typography, shadows } from '@/constants/design-tokens';
import { IconSymbol } from '@/components/ui/icon-symbol';
import GoogleSignInButton from '@/components/google-signin-button';
import { signInWithGoogle, getSession, handleOAuthCallback, supabase } from '@/utils/supabase';


export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const router = useRouter();
  const { login, isLoading } = useAuth();

  const backgroundColor = useThemeColor('background');
  const primaryColor = useThemeColor('primary');
  const textColor = useThemeColor('text');
  const lightTextColor = useThemeColor('lightText');
  const inputBackgroundColor = useThemeColor('inputBackground');
  const inputBorderColor = useThemeColor('inputBorder');
  const white = useThemeColor('white');

  // Listen for deep links to handle OAuth callback
  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      const { url } = event;
      console.log('Deep link received:', url);
      
      // Handle custom callback URL scheme (youngie://auth/callback)
      if (url.includes('youngie://auth/callback') || url.includes('auth/callback')) {
        try {
          const session = await handleOAuthCallback(url);
          if (session) {
            // Get user data and navigate to signup with pre-filled data
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.email) {
              router.push({
                pathname: '/signup',
                params: {
                  email: user.email,
                  name: user.user_metadata?.full_name || user.user_metadata?.name || '',
                  photo: user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
                },
              });
            }
          }
        } catch (error) {
          console.error('OAuth callback error:', error);
          Alert.alert('Authentication Error', 'Failed to complete Google sign-in. Please try again.');
        } finally {
          setGoogleLoading(false);
        }
      }
      
      // Handle Supabase callback URLs (legacy support)
      if (url.includes('supabase.co/auth/v1/callback')) {
        try {
          const session = await handleOAuthCallback(url);
          if (session) {
            // Get user data and navigate to signup with pre-filled data
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.email) {
              router.push({
                pathname: '/signup',
                params: {
                  email: user.email,
                  name: user.user_metadata?.full_name || user.user_metadata?.name || '',
                  photo: user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
                },
              });
            }
          }
        } catch (error) {
          console.error('OAuth callback error:', error);
          Alert.alert('Authentication Error', 'Failed to complete Google sign-in. Please try again.');
        } finally {
          setGoogleLoading(false);
        }
      }
    };

    // Add listener for deep links
    const subscription = Linking.addEventListener('url', handleDeepLink);
    
    // Check if app was opened with a deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [router]);

  // Also listen for auth state changes - this is the primary way to handle OAuth
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          router.push({
            pathname: '/signup',
            params: {
              email: user.email,
              name: user.user_metadata?.full_name || user.user_metadata?.name || '',
              photo: user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
            },
          });
        }
        setGoogleLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      await login(email, password);
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert('Login Failed', error.toString());
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      // Sign in with Google using Supabase
      const result = await signInWithGoogle();
      
      if (result?.error) {
        Alert.alert('Sign-in Failed', 'An error occurred while signing in with Google.');
        setGoogleLoading(false);
        return;
      }

      // If we got a URL back, open it in a browser (for mobile)
      if (result?.data?.url) {
        console.log('Opening OAuth URL:', result.data.url);
        
        // For mobile, we'll use the browser auth flow
        // The callback will be handled by the auth state change listener
        const browserResult = await WebBrowser.openAuthSessionAsync(
          result.data.url,
          'youngie://'
        );

        if (browserResult.type === 'success') {
          // Handle the callback URL
          await handleOAuthCallback(browserResult.url);
        } else if (browserResult.type === 'cancel') {
          setGoogleLoading(false);
        }
      } else {
        // Already have a session, get user data
        const session = await getSession();
        if (session) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.email) {
            router.push({
              pathname: '/signup',
              params: {
                email: user.email,
                name: user.user_metadata?.full_name || user.user_metadata?.name || '',
                photo: user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
              },
            });
          }
        }
        setGoogleLoading(false);
      }
    } catch (error: any) {
      Alert.alert('Sign-in Failed', 'An error occurred while signing in with Google.');
      setGoogleLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor }}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <ThemedView style={styles.container}>
          {/* Header Section */}
          <View style={styles.header}>
            <View style={[styles.logoContainer, { backgroundColor: primaryColor, shadowColor: primaryColor }]}>
              <IconSymbol name="heart.fill" size={40} color={white} />
            </View>
            <ThemedText type="heading1" style={{ fontFamily: typography.families.bold }}>Welcome Back</ThemedText>
            <ThemedText type="body1" style={{ color: lightTextColor }}>Sign in to continue</ThemedText>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <ThemedText type="body2" style={{ fontWeight: '600' }}>Email</ThemedText>
              <View style={[styles.inputWrapper, { backgroundColor: inputBackgroundColor, borderColor: inputBorderColor }]}>
                <IconSymbol name="at-sign" size={20} color={textColor} style={{ marginRight: spacing.sm }} />
                <TextInput
                  style={[styles.input, { color: textColor }]}
                  placeholder="your@email.com"
                  placeholderTextColor={lightTextColor}
                  value={email}
                  onChangeText={setEmail}
                  editable={!isLoading}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <ThemedText type="body2" style={{ fontWeight: '600' }}>Password</ThemedText>
              <View style={[styles.inputWrapper, { backgroundColor: inputBackgroundColor, borderColor: inputBorderColor }]}>
                <IconSymbol name="lock" size={20} color={textColor} style={{ marginRight: spacing.sm }} />
                <TextInput
                  style={[styles.input, { color: textColor }]}
                  placeholder="••••••••"
                  placeholderTextColor={lightTextColor}
                  value={password}
                  onChangeText={setPassword}
                  editable={!isLoading}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} disabled={isLoading}>
                  <IconSymbol name={showPassword ? "eye" : "eye-off"} size={20} color={textColor} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity 
                onPress={() => router.push('/forgot-password')} 
                style={styles.forgotPasswordContainer}
              >
                <ThemedText style={{ color: primaryColor }}>Forgot Password?</ThemedText>
              </TouchableOpacity>
            </View>

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.button, { backgroundColor: primaryColor }, isLoading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color={white} size="small" />
              ) : (
                <ThemedText style={[styles.buttonText, { color: white }]}>Sign In</ThemedText>
              )}
            </TouchableOpacity>


            {/* Signup Section */}
            <View style={styles.footer}>
              <ThemedText style={{ color: lightTextColor }}>Don't have an account? </ThemedText>
              <GoogleSignInButton 
                onPress={handleGoogleSignIn}
                disabled={isLoading || googleLoading}
                label={googleLoading ? "Signing in..." : "Sign Up with Google"}
              />
            </View>
          </View>
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.round,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...shadows.lg,
  },
  form: {
    gap: spacing.lg,
  },
  inputContainer: {
    gap: spacing.sm,
  },
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginTop: spacing.xs,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    ...shadows.sm,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: typography.sizes.body1,
  },
  button: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    ...shadows.md,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: typography.sizes.title,
    fontFamily: typography.families.bold,
  },
  footer: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    paddingHorizontal: spacing.sm,
    fontSize: typography.sizes.caption,
  },
});
