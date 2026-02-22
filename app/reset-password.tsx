// app/reset-password.tsx

import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, TextInput, ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { spacing, borderRadius, typography, shadows } from '@/constants/design-tokens';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { authAPI } from '@/utils/api';

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams();
  const token = typeof params.token === 'string' ? params.token : '';
  const email = typeof params.email === 'string' ? params.email : '';
  const isGoogleUser = params.google === 'true';
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<{ level: number; label: string; color: string } | null>(null);
  
  const router = useRouter();
  
  const backgroundColor = useThemeColor('background');
  const primaryColor = useThemeColor('primary');
  const textColor = useThemeColor('text');
  const lightTextColor = useThemeColor('lightText');
  const inputBackgroundColor = useThemeColor('inputBackground');
  const inputBorderColor = useThemeColor('inputBorder');
  const white = useThemeColor('white');

  // Calculate password strength
  const calculatePasswordStrength = (pwd: string): { level: number; label: string; color: string } => {
    if (!pwd) return { level: 0, label: '', color: 'transparent' };
    
    let score = 0;
    
    // Length checks
    if (pwd.length >= 6) score += 1;
    if (pwd.length >= 8) score += 1;
    if (pwd.length >= 12) score += 1;
    
    // Character type checks
    if (/[a-z]/.test(pwd)) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^a-zA-Z0-9]/.test(pwd)) score += 1;
    
    // Determine level and label
    if (score <= 2) return { level: 1, label: 'Weak', color: '#ef4444' };
    if (score <= 4) return { level: 2, label: 'Fair', color: '#f59e0b' };
    if (score <= 5) return { level: 3, label: 'Good', color: '#22c55e' };
    return { level: 4, label: 'Strong', color: '#16a34a' };
  };

  // Handle password change
  const handlePasswordChange = (text: string) => {
    setNewPassword(text);
    setPasswordStrength(calculatePasswordStrength(text));
  };

  // Validate token on mount (only for non-Google users)
  useEffect(() => {
    if (!isGoogleUser && !token) {
      Alert.alert(
        'Invalid Link',
        'This password reset link is invalid or has expired.',
        [{ text: 'OK', onPress: () => router.push('/login') }]
      );
    }
  }, [token, isGoogleUser]);

  const handleResetPassword = async () => {
    if (!newPassword) {
      Alert.alert('Error', 'Please enter a new password');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      if (isGoogleUser) {
        // Set password for Google user
        await authAPI.setPassword(email, newPassword);
        Alert.alert(
          'Password Set Successfully',
          'You can now sign in with your email and password.',
          [{ text: 'OK', onPress: () => router.push('/login') }]
        );
      } else {
        // Regular password reset
        await authAPI.resetPassword(token, newPassword);
        Alert.alert(
          'Password Reset Successful',
          'Your password has been reset. You can now sign in with your new password.',
          [{ text: 'OK', onPress: () => router.push('/login') }]
        );
      }
    } catch (error: any) {
      console.error('Reset password error:', error);
      Alert.alert(
        'Error',
        error.response?.data?.msg || 'Failed to reset password. The link may have expired.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!isGoogleUser && !token) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ThemedText>Invalid reset link</ThemedText>
      </ThemedView>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor }}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <ThemedView style={styles.container}>
          {/* Header Section */}
          <View style={styles.header}>
            <View style={[styles.logoContainer, { backgroundColor: primaryColor, shadowColor: primaryColor }]}>
              <IconSymbol name="lock.fill" size={40} color={white} />
            </View>
            <ThemedText type="heading1" style={{ fontFamily: typography.families.bold }}>
              {isGoogleUser ? 'Set Password' : 'New Password'}
            </ThemedText>
            <ThemedText type="body1" style={{ color: lightTextColor, textAlign: 'center' }}>
              {isGoogleUser 
                ? 'Create a password for your account to sign in with email and password'
                : 'Enter a new password for your account'
              }
            </ThemedText>
            {email && (
              <ThemedText type="body2" style={{ color: lightTextColor, textAlign: 'center', marginTop: spacing.sm }}>
                {email}
              </ThemedText>
            )}
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <ThemedText type="body2" style={{ fontWeight: '600' }}>New Password</ThemedText>
              <View style={[styles.inputWrapper, { backgroundColor: inputBackgroundColor, borderColor: inputBorderColor }]}>
                <IconSymbol name="lock" size={20} color={textColor} style={{ marginRight: spacing.sm }} />
                <TextInput
                  style={[styles.input, { color: textColor }]}
                  placeholder="Enter new password"
                  placeholderTextColor={lightTextColor}
                  value={newPassword}
                  onChangeText={handlePasswordChange}
                  editable={!isLoading}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} disabled={isLoading}>
                  <IconSymbol name={showPassword ? "eye" : "eye-off"} size={20} color={textColor} />
                </TouchableOpacity>
              </View>
              
              {/* Password Strength Indicator */}
              {passwordStrength && passwordStrength.level > 0 && (
                <View style={styles.strengthContainer}>
                  <View style={styles.strengthBar}>
                    {[1, 2, 3, 4].map((level) => (
                      <View
                        key={level}
                        style={[
                          styles.strengthSegment,
                          {
                            backgroundColor: level <= passwordStrength.level ? passwordStrength.color : '#e5e7eb',
                          },
                        ]}
                      />
                    ))}
                  </View>
                  <ThemedText style={{ color: passwordStrength.color, fontSize: typography.sizes.caption }}>
                    {passwordStrength.label}
                  </ThemedText>
                </View>
              )}
            </View>

            <View style={styles.inputContainer}>
              <ThemedText type="body2" style={{ fontWeight: '600' }}>Confirm Password</ThemedText>
              <View style={[styles.inputWrapper, { backgroundColor: inputBackgroundColor, borderColor: inputBorderColor }]}>
                <IconSymbol name="lock" size={20} color={textColor} style={{ marginRight: spacing.sm }} />
                <TextInput
                  style={[styles.input, { color: textColor }]}
                  placeholder="Confirm new password"
                  placeholderTextColor={lightTextColor}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  editable={!isLoading}
                  secureTextEntry={!showPassword}
                />
              </View>
            </View>

            {/* Reset Password Button */}
            <TouchableOpacity
              style={[styles.button, { backgroundColor: primaryColor }, isLoading && styles.buttonDisabled]}
              onPress={handleResetPassword}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color={white} size="small" />
              ) : (
                <ThemedText style={[styles.buttonText, { color: white }]}>
                  {isGoogleUser ? 'Set Password' : 'Reset Password'}
                </ThemedText>
              )}
            </TouchableOpacity>

            {/* Back to Login */}
            <View style={styles.footer}>
              <View style={styles.backContainer}>
                <ThemedText style={{ color: lightTextColor }}>Remember your password? </ThemedText>
                <TouchableOpacity onPress={() => router.push('/login')}>
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
  loadingContainer: {
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
  form: {
    gap: spacing.lg,
  },
  inputContainer: {
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
  strengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  strengthBar: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  strengthSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
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
    marginTop: spacing.md,
  },
  backContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
