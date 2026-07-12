// app/login.tsx

import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, TextInput, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { spacing, borderRadius, typography } from '@/constants/design-tokens';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { signInWithMagicLink, supabase } from '@/utils/supabase';
import { signInWithGoogle } from '@/utils/google-signin';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';
import { CustomAlert } from '@/utils/alert';


export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const router = useRouter();
  const { updateUser } = useAuth();

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
  const surfaceColor = useThemeColor('surface');

  const handleLogin = async () => {
    if (!email) {
      CustomAlert.error('Error', 'Please enter your email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      CustomAlert.error('Error', 'Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await signInWithMagicLink(email);

      if (error) {
        const errorMessage = error.message?.toLowerCase() || '';

        if (errorMessage.includes('email') || errorMessage.includes('not found') || errorMessage.includes('invalid email')) {
          CustomAlert.show({
            type: 'error',
            title: 'Login Failed',
            message: 'No account found with this email. Please sign up first.',
            buttons: [
              { text: 'Sign Up', onPress: () => router.push('/signup') },
              { text: 'OK', style: 'cancel' },
            ],
          });
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
        CustomAlert.error('Login Failed', 'Unable to send magic link. Please try again later.');
        return;
      }

      console.log('Login issue, handling gracefully');
      CustomAlert.error('Login Failed', 'Something went wrong. Please try again later.');
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

      if (error || !data?.session) {
        setIsLoading(false);
        return;
      }

      router.replace('/auth/callback');
    } catch (error: any) {
      console.error('Google login error:', error);
      setIsLoading(false);
      CustomAlert.error('Google Sign-In Failed', 'Unable to sign in with Google. Please try again.');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: surfaceColor }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.container}>
            <View style={styles.header}>
              <Image source={require('@/assets/images/youngie_icon.png')} style={{ width: 56, height: 56 }} resizeMode="contain" />
              <ThemedText type="heading1" style={styles.titleText}>Welcome Back</ThemedText>
              <ThemedText type="body1" style={[styles.subtitleText, { color: lightTextColor }]}>Sign in to continue connecting with people</ThemedText>
            </View>

            <View style={[styles.formCard, { backgroundColor: surfaceColor }]}>
              {magicLinkSent ? (
                <View style={styles.magicLinkContainer}>
                  <View style={[styles.magicLinkIconBg, { backgroundColor: primaryColor + '15' }]}>
                    <IconSymbol name="mail.fill" size={32} color={primaryColor} />
                  </View>
                  <ThemedText type="heading2" style={styles.successTitle}>Check Your Email</ThemedText>
                  <ThemedText type="body1" style={[styles.successText, { color: lightTextColor }]}>
                    We've sent a magic link to{'\n'}
                    <ThemedText style={[styles.emailBold, { color: textColor }]}>{email}</ThemedText>
                  </ThemedText>
                  <ThemedText type="body2" style={[styles.successHint, { color: lightTextColor }]}>Click the link in the email to sign in</ThemedText>
                  <TouchableOpacity
                    style={[styles.primaryButton, { backgroundColor: primaryColor }]}
                    onPress={() => {
                      setMagicLinkSent(false);
                      setEmail('');
                    }}
                    activeOpacity={0.85}
                  >
                    <ThemedText style={[styles.primaryButtonText, { color: white }]}>Use Different Email</ThemedText>
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
                  <View style={styles.inputGroup}>
                    <ThemedText type="body2" style={[styles.inputLabel, { color: textColor }]}>Email</ThemedText>
                    <TextInput
                      style={[styles.input, { backgroundColor: inputBackgroundColor, color: textColor, borderColor: inputBorderColor }]}
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

                  <TouchableOpacity
                    style={[styles.primaryButton, { backgroundColor: primaryColor }]}
                    onPress={handleLogin}
                    disabled={isLoading}
                    activeOpacity={0.85}
                  >
                    {isLoading ? (
                      <ActivityIndicator color={white} size="small" />
                    ) : (
                      <ThemedText type="body1" style={[styles.primaryButtonText, { color: white }]}>Send Magic Link</ThemedText>
                    )}
                  </TouchableOpacity>

                  <View style={styles.divider}>
                    <View style={[styles.dividerLine, { backgroundColor: inputBorderColor }]} />
                    <ThemedText type="body2" style={[styles.dividerText, { color: lightTextColor }]}>or</ThemedText>
                    <View style={[styles.dividerLine, { backgroundColor: inputBorderColor }]} />
                  </View>

                  <TouchableOpacity
                    style={[styles.googleButton, { backgroundColor: inputBackgroundColor, borderColor: inputBorderColor }]}
                    onPress={handleGoogleLogin}
                    disabled={isLoading}
                    activeOpacity={0.75}
                  >
                    <IconSymbol name="logo-google" size={20} color="#4285F4" />
                    <ThemedText type="body1" style={[styles.googleButtonText, { color: textColor }]}>Continue with Google</ThemedText>
                  </TouchableOpacity>
                </View>
              )}
            </View>

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
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
  },
  container: {
    gap: spacing.xl,
  },
  header: {
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  titleText: {
    fontFamily: typography.families.bold,
    fontSize: typography.sizes.heading1,
    letterSpacing: -0.6,
  },
  subtitleText: {
    fontSize: typography.sizes.body1,
    textAlign: 'center',
    lineHeight: 24,
  },
  formCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D1D1D6',
  },
  magicLinkContainer: {
    alignItems: 'center',
    gap: spacing.md,
  },
  magicLinkIconBg: {
    width: 72,
    height: 72,
    borderRadius: borderRadius.round,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successTitle: {
    fontFamily: typography.families.bold,
    fontSize: typography.sizes.heading2,
    letterSpacing: -0.5,
  },
  successText: {
    textAlign: 'center',
    fontSize: typography.sizes.body1,
    lineHeight: 26,
  },
  emailBold: {
    fontFamily: typography.families.bold,
  },
  successHint: {
    textAlign: 'center',
    fontSize: typography.sizes.body2,
    marginBottom: spacing.lg,
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
  input: {
    height: 52,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    paddingHorizontal: spacing.md,
    fontSize: typography.sizes.body1,
    fontFamily: typography.families.regular,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
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
  },
  primaryButton: {
    height: 52,
    borderRadius: borderRadius.md,
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
    alignItems: 'center',
  },
  textButtonText: {
    fontSize: typography.sizes.body2,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.lg,
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
