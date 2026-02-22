// app/login.tsx

import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, TextInput, ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { spacing, borderRadius, typography, shadows } from '@/constants/design-tokens';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { signInWithEmail, supabase } from '@/utils/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '@/utils/api';


export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // Check for existing Supabase session on mount
  useEffect(() => {
    const checkSupabaseSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          // Check if user has MongoDB token
          const mongoToken = await AsyncStorage.getItem('authToken');
          const profileCompleted = await AsyncStorage.getItem('profileCompleted');
          
          // If we have a valid MongoDB token, user is logged in - go to tabs
          if (mongoToken) {
            router.replace('/(tabs)');
            return;
          }
          
          // If there's no MongoDB token, check if this is a new user or a failed login
          if (!mongoToken) {
            // Check if there's a pending profile completion flag
            const pendingProfile = await AsyncStorage.getItem('pendingProfileCompletion');
            
            if (pendingProfile === 'true') {
              // User was in the middle of completing profile - continue
              await AsyncStorage.removeItem('pendingProfileCompletion');
              router.replace('/complete-profile');
              return;
            }
            
            // Otherwise, stay on login screen - user needs to log in
            // Don't automatically redirect to complete-profile on network errors
            return;
          }
        }
      } catch (error) {
        console.warn('Error checking Supabase session:', error);
        // On error, stay on login screen - don't redirect to complete-profile
      }
    };
    
    checkSupabaseSession();
  }, [router]);

  const backgroundColor = useThemeColor('background');
  const primaryColor = useThemeColor('primary');
  const textColor = useThemeColor('text');
  const lightTextColor = useThemeColor('lightText');
  const inputBackgroundColor = useThemeColor('inputBackground');
  const inputBorderColor = useThemeColor('inputBorder');
  const white = useThemeColor('white');

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setIsLoading(true);
    try {
      // Sign in with Supabase
      const { data, error } = await signInWithEmail(email, password);

      if (error) {
        const errorMessage = error.message?.toLowerCase() || '';
        
        // Check for various credential error patterns
        if (errorMessage.includes('email') || errorMessage.includes('no user') || errorMessage.includes('not found') || errorMessage.includes('invalid email')) {
          Alert.alert(
            'Login Failed',
            'No account found with this email. Please sign up first.',
            [{ text: 'Sign Up', onPress: () => router.push('/signup') }, { text: 'OK', style: 'cancel' }]
          );
          setIsLoading(false);
          return;
        }
        
        if (errorMessage.includes('password') || errorMessage.includes('invalid login') || errorMessage.includes('incorrect') || errorMessage.includes('wrong')) {
          Alert.alert('Login Failed', 'Incorrect password. Please try again.');
          setIsLoading(false);
          return;
        }
        
        // Handle invalid credentials generally
        if (errorMessage.includes('invalid') || errorMessage.includes('credentials') || errorMessage.includes('unauthorized')) {
          Alert.alert('Login Failed', 'Invalid email or password. Please check your credentials and try again.');
          setIsLoading(false);
          return;
        }
        
        throw error;
      }

      if (data?.session) {
        // Login successful with Supabase
        // Now get MongoDB JWT token
        try {
          const { data: supabaseData } = await supabase.auth.getSession();
          const accessToken = supabaseData?.session?.access_token;
          
          if (accessToken) {
            const mongoResponse = await authAPI.supabaseLogin(accessToken);
            
            // Check if response indicates network/server error
            if (!mongoResponse || !mongoResponse.data) {
              // Network error - don't redirect to complete-profile
              console.error('Invalid MongoDB response:', mongoResponse);
              Alert.alert('Connection Error', 'Unable to connect to the server. Please check your internet connection and try again.');
              setIsLoading(false);
              return;
            }
            
            if (mongoResponse.data.needsProfileCompletion) {
              // Store Supabase info and redirect to complete profile
              await AsyncStorage.setItem('supabaseUserId', mongoResponse.data.supabaseUserId);
              await AsyncStorage.setItem('userEmail', mongoResponse.data.email);
              await AsyncStorage.setItem('pendingProfileCompletion', 'true');
              setIsLoading(false);
              router.replace('/complete-profile');
              return;
            }
            
            // Store MongoDB token
            await AsyncStorage.setItem('authToken', mongoResponse.data.token);
            await AsyncStorage.setItem('sessionId', mongoResponse.data.sessionId);
            await AsyncStorage.setItem('profileCompleted', 'true');
            
            setIsLoading(false);
            router.replace('/(tabs)');
          } else {
            setIsLoading(false);
            router.replace('/(tabs)');
          }
        } catch (mongoError: any) {
          console.error('MongoDB login error:', mongoError);
          setIsLoading(false);
          // Still allow login even if MongoDB fails - they can use the app
          router.replace('/(tabs)');
        }
      }
    } catch (error: any) {
      setIsLoading(false);
      Alert.alert('Login Failed', error.message || 'An unexpected error occurred. Please try again.');
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
            <ThemedText type="heading1" style={{ fontFamily: typography.families.bold }}>Welcome Back</ThemedText>
            <ThemedText type="body1" style={{ color: lightTextColor }}>Sign in to continue</ThemedText>
          </View>

          {/* Form */}
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
                  placeholder="••••••••"
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
              <TouchableOpacity 
                onPress={() => router.push('/forgot-password')} 
                style={styles.forgotPasswordContainer}
              >
                <ThemedText style={{ color: primaryColor }}>Forgot Password?</ThemedText>
              </TouchableOpacity>
            </View>

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.button, { backgroundColor: primaryColor }, isLoading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color={white} size="small" />
              ) : (
                <ThemedText style={[styles.buttonText, { color: white }]}>Sign In</ThemedText>
              )}
            </TouchableOpacity>


            {/* Signup Section */}
            <View style={styles.footer}>
              <ThemedText style={{ color: lightTextColor }}>Don't have an account? </ThemedText>
              <TouchableOpacity onPress={() => router.push('/signup')} disabled={isLoading}>
                <ThemedText style={{ color: primaryColor, fontWeight: '600' }}>Sign Up</ThemedText>
              </TouchableOpacity>
            </View>

            {/* Policy Links */}
            <View style={styles.policyFooter}>
              <TouchableOpacity onPress={() => router.push('/terms')}>
                <ThemedText style={{ color: lightTextColor, fontSize: typography.sizes.caption }}>Terms of Service</ThemedText>
              </TouchableOpacity>
              <ThemedText style={{ color: lightTextColor, fontSize: typography.sizes.caption }}> • </ThemedText>
              <TouchableOpacity onPress={() => router.push('/privacy')}>
                <ThemedText style={{ color: lightTextColor, fontSize: typography.sizes.caption }}>Privacy Policy</ThemedText>
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
    marginBottom: spacing.xxl,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.round,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  logoImage: {
    width: 70,
    height: 70,
  },
  form: {
    gap: spacing.lg,
  },
  inputContainer: {
    gap: spacing.sm,
  },
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginTop: spacing.xs,
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
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    paddingHorizontal: spacing.sm,
    fontSize: typography.sizes.caption,
  },
  policyFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
});
