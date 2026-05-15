import React, { useState } from 'react';
import { StyleSheet, View, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { spacing, borderRadius, typography, shadows } from '@/constants/design-tokens';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function VerifyEmail() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  
  const backgroundColor = useThemeColor('background');
  const cardColor = useThemeColor('card');
  const textColor = useThemeColor('text');
  const primaryColor = useThemeColor('primary');
  const lightTextColor = useThemeColor('lightText');
  const white = useThemeColor('white');
  const inputBackgroundColor = useThemeColor('inputBackground');

  const handleResendEmail = async () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      Alert.alert('Success', 'Verification email sent!');
    }, 1000);
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor }]}>
      <View style={[styles.card, { backgroundColor: cardColor }]}>
        <View style={styles.iconContainer}>
          <View style={[styles.iconCircle, { backgroundColor: primaryColor + '20' }]}>
            <IconSymbol size={48} name="envelope.badge" color={primaryColor} />
          </View>
        </View>
        
        <ThemedText type="heading2" style={[styles.title, { color: textColor }]}>
          Verify Your Email
        </ThemedText>
        
        <ThemedText type="body1" style={[styles.subtitle, { color: lightTextColor }]}>
          We've sent a verification link to your email address. Please check your inbox and click the link to verify your account.
        </ThemedText>

        <View style={[styles.codeContainer, { backgroundColor: inputBackgroundColor }]}>
          <IconSymbol size={20} name="clock" color={lightTextColor} style={{ marginRight: spacing.sm }} />
          <ThemedText type="body2" style={{ color: lightTextColor }}>
            Verification link expires in 24 hours
          </ThemedText>
        </View>

        <TouchableOpacity 
          style={[styles.button, { backgroundColor: primaryColor }]}
          onPress={handleResendEmail}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color={white} size="small" />
          ) : (
            <ThemedText style={[styles.buttonText, { color: white }]}>
              Resend Verification Email
            </ThemedText>
          )}
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={[styles.dividerLine, { backgroundColor: inputBackgroundColor }]} />
          <ThemedText type="caption" style={[styles.dividerText, { color: lightTextColor }]}>or</ThemedText>
          <View style={[styles.dividerLine, { backgroundColor: inputBackgroundColor }]} />
        </View>

        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.replace('/login')}
        >
          <IconSymbol size={18} name="arrow.left" color={primaryColor} style={{ marginRight: spacing.xs }} />
          <ThemedText style={[styles.backButtonText, { color: primaryColor }]}>
            Back to Sign In
          </ThemedText>
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    padding: spacing.xl,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    ...shadows.md,
  },
  iconContainer: {
    marginBottom: spacing.lg,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontFamily: typography.families.bold,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.xl,
  },
  button: {
    width: '100%',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  buttonText: {
    fontSize: typography.sizes.body1,
    fontWeight: typography.families.semibold,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    paddingHorizontal: spacing.md,
    fontWeight: '500',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  backButtonText: {
    fontSize: typography.sizes.body1,
    fontWeight: '600',
  },
});