// app/forgot-password.tsx

import React, { useState } from 'react';
import { StyleSheet, View, TouchableOpacity, TextInput, ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { spacing, borderRadius, typography, shadows } from '@/constants/design-tokens';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { authAPI } from '@/utils/api';
import GoogleSignInButton from '@/components/google-signin-button';
import { signInWithGoogle, getSession, handleOAuthCallback, supabase } from '@/utils/supabase';

export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams();
  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [isGoogleUser, setIsGoogleUser] = useState(false);
  const [emailChecked, setEmailChecked] = useState(false);
  const [accountExists, setAccountExists] = useState<boolean | null>(null);
  
  const router = useRouter();
  
  const backgroundColor = useThemeColor('background');
  const primaryColor = useThemeColor('primary');
  const textColor = useThemeColor('text');
  const lightTextColor = useThemeColor('lightText');
  const inputBackgroundColor = useThemeColor('inputBackground');
  const inputBorderColor = useThemeColor('inputBorder');
  const white = useThemeColor('white');

  // Check if email belongs to a Google user and verify account exists
  const checkIfGoogleUser = async (emailToCheck: string) => {
    if (!emailToCheck) return;
    
    setIsLoading(true);
    try {
      const response = await authAPI.checkGoogleUser(emailToCheck);
      setIsGoogleUser(response.data.isGoogleUser);
      setAccountExists(true);
      setEmailChecked(true);
    } catch (error: any) {
      // No account found with this email
      setIsGoogleUser(false);
      setAccountExists(false);
      setEmailChecked(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    // First check if email is provided and verify account exists
    if (!email) {
      Alert.alert('Error', 'Please enter your email address first');
      return;
    }

    // Check if email exists in our system
    await checkIfGoogleUser(email);
    
    if (!accountExists) {
      Alert.alert(
        'No Account Found',
        'No account was found with this email. Would you like to sign up instead?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign Up', onPress: () => router.push('/signup') }
        ]
      );
      return;
    }

    // If account exists but is not a Google account, show error
    if (!isGoogleUser) {
      Alert.alert(
        'Email/Password Account',
        'This account uses email and password. Please use the reset link option below instead.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    // Now proceed with Google sign-in
    setGoogleLoading(true);
    try {
      const result = await signInWithGoogle();
      
      if (result?.error) {
        Alert.alert('Sign-in Failed', 'An error occurred while signing in with Google.');
        setGoogleLoading(false);
        return;
      }

      if (result?.data?.url) {
        console.log('Opening OAuth URL:', result.data.url);
        
        const { WebBrowser } = require('expo-web-browser');
        const browserResult = await WebBrowser.openAuthSessionAsync(
          result.data.url,
          'youngie://'
        );

        if (browserResult.type === 'success') {
          await handleOAuthCallback(browserResult.url);
        } else if (browserResult.type === 'cancel') {
          setGoogleLoading(false);
          return;
        }
      }
      
      // Get user info after successful sign in
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setIsGoogleUser(true);
        // Navigate to set password screen
        router.replace(`/reset-password?google=true&email=${encodeURIComponent(user.email || '')}`);
      }
      
      setGoogleLoading(false);
    } catch (error: any) {
      console.error('Google sign in error:', error);
      Alert.alert('Sign-in Failed', 'An error occurred while signing in with Google.');
      setGoogleLoading(false);
    }
  };

  const handleSendResetLink = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    try {
      const response = await authAPI.forgotPassword(email);
      
      // Check if there's a reset token in the response (development mode)
      if (response.data.resetToken) {
        setResetToken(response.data.resetToken);
        setIsEmailSent(true);
        Alert.alert(
          'Reset Link Sent (Development Mode)',
          `A reset link would be sent to your email. For development, use this token: ${response.data.resetToken}`
        );
      } else {
        setIsEmailSent(true);
        Alert.alert(
          'Reset Link Sent',
          'If an account exists with this email, a password reset link has been sent. Please check your inbox.'
        );
      }
    } catch (error: any) {
      console.error('Forgot password error:', error);
      Alert.alert(
        'Error',
        error.response?.data?.msg || 'Failed to send reset link. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Development mode: Allow entering token directly
  const handleDevReset = async () => {
    if (!resetToken) {
      Alert.alert('Error', 'Please enter a reset token');
      return;
    }
    
    router.replace(`/reset-password?token=${encodeURIComponent(resetToken)}&email=${encodeURIComponent(email)}`);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor }}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <ThemedView style={styles.container}>
          {/* Header Section */}
          <View style={styles.header}>
            <View style={[styles.logoContainer, { backgroundColor: primaryColor, shadowColor: primaryColor }]}>
              <IconSymbol name="lock.fill" size={40} color={white} />
            </View>
            <ThemedText type="heading1" style={{ fontFamily: typography.families.bold }}>Reset Password</ThemedText>
            <ThemedText type="body1" style={{ color: lightTextColor, textAlign: 'center' }}>
              Sign in with Google to set a password for your account
            </ThemedText>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Email Verification Section */}
            <View style={styles.inputContainer}>
              <ThemedText type="body2" style={{ fontWeight: '600' }}>Email</ThemedText>
              <View style={[styles.inputWrapper, { backgroundColor: inputBackgroundColor, borderColor: inputBorderColor }]}>
                <IconSymbol name="at-sign" size={20} color={textColor} style={{ marginRight: spacing.sm }} />
                <TextInput
                  style={[styles.input, { color: textColor }]}
                  placeholder="your@email.com"
                  placeholderTextColor={lightTextColor}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    setEmailChecked(false);
                    setAccountExists(null);
                  }}
                  editable={!isLoading}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>

            {/* Check Email Status */}
            {emailChecked && accountExists !== null && (
              <View style={[
                styles.statusContainer, 
                { backgroundColor: isGoogleUser ? '#dbeafe' : '#fef3c7', borderColor: isGoogleUser ? '#3b82f6' : '#f59e0b' }
              ]}>
                <IconSymbol 
                  name={isGoogleUser ? 'check-circle' : 'alert-circle'} 
                  size={20} 
                  color={isGoogleUser ? '#3b82f6' : '#f59e0b'} 
                />
                <ThemedText style={{ color: textColor, marginLeft: spacing.sm, flex: 1 }}>
                  {isGoogleUser 
                    ? 'This account was created with Google. Sign in with Google to set a password.'
                    : 'This account uses email and password. Use the reset link below.'
                  }
                </ThemedText>
              </View>
            )}

            {/* Google Sign In Section - Only show if email is a Google user */}
            {emailChecked && isGoogleUser && (
              <View style={[styles.googleSection, { backgroundColor: inputBackgroundColor, borderColor: inputBorderColor }]}>
                <ThemedText type="body2" style={{ color: lightTextColor, marginBottom: spacing.lg }}>
                  Sign in with Google to create a password for your account.
                </ThemedText>
                
                <GoogleSignInButton 
                  onPress={handleGoogleSignIn}
                  disabled={isLoading || googleLoading}
                  label={googleLoading ? "Signing in..." : "Sign in with Google"}
                />
              </View>
            )}

            {/* Divider - Only show if not showing Google option */}
            {(!emailChecked || !isGoogleUser) && (
              <View style={styles.divider}>
                <View style={[styles.dividerLine, { backgroundColor: inputBorderColor }]} />
                <ThemedText style={[styles.dividerText, { color: lightTextColor }]}>OR</ThemedText>
                <View style={[styles.dividerLine, { backgroundColor: inputBorderColor }]} />
              </View>
            )}

            {/* Email/Password Reset Section */}
            {(!emailChecked || !isGoogleUser) && (
              <>
                <ThemedText type="body2" style={{ fontWeight: '600', marginBottom: spacing.sm }}>
                  Reset with Email Link
                </ThemedText>
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: primaryColor }, isLoading && styles.buttonDisabled]}
                  onPress={handleSendResetLink}
                  disabled={isLoading}
                  activeOpacity={0.8}
                >
                  {isLoading ? (
                    <ActivityIndicator color={white} size="small" />
                  ) : (
                    <ThemedText style={[styles.buttonText, { color: white }]}>Send Reset Link</ThemedText>
                  )}
                </TouchableOpacity>
              </>
            )}

            {/* Development Mode: Show token and navigate button */}
            {resetToken ? (
              <View style={[styles.devContainer, { backgroundColor: inputBackgroundColor, borderColor: inputBorderColor }]}>
                <ThemedText type="body2" style={{ fontWeight: '600', color: primaryColor }}>
                  Development Mode
                </ThemedText>
                <ThemedText type="caption" style={{ color: lightTextColor, marginBottom: spacing.sm }}>
                  Token: {resetToken.substring(0, 20)}...
                </ThemedText>
                <TouchableOpacity
                  style={[styles.secondaryButton, { borderColor: primaryColor }]}
                  onPress={handleDevReset}
                  activeOpacity={0.8}
                >
                  <ThemedText style={{ color: primaryColor }}>Continue to Reset Password</ThemedText>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Back to Login */}
            <View style={styles.footer}>
              <View style={styles.backContainer}>
                <ThemedText style={{ color: lightTextColor }}>Remember your password? </ThemedText>
                <TouchableOpacity onPress={() => router.back()}>
                  <ThemedText style={{ color: primaryColor, fontWeight: '600' }}>Sign In</ThemedText>
                </TouchableOpacity>
              </View>
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
  googleSection: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    paddingHorizontal: spacing.sm,
    fontSize: typography.sizes.caption,
  },
  inputContainer: {
    gap: spacing.sm,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: spacing.sm,
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
  devContainer: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  secondaryButton: {
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  footer: {
    marginTop: spacing.md,
  },
  backContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
