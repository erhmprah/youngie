// app/forgot-password.tsx

import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, TextInput, ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { spacing, borderRadius, typography, shadows, sizes } from '@/constants/design-tokens';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { supabase, resetPassword } from '@/utils/supabase';

// List of domains that are Supabase users (you can expand this list)
const KNOWN_SUPABASE_DOMAINS = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'mail.com'];

export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams();
  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [isLoading, setIsLoading] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);
  
  const router = useRouter();
  
  const backgroundColor = useThemeColor('background');
  const primaryColor = useThemeColor('primary');
  const textColor = useThemeColor('text');
  const lightTextColor = useThemeColor('lightText');
  const inputBackgroundColor = useThemeColor('inputBackground');
  const inputBorderColor = useThemeColor('inputBorder');
  const white = useThemeColor('white');

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
      // Use Supabase to send password reset email
      const { error } = await resetPassword(email);
      // Only log a brief message, not the full error object
      console.log('Password reset failed, handling gracefully...');
      
      // Handle error properties from multiple sources
      const errorMessage = error?.message || '';
      const errorCode = (error as any)?.code || '';
      const errorRateLimit = (error as any)?.rateLimit || false;
      
      // Check for rate limiting error FIRST - use the rateLimit flag from supabase.ts
      if (errorRateLimit || 
          errorMessage.toLowerCase().includes('rate limit') || 
          errorCode.toLowerCase().includes('rate limit') ||
          errorMessage.toLowerCase().includes('too many requests')) {
        Alert.alert(
          'Please Wait',
          'You have made too many requests. Please wait a moment before trying again.'
        );
        setIsLoading(false);
        return;
      }
      
      // Check for other known Supabase errors that might crash the app
      const errorName = error?.name || '';
      if (errorName === 'AuthApiError' || (error as any)?.constructor?.name === 'AuthApiError') {
        // Don't reveal if email exists for security reasons
        setIsEmailSent(true);
        Alert.alert(
          'Reset Link Sent',
          'If an account exists with this email, a password reset link has been sent to your inbox.'
        );
        setIsLoading(false);
        return;
      }
      
      Alert.alert(
        'Error',
        'Something went wrong. Please try again later.'
      );
      setIsLoading(false);
      return;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor }}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <ThemedView style={styles.container}>
          {/* Header Section */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Image 
                source={require('@/assets/images/youngie_icon.png')} 
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <ThemedText type="heading1" style={{ fontFamily: typography.families.bold }}>Forgot Password</ThemedText>
            <ThemedText type="body1" style={{ color: lightTextColor, textAlign: 'center' }}>
              Enter your email address and we'll send you a link to reset your password.
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
                  onChangeText={setEmail}
                  editable={!isLoading}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>

            {/* Send Reset Link Button */}
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
    width: sizes.logoSmall,
    height: sizes.logoSmall,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  logoImage: {
    width: sizes.logoSmall,
    height: sizes.logoSmall,
  },
  form: {
    gap: spacing.lg,
  },
  googleSection: {
    borderWidth: sizes.dividerWidth,
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
    height: sizes.dividerWidth,
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
    borderWidth: sizes.dividerWidth,
    gap: spacing.sm,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: sizes.dividerWidth,
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
    borderWidth: sizes.dividerWidth,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  secondaryButton: {
    paddingVertical: spacing.sm,
    borderWidth: sizes.dividerWidth,
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
