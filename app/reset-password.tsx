// app/reset-password.tsx

import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, TextInput, ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform, Linking, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { spacing, borderRadius, typography, shadows } from '@/constants/design-tokens';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { supabase } from '@/utils/supabase';
import { authAPI } from '@/utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/AuthContext';

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams();
  const token = typeof params.token === 'string' ? params.token : '';
  const email = typeof params.email === 'string' ? params.email : '';
  const isGoogleUser = params.google === 'true';
  const accessToken = typeof params.access_token === 'string' ? params.access_token : '';
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<{ level: number; label: string; color: string } | null>(null);
  const [isSupabaseReset, setIsSupabaseReset] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  
  const router = useRouter();
  const { updateUser } = useAuth();
  
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

  // Validate token on mount and check for Supabase access token
  useEffect(() => {
    const validateToken = async () => {
      // First check params from Expo Router (may not be available on initial deep link load)
      if (accessToken) {
        setIsSupabaseReset(true);
        // Set the session with the access token
        supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: '',
        }).then(({ error }) => {
          if (error) {
            console.error('Error setting Supabase session:', error);
          }
        });
        return;
      }
      
      // For deep links, we need to get the URL directly
      try {
        const initialUrl = await Linking.getInitialURL();
        console.log('Reset password initial URL:', initialUrl);
        console.log('All URL params:', Object.fromEntries(new URL(initialUrl || 'http://x').searchParams));
        
        if (initialUrl) {
          // Parse the URL to extract parameters - handle both query params and hash
          let urlToParse = initialUrl;
          
          // Check if tokens are in the hash (Supabase sometimes uses hash)
          if (initialUrl.includes('#')) {
            const hashPart = initialUrl.split('#')[1];
            urlToParse = '?' + hashPart.replace(/&/g, '&');
          }
          
          const urlObj = new URL(urlToParse);
          const urlAccessToken = urlObj.searchParams.get('access_token') || urlObj.searchParams.get('accessToken');
          const urlRefreshToken = urlObj.searchParams.get('refresh_token') || urlObj.searchParams.get('refreshToken');
          const urlToken = urlObj.searchParams.get('token');
          const urlEmail = urlObj.searchParams.get('email');
          const urlGoogle = urlObj.searchParams.get('google');
          const urlType = urlObj.searchParams.get('type');
          
          // Handle deep link format: youngie://reset-password?token=xxx
          // The token might be passed differently when app is opened via custom scheme
          const deepLinkToken = urlObj.searchParams.get('token') || urlObj.searchParams.get('access_token');
          
          console.log('URL params - access_token:', !!urlAccessToken, 'refresh_token:', !!urlRefreshToken, 'token:', !!urlToken, 'deepLinkToken:', !!deepLinkToken, 'type:', urlType, 'fullUrl:', urlToParse);
          
          // If we have an access_token from the URL, this is a Supabase password reset
          // Also handle 'token' parameter which Supabase uses
          const supabaseToken = urlAccessToken || urlToken;
          if (supabaseToken) {
            console.log('Setting Supabase session with token:', !!supabaseToken);
            setIsSupabaseReset(true);
            supabase.auth.setSession({
              access_token: supabaseToken,
              refresh_token: urlRefreshToken || '',
            }).then(({ error }) => {
              if (error) {
                console.error('Error setting Supabase session:', error.message);
              } else {
                console.log('Supabase session set successfully');
              }
            });
            return;
          }
          
          // Check for token - support both 'token' (Supabase) and 'access_token'
          const hasValidToken = urlToken || urlAccessToken;
          console.log('Token check:', { urlToken: !!urlToken, urlAccessToken: !!urlAccessToken, hasValidToken });
          
          if (!hasValidToken && !urlGoogle) {
            // Try to parse the redirect_to URL for token
            const redirectTo = urlObj.searchParams.get('redirect_to');
            if (redirectTo) {
              console.log('Redirect to:', redirectTo);
              // Try to extract params from redirect_to
              try {
                const redirectUrl = new URL(redirectTo);
                const redirectToken = redirectUrl.searchParams.get('token') || redirectUrl.searchParams.get('access_token');
                if (redirectToken) {
                  console.log('Found token in redirect_to:', !!redirectToken);
                  setIsSupabaseReset(true);
                  return;
                }
              } catch (e) {}
            }
            Alert.alert(
              'Invalid Link',
              'This password reset link is invalid or has expired.',
              [{ text: 'OK', onPress: () => router.push('/login') }]
            );
          }
        } else if (!isGoogleUser && !token) {
          // No URL and no token - invalid link
          Alert.alert(
            'Invalid Link',
            'This password reset link is invalid or has expired.',
            [{ text: 'OK', onPress: () => router.push('/login') }]
          );
        }
      } catch (error) {
        console.error('Error parsing reset password URL:', error);
        
        // If we can't parse the URL and don't have params, show error
        if (!accessToken && !token && !isGoogleUser) {
          Alert.alert(
            'Invalid Link',
            'This password reset link is invalid or has expired.',
            [{ text: 'OK', onPress: () => router.push('/login') }]
          );
        }
      }
    };
    
    validateToken().finally(() => setIsValidating(false));
  }, [token, isGoogleUser, accessToken, router]);

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
      if (isSupabaseReset) {
        // Supabase password reset
        const { error } = await supabase.auth.updateUser({
          password: newPassword
        });
        
        if (error) throw error;
        
        // Also sync to MongoDB backend
        try {
          // Get the current user
          const { data: { user: supabaseUser } } = await supabase.auth.getUser();
          
          if (supabaseUser?.email) {
            // Try to update password in MongoDB
            await authAPI.setPassword(supabaseUser.email, newPassword);
          }
        } catch (syncError) {
          console.log('MongoDB sync warning:', syncError);
          // Continue anyway - password is reset in Supabase
        }
        
        Alert.alert(
          'Password Reset Successful',
          'Your password has been reset. You can now sign in with your new password.',
          [{ text: 'OK', onPress: () => router.push('/login') }]
        );
      } else if (isGoogleUser) {
        // Set password for Google user
        await authAPI.setPassword(email, newPassword);
        Alert.alert(
          'Password Set Successfully',
          'You can now sign in with your email and password.',
          [{ text: 'OK', onPress: () => router.push('/login') }]
        );
      } else {
        // Regular password reset via backend
        await authAPI.resetPassword(token, newPassword);
        Alert.alert(
          'Password Reset Successful',
          'Your password has been reset. You can now sign in with your new password.',
          [{ text: 'OK', onPress: () => router.push('/login') }]
        );
      }
    } catch (error: any) {
      console.log('Password reset issue, handling gracefully');
      Alert.alert(
        'Error',
        'Something went wrong. Please try again later.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading while validating the URL
  if (isValidating) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={primaryColor} />
        <ThemedText style={{ marginTop: spacing.md, color: lightTextColor }}>
          Validating reset link...
        </ThemedText>
      </ThemedView>
    );
  }

  if (!isSupabaseReset && !isGoogleUser && !token) {
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
            <View style={styles.logoContainer}>
              <Image 
                source={require('@/assets/images/youngie_icon.png')} 
                style={styles.logoImage}
                resizeMode="contain"
              />
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
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  logoImage: {
    width: 100,
    height: 100,
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
