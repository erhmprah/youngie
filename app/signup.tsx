// app/signup.tsx

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BrandIcon } from '@/components/ui/brand-icon';
import { sizes, typography } from '@/constants/design-tokens';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeColor } from '@/hooks/use-theme-color';
import { CustomAlert } from '@/utils/alert';
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

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  const router = useRouter();
  const { updateUser } = useAuth();
  const { height: windowHeight } = useWindowDimensions();
  const isCompact = windowHeight < 800;
  const heroHeight = isCompact
    ? Math.max(260, Math.min(320, windowHeight * 0.4))
    : Math.min(470, Math.max(420, windowHeight * 0.5));
  const heroCopyBottom = isCompact ? 76 : 112;

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

  const primaryColor = '#FF009D';
  const white = '#FFFFFF';
  const backgroundColor = '#120018';
  const surfaceColor = '#1D0624';
  const borderColor = '#49334F';
  const textMutedColor = '#AFA3B8';
  const textSecondaryColor = '#CFC3D2';
  const glassBorderColor = '#FFFFFF26';
  const gradientStartColor = '#FF009D';

  const handleSignup = async () => {
    if (!email) {
      CustomAlert.error('Error', 'Please enter your email address');
      return;
    }

    if (!acceptTerms) {
      CustomAlert.error('Terms Required', 'Please accept the Terms of Service and Privacy Policy to continue');
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

        if (errorMessage.includes('email')) {
          CustomAlert.error(
            'Email Error',
            'Unable to send magic link. Please check the email address and try again.'
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
        CustomAlert.error('Signup Failed', 'Unable to send magic link. Please try again later.');
        return;
      }

      console.log('Signup issue, handling gracefully');
      CustomAlert.error('Signup Failed', 'Something went wrong. Please try again later.');
    }
  };

  const handleGoogleSignup = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await signInWithGoogle();

      if (error || !data?.session) {
        setIsLoading(false);
        return;
      }

      router.replace('/auth/callback');
    } catch (error: any) {
      console.error('Google signup error:', error);
      setIsLoading(false);
      CustomAlert.error('Google Sign-In Failed', 'Unable to sign in with Google. Please try again.');
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]}>
      <StatusBar barStyle="light-content" backgroundColor={backgroundColor} />
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
            colors={[backgroundColor, backgroundColor, '#050507']}
            locations={[0, 0.5, 1]}
            style={styles.screen}
          >
            <ImageBackground
              source={require('@/assets/images/youngie-login-background.png')}
              style={[styles.hero, { height: heroHeight }]}
              imageStyle={styles.heroImage}
            >
              <LinearGradient
                colors={[`${backgroundColor}E6`, `${backgroundColor}00`]}
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
                  <View style={[styles.heroBadge, { backgroundColor: glassBorderColor + '22', borderColor: glassBorderColor }]}>
                    <View style={[styles.heroBadgeDot, { backgroundColor: gradientStartColor }]} />
                    <ThemedText style={[styles.heroBadgeText, { color: white }]}>Join the community</ThemedText>
                  </View>
                )}

                <ThemedText style={[styles.heroTitle, { color: white }, isCompact && styles.heroTitleCompact]}>
                  Create Your
                  {'\n'}
                  <ThemedText style={[styles.heroTitleAccent, { color: gradientStartColor }, isCompact && styles.heroTitleAccentCompact]}>Account.</ThemedText>
                </ThemedText>

                <LinearGradient
                  colors={[gradientStartColor, `${gradientStartColor}00`]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.heroAccentBar, isCompact && styles.heroAccentBarCompact]}
                />

                {!isCompact && (
                  <ThemedText style={[styles.heroSubtitle, { color: textSecondaryColor }]}>
                    Sign up free and start meeting{'\n'}people around you.
                  </ThemedText>
                )}
              </View>
            </ImageBackground>

            <LinearGradient
              colors={[backgroundColor, backgroundColor, backgroundColor, '#060608']}
              locations={[0, 0.06, 0.2, 1]}
              style={styles.authPanel}
            >
              {magicLinkSent ? (
                <View style={styles.magicLinkContainer}>
                  <View style={[styles.magicLinkIconBg, { backgroundColor: gradientStartColor + '22' }]}>
                    <IconSymbol name="mail.fill" size={sizes.iconLarge} color={gradientStartColor} />
                  </View>

                  <ThemedText style={[styles.successTitle, { color: white }]}>Check Your Email</ThemedText>

                  <ThemedText style={[styles.successText, { color: textSecondaryColor }]}>
                    We've sent a magic link to{'\n'}
                    <ThemedText style={[styles.emailBold, { color: white }]}>{email}</ThemedText>
                  </ThemedText>

                  <ThemedText style={[styles.successHint, { color: textMutedColor }]}>
                    Click the link in the email to create your account.
                  </ThemedText>

                  <TouchableOpacity
                    style={[styles.primaryButton, { backgroundColor: gradientStartColor }]}
                    onPress={() => {
                      setMagicLinkSent(false);
                      setShowEmailForm(true);
                      setEmail('');
                    }}
                    activeOpacity={0.85}
                  >
                    <ThemedText style={[styles.primaryButtonText, { color: white }]}>Use Different Email</ThemedText>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.textButton}
                    onPress={handleSignup}
                    disabled={isLoading}
                  >
                    <ThemedText style={[styles.textButtonText, { color: gradientStartColor }]}>
                      Resend Link
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              ) : !showEmailForm ? (
                <View style={styles.authContent}>
                  <TouchableOpacity
                    style={[styles.googleButton, { backgroundColor: gradientStartColor }]}
                    onPress={handleGoogleSignup}
                    disabled={isLoading}
                    activeOpacity={0.82}
                  >
                    <View style={[styles.googleIcon, { backgroundColor: white }]}>
                      <BrandIcon name="google" size={22} />
                    </View>
                    <ThemedText style={[styles.googleButtonText, { color: white }]}>Continue with Google</ThemedText>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.appleButton, { backgroundColor: surfaceColor, borderColor: gradientStartColor }]}
                    onPress={() =>
                      CustomAlert.show({
                        type: 'info',
                        title: 'Apple Sign-Up',
                        message: 'Apple Sign-Up is not configured in this build yet.',
                        buttons: [{ text: 'OK' }],
                      })
                    }
                    disabled={isLoading}
                    activeOpacity={0.82}
                  >
                    <BrandIcon name="apple" size={22} />
                    <ThemedText style={[styles.appleButtonText, { color: white }]}>
                      Continue with Apple
                    </ThemedText>
                  </TouchableOpacity>

                  <View style={styles.divider}>
                    <View style={[styles.dividerLine, { backgroundColor: borderColor }]} />
                    <ThemedText style={[styles.dividerText, { color: textMutedColor }]}>or</ThemedText>
                    <View style={[styles.dividerLine, { backgroundColor: borderColor }]} />
                  </View>

                  <TouchableOpacity
                    style={[styles.emailButton, { backgroundColor: glassBorderColor + '22', borderColor: glassBorderColor }]}
                    onPress={() => setShowEmailForm(true)}
                    disabled={isLoading}
                    activeOpacity={0.82}
                  >
                    <IconSymbol name="mail.fill" size={sizes.iconMedium} color={white} />
                    <ThemedText style={[styles.emailButtonText, { color: white }]}>
                      Sign up with Email
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.emailForm}>
                  <TouchableOpacity
                    onPress={() => setShowEmailForm(false)}
                    style={styles.backButton}
                    hitSlop={10}
                  >
                    <ThemedText style={[styles.backButtonText, { color: gradientStartColor }]}>
                      ‹ Back
                    </ThemedText>
                  </TouchableOpacity>

                  <View>
                    <ThemedText style={[styles.emailTitle, { color: white }]}>Sign up with Email</ThemedText>
                    <ThemedText style={[styles.emailSubtitle, { color: textMutedColor }]}>
                      We'll send you a secure magic link.
                    </ThemedText>
                  </View>

                  <View style={styles.inputGroup}>
                    <ThemedText style={[styles.inputLabel, { color: white }]}>Email address</ThemedText>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: glassBorderColor + '22',
                          color: white,
                          borderColor: glassBorderColor,
                        },
                      ]}
                      placeholder="your@email.com"
                      placeholderTextColor={textMutedColor}
                      value={email}
                      onChangeText={setEmail}
                      editable={!isLoading}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="email"
                    />
                  </View>

                  <View style={styles.termsContainer}>
                    <TouchableOpacity
                      style={styles.checkboxHit}
                      onPress={() => setAcceptTerms(!acceptTerms)}
                      hitSlop={10}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          {
                            backgroundColor: acceptTerms ? gradientStartColor : 'transparent',
                            borderColor: acceptTerms ? gradientStartColor : borderColor,
                          },
                        ]}
                      >
                        {acceptTerms && <IconSymbol name="checkmark" size={sizes.checkboxIconSize} color={white} />}
                      </View>
                    </TouchableOpacity>

                    <ThemedText style={[styles.termsText, { color: textMutedColor }]}>
                      I agree to the{' '}
                      <ThemedText
                        style={[styles.termsHighlight, { color: gradientStartColor }]}
                        onPress={() => router.push('/terms')}
                        suppressHighlighting
                      >
                        Terms
                      </ThemedText>
                      {' '}and{' '}
                      <ThemedText
                        style={[styles.termsHighlight, { color: gradientStartColor }]}
                        onPress={() => router.push('/privacy')}
                        suppressHighlighting
                      >
                        Privacy Policy
                      </ThemedText>
                    </ThemedText>
                  </View>

                  <TouchableOpacity
                    style={[styles.primaryButton, { backgroundColor: acceptTerms ? gradientStartColor : gradientStartColor + '50' }]}
                    onPress={handleSignup}
                    disabled={isLoading || !acceptTerms}
                    activeOpacity={0.85}
                  >
                    {isLoading ? (
                      <ActivityIndicator color={white} size="small" />
                    ) : (
                      <ThemedText style={[styles.primaryButtonText, { color: white }]}>Send Magic Link</ThemedText>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.footer}>
                <View style={styles.switchRow}>
                  <ThemedText style={[styles.footerText, { color: textMutedColor }]}>Already have an account?</ThemedText>
                  <TouchableOpacity
                    onPress={() => router.replace('/login')}
                    hitSlop={8}
                    activeOpacity={0.7}
                  >
                    <ThemedText style={[styles.switchLink, { color: gradientStartColor }]}>Sign In</ThemedText>
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
  safeArea: { flex: 1, backgroundColor: '#130019' },
  keyboard: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  screen: { flexGrow: 1, backgroundColor: '#0C0011' },
  hero: { width: '100%', justifyContent: 'space-between', overflow: 'hidden' },
  heroImage: { resizeMode: 'cover' },
  heroOverlay: { ...StyleSheet.absoluteFill, backgroundColor: '#18001F33' },
  heroTopShade: { ...StyleSheet.absoluteFill, bottom: undefined, height: 250 },
  heroFade: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  brandRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 12, gap: 8 },
  brandRowCompact: { paddingHorizontal: 20, paddingTop: 8 },
  brandIcon: { width: 52, height: 52 },
  brandIconCompact: { width: 42, height: 42 },
  brandName: { color: '#FF009D', fontFamily: typography.families.bold, fontSize: 32, lineHeight: 38, letterSpacing: -1, textShadowColor: '#00000099', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 },
  brandNameCompact: { fontSize: 26, lineHeight: 31 },
  heroCopy: { paddingHorizontal: 28 },
  heroBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 8, marginBottom: 12, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: '#FFFFFF26', backgroundColor: '#FFFFFF14' },
  heroBadgeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF009D' },
  heroBadgeText: { color: '#F3E6F3', fontSize: 13, letterSpacing: 0.8, textTransform: 'uppercase', fontFamily: typography.families.bold },
  heroTitle: { color: '#FFFFFF', fontFamily: typography.families.bold, fontSize: 36, lineHeight: 41, letterSpacing: -1.1, textShadowColor: '#00000080', textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 14 },
  heroTitleAccent: { color: '#FF009D', fontFamily: typography.families.bold, fontSize: 36, lineHeight: 41, textShadowColor: '#FF009D59', textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 18 },
  heroTitleCompact: { fontSize: 30, lineHeight: 35 },
  heroTitleAccentCompact: { fontSize: 30, lineHeight: 35 },
  heroAccentBar: { width: 92, height: 4, borderRadius: 2, marginTop: 12, marginBottom: 10 },
  heroAccentBarCompact: { width: 72, marginTop: 10, marginBottom: 0 },
  heroSubtitle: { color: '#E2D4E4', fontSize: 15, lineHeight: 23, letterSpacing: 0.1, maxWidth: 300, textShadowColor: '#00000066', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10 },
  authPanel: { flexGrow: 0, paddingHorizontal: 28, paddingTop: 14, paddingBottom: 18 },
  authContent: { gap: 12 },
  googleButton: { height: 56, borderRadius: 28, backgroundColor: '#FF009D', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 20 },
  googleIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  googleButtonText: { color: '#FFFFFF', fontSize: 16, fontFamily: typography.families.bold },
  appleButton: { height: 56, borderRadius: 28, borderWidth: 1.5, borderColor: '#FF009D', backgroundColor: '#1D0624', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 20 },
  appleButtonText: { color: '#FFFFFF', fontSize: 16, fontFamily: typography.families.bold },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 2 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: '#6B5A70' },
  dividerText: { color: '#9C8FA2', paddingHorizontal: 14, fontSize: 15, fontFamily: typography.families.bold },
  emailButton: { height: 58, borderRadius: 29, borderWidth: 1, borderColor: '#49334F', backgroundColor: '#1A071F', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 },
  emailButtonText: { color: '#FFFFFF', fontSize: 17, fontFamily: typography.families.regular },
  emailForm: { gap: 18 },
  backButton: { alignSelf: 'flex-start', paddingVertical: 2 },
  backButtonText: { fontSize: 16, fontFamily: typography.families.bold },
  emailTitle: { color: '#FFFFFF', fontFamily: typography.families.bold, fontSize: 27, letterSpacing: -0.6 },
  emailSubtitle: { color: '#AFA3B8', marginTop: 5, fontSize: 15, lineHeight: 22 },
  inputGroup: { gap: 8 },
  inputLabel: { color: '#FFFFFF', fontSize: 14, fontFamily: typography.families.bold },
  input: { height: 54, borderRadius: 18, borderWidth: 1, paddingHorizontal: 17, fontSize: 16, fontFamily: typography.families.regular, backgroundColor: '#FFFFFF12', color: '#FFFFFF', borderColor: '#FFFFFF26' },
  termsContainer: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkboxHit: { marginTop: 1 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', marginTop: 1 },
  termsText: { flex: 1, color: '#AFA3B8', fontSize: 13, lineHeight: 19 },
  termsHighlight: { fontFamily: typography.families.bold },
  primaryButton: { height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontFamily: typography.families.bold },
  magicLinkContainer: { alignItems: 'center', gap: 12, paddingVertical: 8 },
  magicLinkIconBg: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 2 },
  successTitle: { color: '#FFFFFF', fontFamily: typography.families.bold, fontSize: 25, letterSpacing: -0.5 },
  successText: { color: '#CFC3D2', textAlign: 'center', fontSize: 16, lineHeight: 24 },
  emailBold: { color: '#FFFFFF', fontFamily: typography.families.bold },
  successHint: { color: '#AFA3B8', textAlign: 'center', fontSize: 14, lineHeight: 20 },
  textButton: { paddingVertical: 8, alignItems: 'center' },
  textButtonText: { fontSize: 15, fontFamily: typography.families.bold },
  footer: { alignItems: 'center', gap: 10, paddingTop: 14 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  footerText: { color: '#AFA3B8', fontSize: 15 },
  switchLink: { fontSize: 16, fontFamily: typography.families.bold },
});