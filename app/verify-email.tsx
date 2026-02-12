import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { spacing, borderRadius, typography } from '@/constants/design-tokens';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function VerifyEmail() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  
  const backgroundColor = useThemeColor('background');
  const textColor = useThemeColor('text');
  const primaryColor = useThemeColor('primary');
  const lightTextColor = useThemeColor('lightText');

  const handleResendEmail = async () => {
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      Alert.alert('Success', 'Verification email sent!');
    }, 1000);
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor }]}>
      <View style={styles.content}>
        <IconSymbol size={80} name="envelope.badge" color={primaryColor} style={styles.icon} />
        
        <ThemedText style={[styles.title, { color: textColor }]}>
          Verify Your Email
        </ThemedText>
        
        <ThemedText style={[styles.subtitle, { color: lightTextColor }]}>
          We've sent a verification email to your address. Please check your inbox and verify your account.
        </ThemedText>

        <TouchableOpacity 
          style={[styles.button, { backgroundColor: primaryColor }]}
          onPress={handleResendEmail}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Resend Email</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.replace('/login')}
        >
          <ThemedText style={[styles.backButtonText, { color: primaryColor }]}>
            Back to Login
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
  content: {
    alignItems: 'center',
    maxWidth: 320,
  },
  icon: {
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: typography.sizes.heading2,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  subtitle: {
    fontSize: typography.sizes.body1,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  button: {
    width: '100%',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  buttonText: {
    color: '#fff',
    fontSize: typography.sizes.body1,
    fontWeight: '600',
  },
  backButton: {
    paddingVertical: spacing.sm,
  },
  backButtonText: {
    fontSize: typography.sizes.body1,
  },
});
