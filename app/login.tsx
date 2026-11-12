// app/login.tsx

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BrandIcon } from '@/components/ui/brand-icon';
import { borderRadius, sizes, spacing, typography } from '@/constants/design-tokens';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeColor } from '@/hooks/use-theme-color';
import { CustomAlert } from '@/utils/alert';
import { showFriendlySocketError } from '@/utils/socket-error';
import { authAPI } from '@/utils/api';
import { getClientLocation, getDeviceName } from '@/utils/deviceInfo';
import { signInWithGoogle } from '@/utils/google-signin';
import { signInWithMagicLink, supabase } from '@/utils/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ImageBackground, KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);

  const router = useRouter();
  const { height: windowHeight } = useWindowDimensions();
  const isCompact = windowHeight < 800;
  const heroHeight = isCompact
    ? Math.max(260, Math.min(320, windowHeight * 0.4))
    : Math.min(470, Math.max(420, windowHeight * 0.5));
  const heroCopyBottom = isCompact ? 76 : 112;
  const { updateUser } = useAuth();

  useEffect(() => {
    const checkSupabaseSession = async () => {
      try {
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Session check timeout')), 5000)
        );

        const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]);

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
              const [deviceName, clientLocation] = await Promise.all([
                getDeviceName(),
                getClientLocation(),
              ]);
              const response = await authAPI.supabaseLogin(supabaseToken, deviceName, clientLocation);

              if (response.status === 403) {
                return;
              }

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
              console.log('API check failed, staying on login page');
              return;
            }
          }
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

  const primaryColor = '#FF009D';
  const lightTextColor = '#AFA3B8';
  const white = '#FFFFFF';
  const backgroundColor = '#120018';
  const surfaceColor = '#1D0624';
  const borderColor = '#49334F';
  const textMutedColor = '#AFA3B8';
  const textSecondaryColor = '#CFC3D2';
  const glassBorderColor = '#FFFFFF26';
  const gradientStartColor = '#FF009D';
  const gradientMidColor = '#FF009D';
  const gradientEndColor = '#FF009D';

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

      const isNetworkError = error?.isNetworkError === true;
      if (isNetworkError) {
        showFriendlySocketError(error, 'general');
        return;
      }

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
    if (!email) {
      setShowEmailForm(true);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await signInWithMagicLink(email);

      if (error) {
        setIsLoading(false);
        CustomAlert.error('Error', 'Failed to resend magic link. Please try again.');
        return;
      }

      setIsLoading(false);
      setMagicLinkSent(true);
      CustomAlert.show({
        type: 'success',
        title: 'Link Sent',
        message: "We've resent the magic link to your email.",
        buttons: [{ text: 'OK' }],
      });
    } catch (error: any) {
      setIsLoading(false);

      const isNetworkError = error?.isNetworkError === true;
      if (isNetworkError) {
        showFriendlySocketError(error, 'general');
        return;
      }

      CustomAlert.error('Error', 'Failed to resend magic link. Please try again.');
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
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#120018" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <LinearGradient
            colors={['#130019', '#150221', '#0C0011']}
            locations={[0, 0.5, 1]}
            style={styles.screen}
          >
            <ImageBackground
              source={require('@/assets/images/youngie-login-background.png')}
              style={[styles.hero, { height: heroHeight }]}
              imageStyle={styles.heroImage}
            >
              <LinearGradient
                colors={['#0B000FE6', '#14002000']}
                locations={[0, 0.62]}
                style={styles.heroTopShade}
                pointerEvents="none"
              />

              <View style={styles.heroOverlay} />

              <LinearGradient
                colors={[`${backgroundColor}00`, `${backgroundColor}00`, `${backgroundColor}33`, `${backgroundColor}8C`, `${backgroundColor}D9`, `${backgroundColor}FF`, `${backgroundColor}FF`]}
                locations={[0, 0.34, 0.56, 0.74, 0.88, 0.96, 1]}
                style={[styles.heroFade, { height: heroCopyBottom + 16 }]}
                pointerEvents="none"
              />

              <View style={[styles.brandRow, isCompact && styles.brandRowCompact]}>
                <Image
                  source={require('@/assets/images/youngie_icon.png')}
                  style={[styles.brandIcon, isCompact && styles.brandIconCompact]}
                  resizeMode="contain"
                />
                <ThemedText style={[styles.brandName, isCompact && styles.brandNameCompact]}>Youngie</ThemedText>
              </View>

              <View style={[styles.heroCopy, { paddingBottom: heroCopyBottom }]}>
                {!isCompact && (
                  <View style={styles.heroBadge}>
                    <View style={styles.heroBadgeDot} />
                    <ThemedText style={styles.heroBadgeText}>Meet people near you</ThemedText>
                  </View>
                )}

                <ThemedText style={[styles.heroTitle, isCompact && styles.heroTitleCompact]}>
                  Real People.
                  {'\n'}
                  <ThemedText style={[styles.heroTitleAccent, isCompact && styles.heroTitleAccentCompact]}>New Connections.</ThemedText>
                </ThemedText>

                <LinearGradient
                  colors={['#FF009D', '#FF009D00']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.heroAccentBar, isCompact && styles.heroAccentBarCompact]}
                />

                {!isCompact && (
                  <ThemedText style={styles.heroSubtitle}>
                    Meet, chat and discover amazing{'\n'}people around you.
                  </ThemedText>
                )}
              </View>
            </ImageBackground>

            <LinearGradient
              colors={['#120018', '#120018', '#120018', '#100017', '#0C0011']}
              locations={[0, 0.06, 0.2, 0.62, 1]}
              style={styles.authPanel}
            >
              {magicLinkSent ? (
                <View style={styles.magicLinkContainer}>
                  <View style={[styles.magicLinkIconBg, { backgroundColor: primaryColor + '22' }]}>
                    <IconSymbol name="mail.fill" size={sizes.iconLarge} color={primaryColor} />
                  </View>

                  <ThemedText style={styles.successTitle}>Check Your Email</ThemedText>

                  <ThemedText style={styles.successText}>
                    We{'\''}ve sent a magic link to{'\n'}
                    <ThemedText style={styles.emailBold}>{email}</ThemedText>
                  </ThemedText>

                  <ThemedText style={styles.successHint}>
                    Click the link in the email to sign in.
                  </ThemedText>

                  <TouchableOpacity
                    style={[styles.primaryButton, { backgroundColor: primaryColor }]}
                    onPress={() => {
                      setMagicLinkSent(false);
                      setEmail('');
                      setShowEmailForm(true);
                    }}
                    activeOpacity={0.85}
                  >
                    <ThemedText style={styles.primaryButtonText}>Use Different Email</ThemedText>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.textButton}
                    onPress={handleMagicLinkLogin}
                    disabled={isLoading}
                  >
                    <ThemedText style={[styles.textButtonText, { color: primaryColor }]}>
                      Resend Link
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              ) : showEmailForm ? (
                <View style={styles.emailForm}>
                  <TouchableOpacity
                    onPress={() => setShowEmailForm(false)}
                    style={styles.backButton}
                    hitSlop={10}
                  >
                    <ThemedText style={[styles.backButtonText, { color: primaryColor }]}>
                      ‹ Back
                    </ThemedText>
                  </TouchableOpacity>

                  <View>
                    <ThemedText style={styles.emailTitle}>Sign in with Email</ThemedText>
                    <ThemedText style={styles.emailSubtitle}>
                      We{'\''}ll send you a secure magic link.
                    </ThemedText>
                  </View>

                  <View style={styles.inputGroup}>
                    <ThemedText style={styles.inputLabel}>Email address</ThemedText>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: '#FFFFFF12',
                          color: white,
                          borderColor: '#FFFFFF26',
                        },
                      ]}
                      placeholder="your@email.com"
                      placeholderTextColor="#AFA3B8"
                      value={email}
                      onChangeText={setEmail}
                      editable={!isLoading}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="email"
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
                      <ThemedText style={styles.primaryButtonText}>
                        Send Magic Link
                      </ThemedText>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.authContent}>
                  <TouchableOpacity
                    style={styles.googleButton}
                    onPress={handleGoogleLogin}
                    disabled={isLoading}
                    activeOpacity={0.82}
                  >
                    <View style={styles.googleIcon}>
                      <BrandIcon name="google" size={22} />
                    </View>
                    <ThemedText style={styles.googleButtonText}>
                      Continue with Google
                    </ThemedText>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.appleButton}
                    onPress={() =>
                      CustomAlert.show({
                        type: 'info',
                        title: 'Apple Sign-In',
                        message: 'Apple Sign-In is not configured in this build yet.',
                        buttons: [{ text: 'OK' }],
                      })
                    }
                    disabled={isLoading}
                    activeOpacity={0.82}
                  >
                    <BrandIcon name="apple" size={22} />
                    <ThemedText style={styles.appleButtonText}>
                      Continue with Apple
                    </ThemedText>
                  </TouchableOpacity>

                  <View style={styles.divider}>
                    <View style={styles.dividerLine} />
                    <ThemedText style={styles.dividerText}>or</ThemedText>
                    <View style={styles.dividerLine} />
                  </View>

                  <TouchableOpacity
                    style={styles.emailButton}
                    onPress={() => setShowEmailForm(true)}
                    disabled={isLoading}
                    activeOpacity={0.82}
                  >
                    <IconSymbol name="mail.fill" size={sizes.iconMedium} color="#FFFFFF" />
                    <ThemedText style={styles.emailButtonText}>
                      Sign in with Email
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.footer}>
                <View style={styles.switchRow}>
                  <ThemedText style={[styles.footerText, { color: textMutedColor }]}>Don{'\''}t have an account?</ThemedText>
                  <TouchableOpacity
                    onPress={() => router.push('/signup')}
                    hitSlop={8}
                    activeOpacity={0.7}
                  >
                    <ThemedText style={[styles.switchLink, { color: gradientStartColor }]}>
                      Sign Up
                    </ThemedText>
                  </TouchableOpacity>
                </View>

                <View style={styles.policyRow}>
                  <TouchableOpacity onPress={() => router.push('/terms')} hitSlop={8}>
                    <ThemedText style={[styles.policyLink, { color: textMutedColor }]}>Terms</ThemedText>
                  </TouchableOpacity>
                  <ThemedText style={[styles.policyDot, { color: textMutedColor }]}>·</ThemedText>
                  <TouchableOpacity onPress={() => router.push('/privacy')} hitSlop={8}>
                    <ThemedText style={[styles.policyLink, { color: textMutedColor }]}>Privacy</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            </LinearGradient>
          </LinearGradient>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#130019',
  },
  keyboard: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  screen: {
    flexGrow: 1,
    backgroundColor: '#0C0011',
  },
  hero: {
    width: '100%',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  heroImage: {
    resizeMode: 'cover',
  },
  heroTopShade: {
    ...StyleSheet.absoluteFill,
    bottom: undefined,
    height: 250,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#18001F33',
  },
  heroFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 8,
  },
  brandRowCompact: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  brandIcon: {
    width: 52,
    height: 52,
  },
  brandIconCompact: {
    width: 42,
    height: 42,
  },
  brandName: {
    color: '#FF009D',
    fontFamily: typography.families.bold,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -1,
    textShadowColor: '#00000099',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  brandNameCompact: {
    fontSize: 26,
    lineHeight: 31,
  },
  heroCopy: {
    paddingHorizontal: 28,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#FFFFFF26',
    backgroundColor: '#FFFFFF14',
  },
  heroBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF009D',
  },
  heroBadgeText: {
    color: '#F3E6F3',
    fontSize: 13,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontFamily: typography.families.bold,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontFamily: typography.families.bold,
    fontSize: 36,
    lineHeight: 41,
    letterSpacing: -1.2,
    textShadowColor: '#00000080',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 14,
  },
  heroTitleAccent: {
    color: '#FF009D',
    fontFamily: typography.families.bold,
    fontSize: 36,
    lineHeight: 41,
    textShadowColor: '#FF009D59',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 18,
  },
  heroTitleCompact: {
    fontSize: 30,
    lineHeight: 35,
  },
  heroTitleAccentCompact: {
    fontSize: 30,
    lineHeight: 35,
  },
  heroAccentBar: {
    width: 92,
    height: 4,
    borderRadius: 2,
    marginTop: 12,
    marginBottom: 10,
  },
  heroAccentBarCompact: {
    width: 72,
    marginTop: 10,
    marginBottom: 0,
  },
  heroSubtitle: {
    color: '#E2D4E4',
    fontSize: 15,
    lineHeight: 23,
    letterSpacing: 0.1,
    maxWidth: 300,
    textShadowColor: '#00000066',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  authPanel: {
    flexGrow: 0,
    paddingHorizontal: 28,
    paddingTop: 14,
    paddingBottom: 18,
  },
  authContent: {
    gap: 12,
  },
  magicLinkContainer: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  magicLinkIconBg: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  successTitle: {
    fontSize: typography.sizes.heading2,
    fontFamily: typography.families.bold,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.md,
  },
  successText: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.families.regular,
    textAlign: 'center',
    lineHeight: typography.sizes.body1 * 1.4,
    marginBottom: spacing.sm,
  },
  emailBold: {
    fontWeight: typography.weights.bold,
  },
  successHint: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.families.regular,
    marginBottom: spacing.xl,
  },
  primaryButton: {
    width: '100%',
    height: sizes.buttonHeight,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  primaryButtonText: {
    fontSize: typography.sizes.title,
    fontFamily: typography.families.semibold,
    fontWeight: typography.weights.semibold,
  },
  textButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  textButtonText: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.families.semibold,
  },
  emailForm: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: spacing.lg,
  },
  backButtonText: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.families.semibold,
  },
  emailTitle: {
    fontSize: typography.sizes.heading2,
    fontFamily: typography.families.bold,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.xs,
  },
  emailSubtitle: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.families.regular,
    marginBottom: spacing.xl,
  },
  inputGroup: {
    marginBottom: spacing.xl,
  },
  inputLabel: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.families.medium,
    marginBottom: spacing.xs,
  },
  input: {
    width: '100%',
    height: sizes.inputHeight,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    fontSize: typography.sizes.body1,
    fontFamily: typography.families.regular,
  },
  googleButton: {
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FF009D',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 20,
  },
  googleIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontFamily: typography.families.bold,
  },
  appleButton: {
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: '#FF009D',
    backgroundColor: '#1D0624',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 20,
  },
  appleButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontFamily: typography.families.bold,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#6B5A70',
  },
  dividerText: {
    color: '#9C8FA2',
    paddingHorizontal: 14,
    fontSize: 16,
    fontFamily: typography.families.bold,
  },
  emailButton: {
    height: 58,
    borderRadius: 29,
    borderWidth: 1,
    borderColor: '#49334F',
    backgroundColor: '#1A071F',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  emailButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontFamily: typography.families.regular,
  },
  footer: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  footerText: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.families.regular,
  },
  switchLink: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.families.semibold,
    fontWeight: typography.weights.semibold,
  },
  policyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  policyLink: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.families.regular,
  },
  policyDot: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.families.regular,
  },
});