// app/verify-email.tsx

import React, { useState } from 'react';
import { StyleSheet, View, TouchableOpacity, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { spacing, typography, shadows, borderRadius } from '@/constants/design-tokens';
import { authAPI } from '@/utils/api';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const email = params.email as string;
  const [isLoading, setIsLoading] = useState(false);

  const backgroundColor = useThemeColor('background');
  const primaryColor = useThemeColor('primary');
  const textColor = useThemeColor('text');
  const lightTextColor = useThemeColor('lightText');
  const white = useThemeColor('white');

  const handleResendEmail = async () => {
    setIsLoading(true);
    try {
      await authAPI.resendVerificationEmail(email);
      Alert.alert('Success', 'A new verification email has been sent.');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.msg || 'Failed to resend email.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor }]}>
      <View style={styles.header}>
        <View style={[styles.logoContainer, { backgroundColor: primaryColor, shadowColor: primaryColor }]}>
          <IconSymbol name="envelope.open.fill" size={40} color={white} />
        </View>
        <ThemedText type="heading1" style={{ fontFamily: typography.families.bold }}>Verify Your Email</ThemedText>
        <ThemedText type="body1" style={{ color: lightTextColor, textAlign: 'center', marginTop: spacing.md }}>
          We've sent a verification link to <ThemedText style={{ fontWeight: 'bold' }}>{email}</ThemedText>. Please check your inbox and follow the link to activate your account.
        </ThemedText>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: primaryColor }]}
          onPress={() => router.replace('/login')}
        >
          <ThemedText style={[styles.buttonText, { color: white }]}>Go to Login</ThemedText>
        </TouchableOpacity>

        <View style={styles.footer}>
          <ThemedText style={{ color: lightTextColor }}>Didn't receive an email? </ThemedText>
          <TouchableOpacity onPress={handleResendEmail} disabled={isLoading}>
            <ThemedText style={{ color: primaryColor, fontWeight: '600' }}>
              {isLoading ? 'Sending...' : 'Resend Link'}
            </ThemedText>
          </TouchableOpacity>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  actions: {
    width: '100%',
    gap: spacing.lg,
  },
  button: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  buttonText: {
    fontSize: typography.sizes.title,
    fontFamily: typography.families.bold,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
  },
});
