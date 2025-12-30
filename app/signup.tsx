// app/signup.tsx

import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, TextInput, ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/contexts/AuthContext';
import { authAPI } from '@/utils/api';
import { useThemeColor } from '@/hooks/use-theme-color';
import { spacing, borderRadius, typography, shadows } from '@/constants/design-tokens';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function SignupScreen() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [age, setAge] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [validatingUsername, setValidatingUsername] = useState(false);
  const [validatingEmail, setValidatingEmail] = useState(false);
  const router = useRouter();
  const { register, isLoading } = useAuth();

  const backgroundColor = useThemeColor('background');
  const primaryColor = useThemeColor('primary');
  const textColor = useThemeColor('text');
  const lightTextColor = useThemeColor('lightText');
  const inputBackgroundColor = useThemeColor('inputBackground');
  const inputBorderColor = useThemeColor('inputBorder');
  const errorColor = useThemeColor('error');
  const successColor = useThemeColor('success');
  const white = useThemeColor('white');

  // Check username availability with debounce
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (username.length >= 3) {
        setValidatingUsername(true);
        try {
          const response = await authAPI.checkUsername(username);
          if (!response.data.available) {
            setUsernameError(response.data.msg);
          } else {
            setUsernameError('');
          }
        } catch (error) {
          setUsernameError('');
        } finally {
          setValidatingUsername(false);
        }
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [username]);

  // Check email availability with debounce
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (email.includes('@')) {
        setValidatingEmail(true);
        try {
          const response = await authAPI.checkEmail(email);
          if (!response.data.available) {
            setEmailError(response.data.msg);
          } else {
            setEmailError('');
          }
        } catch (error) {
          setEmailError('');
        } finally {
          setValidatingEmail(false);
        }
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [email]);

  const handleSignup = async () => {
    if (!username || !email || !password || !age) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (usernameError) {
      Alert.alert('Error', 'Username is already taken');
      return;
    }
    if (emailError) {
      Alert.alert('Error', 'Email is already registered');
      return;
    }
    const ageNum = parseInt(age);
    if (ageNum < 13 || ageNum > 18) {
      Alert.alert('Error', 'Age must be between 13 and 18');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    try {
      await register(username, email, password, ageNum);
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert('Signup Failed', error.message || 'Please try again');
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor }}>
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

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <View style={styles.labelRow}>
                <ThemedText type="body2" style={{ fontWeight: '600' }}>Username</ThemedText>
                {validatingUsername && <ActivityIndicator size="small" color={primaryColor} />}
              </View>
              <View style={[styles.inputWrapper, { backgroundColor: inputBackgroundColor, borderColor: usernameError ? errorColor : inputBorderColor }]}>
                <IconSymbol name="person.fill" size={20} color={textColor} style={{ marginRight: spacing.sm }} />
                <TextInput
                  style={[styles.input, { color: textColor }]}
                  placeholder="Choose a username (3+ chars)"
                  placeholderTextColor={lightTextColor}
                  value={username}
                  onChangeText={setUsername}
                  editable={!isLoading}
                  autoCapitalize="none"
                />
              </View>
              {usernameError ? <ThemedText style={[styles.errorText, { color: errorColor }]}>{usernameError}</ThemedText> :
                (username.length >= 3 && !validatingUsername && <ThemedText style={[styles.successText, { color: successColor }]}>Username available</ThemedText>)}
            </View>

            <View style={styles.inputContainer}>
              <View style={styles.labelRow}>
                <ThemedText type="body2" style={{ fontWeight: '600' }}>Email</ThemedText>
                {validatingEmail && <ActivityIndicator size="small" color={primaryColor} />}
              </View>
              <View style={[styles.inputWrapper, { backgroundColor: inputBackgroundColor, borderColor: emailError ? errorColor : inputBorderColor }]}>
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
              {emailError ? <ThemedText style={[styles.errorText, { color: errorColor }]}>{emailError}</ThemedText> :
                (email.includes('@') && !validatingEmail && <ThemedText style={[styles.successText, { color: successColor }]}>Email available</ThemedText>)}
            </View>

            <View style={styles.inputContainer}>
              <ThemedText type="body2" style={{ fontWeight: '600' }}>Age (13-18)</ThemedText>
              <View style={[styles.inputWrapper, { backgroundColor: inputBackgroundColor, borderColor: inputBorderColor }]}>
                <IconSymbol name="calendar" size={20} color={textColor} style={{ marginRight: spacing.sm }} />
                <TextInput
                  style={[styles.input, { color: textColor }]}
                  placeholder="16"
                  placeholderTextColor={lightTextColor}
                  value={age}
                  onChangeText={setAge}
                  editable={!isLoading}
                  keyboardType="number-pad"
                  maxLength={2}
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

            <TouchableOpacity
              style={[styles.button, { backgroundColor: primaryColor }, (isLoading || !!usernameError || !!emailError) && styles.buttonDisabled]}
              onPress={handleSignup}
              disabled={isLoading || !!usernameError || !!emailError}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color={white} size="small" />
              ) : (
                <ThemedText style={[styles.buttonText, { color: white }]}>Create Account</ThemedText>
              )}
            </TouchableOpacity>

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
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  errorText: {
    fontSize: typography.sizes.caption,
    marginTop: spacing.xs,
  },
  successText: {
    fontSize: typography.sizes.caption,
    marginTop: spacing.xs,
  },
});