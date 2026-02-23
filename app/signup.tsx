// app/signup.tsx

import React, { useState } from 'react';
import { StyleSheet, View, TouchableOpacity, TextInput, ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform, Linking, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { spacing, borderRadius, typography, shadows } from '@/constants/design-tokens';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { signUpWithEmail } from '@/utils/supabase';

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  const router = useRouter();

  const backgroundColor = useThemeColor('background');
  const primaryColor = useThemeColor('primary');
  const textColor = useThemeColor('text');
  const lightTextColor = useThemeColor('lightText');
  const errorColor = useThemeColor('error');
  const inputBackgroundColor = useThemeColor('inputBackground');
  const inputBorderColor = useThemeColor('inputBorder');
  const white = useThemeColor('white');

  const handleSignup = async () => {
    // Validation
    if (!email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!acceptTerms) {
      Alert.alert('Terms Required', 'Please accept the Terms of Service and Privacy Policy to continue');
      return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      // Sign up with Supabase
      const { data, error } = await signUpWithEmail(email, password);

      if (error) {
        // Check for specific error types
        if (error.message?.toLowerCase().includes('email')) {
          Alert.alert(
            'Email Already Registered',
            'An account with this email already exists. Please login or use a different email address.',
            [
              { text: 'Login Instead', onPress: () => router.push('/login') },
              { text: 'OK', style: 'cancel' }
            ]
          );
          setIsLoading(false);
          return;
        }
        throw error;
      }

      // Check if email confirmation is required
      if (!data.session) {
        // Email confirmation required
        setIsLoading(false);
        Alert.alert(
          '📧 Check Your Email!',
          `We've sent a confirmation link to ${email}. Please click the link to verify your account.`
        );
        return;
      }

      // Supabase signup successful - navigate to complete profile
      setIsLoading(false);
      router.replace('/complete-profile');

    } catch (error: any) {
      setIsLoading(false);
      Alert.alert('Signup Failed', error.message || 'An unexpected error occurred. Please try again.');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ThemedView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
              <View style={[styles.logoContainer, { backgroundColor: primaryColor, shadowColor: primaryColor }]}>
                <IconSymbol name="person.fill" size={40} color={white} />
              </View>
              <ThemedText type="heading1" style={{ fontFamily: typography.families.bold }}>Create Account</ThemedText>
              <ThemedText type="body1" style={{ color: lightTextColor }}>Join the community</ThemedText>
            </View>

            {/* Form - Email and Password only */}
            <View style={styles.form}>
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

              <View style={styles.inputContainer}>
                <ThemedText type="body2" style={{ fontWeight: '600' }}>Password</ThemedText>
                <View style={[styles.inputWrapper, { backgroundColor: inputBackgroundColor, borderColor: inputBorderColor }]}>
                  <IconSymbol name="lock" size={20} color={textColor} style={{ marginRight: spacing.sm }} />
                  <TextInput
                    style={[styles.input, { color: textColor }]}
                    placeholder="•••••••• (6+ chars)"
                    placeholderTextColor={lightTextColor}
                    value={password}
                    onChangeText={setPassword}
                    editable={!isLoading}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} disabled={isLoading}>
                    <IconSymbol name={showPassword ? "eye" : "eye-off"} size={20} color={textColor} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputContainer}>
                <ThemedText type="body2" style={{ fontWeight: '600' }}>Confirm Password</ThemedText>
                <View style={[styles.inputWrapper, { backgroundColor: inputBackgroundColor, borderColor: inputBorderColor }]}>
                  <IconSymbol name="lock" size={20} color={textColor} style={{ marginRight: spacing.sm }} />
                  <TextInput
                    style={[styles.input, { color: textColor }]}
                    placeholder="••••••••"
                    placeholderTextColor={lightTextColor}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    editable={!isLoading}
                    secureTextEntry={!showConfirmPassword}
                  />
                  <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} disabled={isLoading}>
                    <IconSymbol name={showConfirmPassword ? "eye" : "eye-off"} size={20} color={textColor} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Policy Acceptance */}
              <TouchableOpacity 
                style={styles.termsContainer} 
                onPress={() => setAcceptTerms(!acceptTerms)}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.checkbox, 
                  { borderColor: inputBorderColor, backgroundColor: acceptTerms ? primaryColor : 'transparent' }
                ]}>
                  {acceptTerms && <IconSymbol name="check" size={14} color={white} />}
                </View>
                <View style={styles.termsTextContainer}>
                  <ThemedText style={{ color: lightTextColor, fontSize: typography.sizes.body2 }}>
                    I agree to the{' '}
                  </ThemedText>
                  <TouchableOpacity onPress={() => router.push('/terms')}>
                    <ThemedText style={{ color: primaryColor, fontSize: typography.sizes.body2, fontWeight: '600' }}>Terms of Service</ThemedText>
                  </TouchableOpacity>
                  <ThemedText style={{ color: lightTextColor, fontSize: typography.sizes.body2 }}> and </ThemedText>
                  <TouchableOpacity onPress={() => router.push('/privacy')}>
                    <ThemedText style={{ color: primaryColor, fontSize: typography.sizes.body2, fontWeight: '600' }}>Privacy Policy</ThemedText>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>

              {/* Create Account Button */}
              <TouchableOpacity
                style={[styles.button, { backgroundColor: primaryColor }, isLoading && styles.buttonDisabled]}
                onPress={handleSignup}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                {isLoading ? (
                  <ActivityIndicator color={white} size="small" />
                ) : (
                  <ThemedText style={[styles.buttonText, { color: white }]}>Create Account</ThemedText>
                )}
              </TouchableOpacity>

              {/* Login Link */}
              <View style={styles.footer}>
                <ThemedText style={{ color: lightTextColor }}>Already have an account? </ThemedText>
                <TouchableOpacity onPress={() => router.push('/login')} disabled={isLoading}>
                  <ThemedText style={{ color: primaryColor, fontWeight: '600' }}>Sign In</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </ThemedView>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    marginBottom: spacing.xl,
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
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.sm,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
    marginTop: 2,
  },
  termsTextContainer: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
});
