// app/login.tsx

import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, TextInput, ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { spacing, borderRadius, typography, shadows } from '@/constants/design-tokens';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { signInWithMagicLink, signInWithGoogle, supabase, handleOAuthCallback } from '@/utils/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '@/utils/api';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '@/contexts/AuthContext';


export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const router = useRouter();
  const { updateUser } = useAuth();

  // Check for existing Supabase session on mount
  useEffect(() => {
    const checkSupabaseSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
          const mongoToken = await AsyncStorage.getItem('authToken');
          const profileCompleted = await AsyncStorage.getItem('profileCompleted');

          if (mongoToken && profileCompleted === 'true') {
            router.replace('/(tabs)');
            return;
          }

          if (!mongoToken) {
            try {
              const supabaseToken = session.access_token;
              const response = await authAPI.supabaseLogin(supabaseToken);

              if (response.data?.needsProfileCompletion === false && response.data?.token) {
                await AsyncStorage.setItem('authToken', response.data.token);
                await AsyncStorage.setItem('sessionId', response.data.sessionId);
                await AsyncStorage.setItem('profileCompleted', 'true');
                router.replace('/(tabs)');
                return;
              } else if (response.data?.needsProfileCompletion === true) {
                await AsyncStorage.setItem('supabaseUserId', response.data.supabaseUserId);
                await AsyncStorage.setItem('userEmail', response.data.email);
                await AsyncStorage.setItem('pendingProfileCompletion', 'true');
                router.replace('/complete-profile');
                return;
              }
            } catch (apiError) {
              console.log('API check failed, checking local state');
            }
          }

          const pendingProfile = await AsyncStorage.getItem('pendingProfileCompletion');

          if (pendingProfile === 'true') {
            await AsyncStorage.removeItem('pendingProfileCompletion');
            router.replace('/complete-profile');
            return;
          }

          if (profileCompleted === 'true') {
            router.replace('/complete-profile');
            return;
          }

          return;
        }
      } catch (error) {
        console.warn('Error checking Supabase session:', error);
      }
    };

    const timer = setTimeout(() => {
      checkSupabaseSession();
    }, 500);

    return () => clearTimeout(timer);
  }, [router]);

  const primaryColor = useThemeColor('primary');
  const primaryDark = useThemeColor('primaryDark');
  const textColor = useThemeColor('text');
  const lightTextColor = useThemeColor('lightText');
  const inputBackgroundColor = useThemeColor('inputBackground');
  const inputBorderColor = useThemeColor('inputBorder');
  const white = useThemeColor('white');

  const handleLogin = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await signInWithMagicLink(email);

      if (error) {
        const errorMessage = error.message?.toLowerCase() || '';

        if (errorMessage.includes('email') || errorMessage.includes('not found') || errorMessage.includes('invalid email')) {
          Alert.alert(
            'Login Failed',
            'No account found with this email. Please sign up first.',
            [{ text: 'Sign Up', onPress: () => router.push('/signup') }, { text: 'OK', style: 'cancel' }]
          );
          setIsLoading(false);
          return;
        }

        throw error;
      }

      setIsLoading(false);
      setMagicLinkSent(true);

    } catch (error: any) {
      setIsLoading(false);

      const errorName = error?.name || '';

      if (errorName === 'AuthApiError' || (error as any)?.constructor?.name === 'AuthApiError') {
        Alert.alert(
          'Login Failed',
          'Unable to send magic link. Please try again later.',
          [{ text: 'OK' }]
        );
        return;
      }

      console.log('Login issue, handling gracefully');
      Alert.alert('Login Failed', 'Something went wrong. Please try again later.');
    }
  };

  const handleMagicLinkLogin = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        const mongoToken = await AsyncStorage.getItem('authToken');

        if (mongoToken) {
          router.replace('/(tabs)');
          return;
        }

        const pendingProfile = await AsyncStorage.getItem('pendingProfileCompletion');

        if (pendingProfile === 'true') {
          await AsyncStorage.removeItem('pendingProfileCompletion');
          router.replace('/complete-profile');
          return;
        }

        return;
      }
    } catch (error) {
      console.warn('Error checking Supabase session:', error);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await signInWithGoogle();

      if (error) {
        Alert.alert('Google Sign-In Failed', 'Unable to sign in with Google. Please try again.');
        setIsLoading(false);
        return;
      }

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, 'youngie://auth/callback');

        if (result.type === 'success') {
          const session = await handleOAuthCallback(result.url);
          if (session) {
            router.replace('/auth/callback');
            return;
          }
        } else if (result.type === 'cancel') {
          setIsLoading(false);
          return;
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.replace('/auth/callback');
        return;
      }

      setIsLoading(false);
    } catch (error: any) {
      console.error('Google login error:', error);
      setIsLoading(false);
      Alert.alert('Google Sign-In Failed', 'Unable to sign in with Google. Please try again.');
    }
  };

  return (
    <LinearGradient colors={[primaryColor + '08', 'transparent']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.container}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.logoContainer}>
                  <LinearGradient
                    colors={[primaryColor + '18', primaryColor + '08']}
                    style={styles.logoBg}
                  />
                  <Image source={require('@/assets/images/youngie_icon.png')} style={{ width: 52, height: 52 }} resizeMode="contain" />
                </View>
                <ThemedText type="heading1" style={styles.titleText}>Welcome Back</ThemedText>
                <ThemedText type="body1" style={styles.subtitleText}>Sign in to continue connecting with people</ThemedText>
              </View>

              {/* Form Card */}
              <ThemedView style={styles.formCard}>
                {magicLinkSent ? (
                  <View style={styles.magicLinkContainer}>
                    <LinearGradient
                      colors={[primaryColor + '18', primaryColor + '08']}
                      style={styles.magicLinkIconBg}
                    >
                      <IconSymbol name="mail.fill" size={36} color={primaryColor} />
                    </LinearGradient>
                    <ThemedText type="heading1" style={styles.successTitle}>Check Your Email</ThemedText>
                    <ThemedText type="body1" style={styles.successText}>
                      We've sent a magic link to{'\n'}
                      <ThemedText style={styles.emailBold}>{email}</ThemedText>
                    </ThemedText>
                    <ThemedText type="body2" style={styles.successHint}>Click the link in the email to sign in</ThemedText>
                    <TouchableOpacity
                      style={styles.primaryButtonWrapper}
                      onPress={() => {
                        setMagicLinkSent(false);
                        setEmail('');
                      }}
                      activeOpacity={0.85}
                    >
                      <LinearGradient colors={[primaryColor, primaryDark]} style={styles.primaryButton}>
                        <ThemedText style={[styles.primaryButtonText, { color: white }]}>Use Different Email</ThemedText>
                      </LinearGradient>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.textButton}
                      onPress={handleMagicLinkLogin}
                      disabled={isLoading}
                    >
                      <ThemedText style={[styles.textButtonText, { color: primaryColor }]}>Resend Link</ThemedText>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.form}>
                    {/* Email Input */}
                    <View style={styles.inputGroup}>
                      <ThemedText type="body2" style={styles.inputLabel}>Email</ThemedText>
                      <View style={[styles.inputWrapper, { backgroundColor: inputBackgroundColor, borderColor: inputBorderColor }]}>
                        <View style={[styles.inputIconContainer, { backgroundColor: primaryColor + '15' }]}>
                          <IconSymbol name="at-sign" size={18} color={primaryColor} />
                        </View>
                        <TextInput
                          style={[styles.input, { color: textColor }]}
                          placeholder="your@email.com"
                          placeholderTextColor={lightTextColor}
                          value={email}
                          onChangeText={setEmail}
                          editable={!isLoading}
                          keyboardType="email-address"
                          autoCapitalize="none"
                          autoCorrect={false}
                        />
                      </View>
                    </View>

                    {/* Send Magic Link */}
                    <TouchableOpacity
                      style={styles.primaryButtonWrapper}
                      onPress={handleLogin}
                      disabled={isLoading}
                      activeOpacity={0.85}
                    >
                      <LinearGradient colors={[primaryColor, primaryDark]} style={styles.primaryButton}>
                        {isLoading ? (
                          <ActivityIndicator color={white} size="small" />
                        ) : (
                          <ThemedText type="body1" style={[styles.primaryButtonText, { color: white }]}>Send Magic Link</ThemedText>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>

                    {/* Divider */}
                    <View style={styles.divider}>
                      <View style={[styles.dividerLine, { backgroundColor: inputBorderColor }]} />
                      <ThemedText type="body2" style={[styles.dividerText, { color: lightTextColor }]}>or</ThemedText>
                      <View style={[styles.dividerLine, { backgroundColor: inputBorderColor }]} />
                    </View>

                    {/* Continue with Google */}
                    <TouchableOpacity
                      style={[styles.googleButton, { backgroundColor: inputBackgroundColor, borderColor: inputBorderColor }]}
                      onPress={handleGoogleLogin}
                      disabled={isLoading}
                      activeOpacity={0.75}
                    >
                      <IconSymbol name="logo-google" size={20} color="#4285F4" />
                      <ThemedText type="body1" style={styles.googleButtonText}>Continue with Google</ThemedText>
                    </TouchableOpacity>
                  </View>
                )}
              </ThemedView>

              {/* Footer */}
              <View style={styles.footer}>
                <View style={styles.switchRow}>
                  <ThemedText type="body2" style={{ color: lightTextColor }}>Don't have an account?</ThemedText>
                  <TouchableOpacity onPress={() => router.push('/signup')} hitSlop={8} activeOpacity={0.7}>
                    <ThemedText type="body2" style={[styles.switchLink, { color: primaryColor }]}>Sign Up</ThemedText>
                  </TouchableOpacity>
                </View>

                <View style={styles.policyRow}>
                  <TouchableOpacity onPress={() => router.push('/terms')} hitSlop={8}>
                    <ThemedText type="body2" style={[styles.policyLink, { color: lightTextColor }]}>Terms</ThemedText>
                  </TouchableOpacity>
                  <ThemedText type="body2" style={[styles.policyDot, { color: inputBorderColor }]}>·</ThemedText>
                  <TouchableOpacity onPress={() => router.push('/privacy')} hitSlop={8}>
                    <ThemedText type="body2" style={[styles.policyLink, { color: lightTextColor }]}>Privacy</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl + spacing.sm,
    paddingBottom: spacing.xxl + spacing.sm,
    backgroundColor: 'transparent',
  },
  container: {},
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl + spacing.sm,
    gap: spacing.sm,
  },
  logoContainer: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    position: 'relative',
  },
  logoBg: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: borderRadius.round,
  },
  titleText: {
    fontFamily: typography.families.bold,
    fontSize: typography.sizes.heading1,
    marginBottom: spacing.xs,
    letterSpacing: -0.6,
  },
  subtitleText: {
    fontSize: typography.sizes.body1,
    textAlign: 'center',
    color: '#636366',
    lineHeight: 24,
  },
  formCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    ...shadows.xl,
  },
  magicLinkContainer: {
    alignItems: 'center',
  },
  magicLinkIconBg: {
    width: 72,
    height: 72,
    borderRadius: borderRadius.round,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  successTitle: {
    fontFamily: typography.families.bold,
    fontSize: typography.sizes.heading2,
    marginBottom: spacing.sm,
    letterSpacing: -0.5,
  },
  successText: {
    textAlign: 'center',
    fontSize: typography.sizes.body1,
    lineHeight: 26,
    marginBottom: spacing.xs,
  },
  emailBold: {
    fontFamily: typography.families.bold,
    color: '#636366',
  },
  successHint: {
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
    fontSize: typography.sizes.body2,
  },
  form: {
    gap: spacing.lg,
  },
  inputGroup: {
    gap: spacing.sm,
  },
  inputLabel: {
    fontWeight: '600',
    fontSize: typography.sizes.body2,
    letterSpacing: -0.2,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    ...shadows.sm,
  },
  inputIconContainer: {
    padding: spacing.md,
    marginLeft: spacing.sm,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingRight: spacing.md,
    paddingLeft: spacing.xs,
    fontSize: typography.sizes.body1,
    fontFamily: typography.families.regular,
    lineHeight: 22,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  googleButtonText: {
    fontSize: typography.sizes.body1,
    fontWeight: '500',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xxs,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dividerText: {
    paddingHorizontal: spacing.md,
    fontSize: typography.sizes.caption,
    fontWeight: '500',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#8E8E93',
  },
  primaryButtonWrapper: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    ...shadows.md,
  },
  primaryButton: {
    paddingVertical: spacing.md + 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: typography.sizes.body1,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  textButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  textButtonText: {
    fontSize: typography.sizes.body2,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
    gap: spacing.md,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  switchLink: {
    fontWeight: '600',
    fontSize: typography.sizes.body1,
  },
  policyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  policyLink: {
    fontSize: typography.sizes.caption,
  },
  policyDot: {
    fontSize: typography.sizes.caption,
  },
});
