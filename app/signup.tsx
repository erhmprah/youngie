import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, TouchableOpacity, TextInput, ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeColor } from '@/hooks/use-theme-color';
import { spacing, borderRadius, typography, shadows } from '@/constants/design-tokens';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { authAPI } from '@/utils/api';

export default function SignupScreen() {
  const params = useLocalSearchParams();
  const [username, setUsername] = useState(typeof params.name === 'string' ? params.name : '');
  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [emailVerified, setEmailVerified] = useState(!!params.email); // Track if email came from OAuth (therefore verified)
  const [password, setPassword] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [gender, setGender] = useState('');
  const [location, setLocation] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  
  // Email validation states
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);
  const [hasBlurredEmail, setHasBlurredEmail] = useState(false);
  
  // Password strength states
  const [passwordStrength, setPasswordStrength] = useState<{ level: number; label: string; color: string } | null>(null);
  
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
    if (score <= 2) return { level: 1, label: 'Weak', color: '#ef4444' }; // red
    if (score <= 4) return { level: 2, label: 'Fair', color: '#f59e0b' }; // amber
    if (score <= 5) return { level: 3, label: 'Good', color: '#22c55e' }; // green
    return { level: 4, label: 'Strong', color: '#16a34a' }; // green-600
  };
  
  // Handle password change
  const handlePasswordChange = (text: string) => {
    setPassword(text);
    setPasswordStrength(calculatePasswordStrength(text));
  };
  
  const router = useRouter();
  const { register, isLoading } = useAuth();
  const skipLocationSearch = useRef(false);
  const validationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const backgroundColor = useThemeColor('background');
  const primaryColor = useThemeColor('primary');
  const textColor = useThemeColor('text');
  const lightTextColor = useThemeColor('lightText');
  const successColor = useThemeColor('success');
  const errorColor = useThemeColor('error');
  const inputBackgroundColor = useThemeColor('inputBackground');
  const inputBorderColor = useThemeColor('inputBorder');
  const white = useThemeColor('white');

  // Email validation function
  const validateEmail = useCallback(async (emailToValidate: string) => {
    // Don't validate if email is empty or from OAuth (already verified)
    if (!emailToValidate || emailVerified) {
      setEmailError(null);
      setEmailAvailable(null);
      return true;
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailToValidate)) {
      setEmailError('Please enter a valid email address');
      setEmailAvailable(null);
      return false;
    }

    setEmailLoading(true);
    setEmailError(null);

    try {
      const response = await authAPI.checkEmail(emailToValidate);
      if (response.data.available) {
        setEmailAvailable(true);
        setEmailError(null);
        setEmailLoading(false);
        return true;
      } else {
        setEmailAvailable(false);
        setEmailError(response.data.msg || 'An account with this email already exists');
        setEmailLoading(false);
        return false;
      }
    } catch (error: any) {
      console.error('Email validation error:', error);
      // Don't block registration on validation error - allow user to try
      setEmailLoading(false);
      setEmailAvailable(null);
      return true;
    }
  }, [emailVerified]);

  // Handle email blur for synchronous validation
  const handleEmailBlur = useCallback(() => {
    setHasBlurredEmail(true);
    if (email && !emailVerified) {
      validateEmail(email);
    }
  }, [email, emailVerified, validateEmail]);

  // Handle email change - clear previous errors
  const handleEmailChange = (text: string) => {
    setEmail(text);
    // Clear validation state when user starts typing
    if (emailError || emailAvailable !== null) {
      setEmailError(null);
      setEmailAvailable(null);
    }
    // Clear blur state when user starts typing again
    if (hasBlurredEmail) {
      setHasBlurredEmail(false);
    }
  };


  // Search location with debounce
  useEffect(() => {
    if (skipLocationSearch.current || location.length < 3) {
      setSuggestions([]);
      return;
    }

     const timer = setTimeout(async () => {
      try {
        // Using OpenStreetMap Nominatim API (No API key required)
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&addressdetails=1&limit=5`,
          { headers: { 'User-Agent': 'YoungieApp/1.0' } }
        );
        
        if (!response.ok) {
          console.log('Location search error: HTTP', response.status);
          setSuggestions([]);
          return;
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.log('Location search error: Expected JSON response, got', contentType);
          setSuggestions([]);
          return;
        }

        const data = await response.json();

        if (Array.isArray(data)) {
          const places = data.map((item: any) => {
            const addr = item.address;
            const city = addr.city || addr.town || addr.village || addr.municipality || item.name;
            const country = addr.country;
            return city && country ? `${city}, ${country}` : item.display_name.split(',').slice(0, 2).join(',');
          });
          setSuggestions([...new Set(places)] as string[]);
        }
      } catch (error) {
        console.log('Location search error:', error);
        setSuggestions([]);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [location]);

  const detectLocation = async () => {
    setDetectingLocation(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const inferredLocation = timeZone ? timeZone.split('/').pop()?.replace(/_/g, ' ') : null;
        setLocation(inferredLocation || 'Unknown Location');
        return;
      }

      const hasServices = await Location.hasServicesEnabledAsync();
      if (!hasServices) {
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const inferredLocation = timeZone ? timeZone.split('/').pop()?.replace(/_/g, ' ') : null;
        setLocation(inferredLocation || 'Unknown Location');
        return;
      }

      let locationData = await Location.getLastKnownPositionAsync({});

      if (!locationData) {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Location detection timeout')), 5000)
        );

        const locationPromise = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        locationData = await Promise.race([locationPromise, timeoutPromise]) as any;
      }

      if (locationData && locationData.coords) {
        let address = await Location.reverseGeocodeAsync({
          latitude: locationData.coords.latitude,
          longitude: locationData.coords.longitude,
        });
        if (address.length > 0) {
          const addr = address[0];
          const loc = `${addr.city || addr.region || ''}, ${addr.country || ''}`.trim();
          setLocation(loc || 'Unknown Location');
        } else {
          setLocation('Unknown Location');
        }
      } else {
        setLocation('Unknown Location');
      }
    } catch (error: any) {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const inferredLocation = timeZone ? timeZone.split('/').pop()?.replace(/_/g, ' ') : null;
      setLocation(inferredLocation || 'Unknown Location');
    } finally {
      setDetectingLocation(false);
    }
  };

  const handleLocationChange = (text: string) => {
    skipLocationSearch.current = false;
    setLocation(text);
  };

  const selectSuggestion = (city: string) => {
    skipLocationSearch.current = true;
    setLocation(city);
    setSuggestions([]);
  };

  const handleSignup = async () => {
    // First, validate email if not already validated (from OAuth)
    if (!emailVerified && email) {
      const isEmailValid = await validateEmail(email);
      if (!isEmailValid) {
        // Email is already registered - show error and don't proceed
        Alert.alert(
          'Email Already Registered',
          'An account with this email already exists. Please login instead or use a different email address.',
          [
            { text: 'Login Instead', onPress: () => router.push('/login') },
            { text: 'OK', style: 'cancel' }
          ]
        );
        return;
      }
    }

    if (!username || !email || !birthYear || !gender || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    const birthYearNum = parseInt(birthYear);
    const currentYear = new Date().getFullYear();
    if (birthYearNum < 1997 || birthYearNum > currentYear) {
      Alert.alert('Error', `Birth year must be between 1997 and ${currentYear}`);
      return;
    }

    try {
      await register(username, email, password, birthYearNum, gender, location);
      // User is automatically logged in after registration
      router.replace('/(tabs)');
    } catch (error: any) {
      // Check if error indicates email already exists
      const errorStr = error.toString().toLowerCase();
      if (errorStr.includes('email') && (errorStr.includes('exists') || errorStr.includes('already'))) {
        setEmailError('An account with this email already exists');
        setEmailAvailable(false);
        Alert.alert(
          'Email Already Registered',
          'An account with this email already exists. Please login instead.',
          [
            { text: 'Login Instead', onPress: () => router.push('/login') },
            { text: 'OK', style: 'cancel' }
          ]
        );
      } else {
        Alert.alert('Signup Failed', error.toString());
      }
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
              <ThemedText type="body2" style={{ fontWeight: '600' }}>Username</ThemedText>
              <View style={[styles.inputWrapper, { backgroundColor: inputBackgroundColor, borderColor: inputBorderColor }]}>
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
            </View>

            <View style={styles.inputContainer}>
              <ThemedText type="body2" style={{ fontWeight: '600' }}>Email</ThemedText>
              <View style={[
                styles.inputWrapper, 
                { backgroundColor: inputBackgroundColor, borderColor: inputBorderColor },
                emailError ? { borderColor: errorColor } : emailAvailable ? { borderColor: successColor } : {}
              ]}>
                <IconSymbol name="at-sign" size={20} color={textColor} style={{ marginRight: spacing.sm }} />
                <TextInput
                  style={[styles.input, { color: textColor }]}
                  placeholder="your@email.com"
                  placeholderTextColor={lightTextColor}
                  value={email}
                  onChangeText={handleEmailChange}
                  onBlur={handleEmailBlur}
                  editable={!isLoading && !params.email}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                {emailLoading && (
                  <ActivityIndicator size="small" color={primaryColor} style={{ marginLeft: spacing.sm }} />
                )}
                {!emailLoading && emailAvailable === true && (
                  <View style={[styles.verifiedBadge, { backgroundColor: successColor }]}>
                    <IconSymbol name="check" size={12} color={white} />
                  </View>
                )}
                {!emailLoading && emailError && (
                  <IconSymbol name="alert-circle" size={20} color={errorColor} style={{ marginLeft: spacing.sm }} />
                )}
              </View>
              {emailVerified && (
                <ThemedText type="caption" style={{ color: successColor, marginTop: spacing.xs }}>
                  ✓ Verified via Google
                </ThemedText>
              )}
              {emailError && (
                <View style={{ marginTop: spacing.xs }}>
                  <ThemedText type="caption" style={{ color: errorColor }}>
                    {emailError}
                  </ThemedText>
                  {!emailVerified && (
                    <TouchableOpacity onPress={() => router.push('/login')} style={{ marginTop: spacing.xs }}>
                      <ThemedText type="caption" style={{ color: primaryColor, fontWeight: '600' }}>
                        → Login instead
                      </ThemedText>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            <View style={styles.inputContainer}>
              <ThemedText type="body2" style={{ fontWeight: '600' }}>Year of Birth</ThemedText>
              <View style={[styles.inputWrapper, { backgroundColor: inputBackgroundColor, borderColor: inputBorderColor }]}>
                <IconSymbol name="calendar" size={20} color={textColor} style={{ marginRight: spacing.sm }} />
                <TextInput
                  style={[styles.input, { color: textColor }]}
                  placeholder="1997"
                  placeholderTextColor={lightTextColor}
                  value={birthYear}
                  onChangeText={setBirthYear}
                  editable={!isLoading}
                  keyboardType="number-pad"
                  maxLength={4}
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <ThemedText type="body2" style={{ fontWeight: '600' }}>Gender</ThemedText>
              <View style={styles.genderContainer}>
                {['male', 'female', 'other'].map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[
                      styles.genderButton,
                      { backgroundColor: gender === g ? primaryColor : inputBackgroundColor, borderColor: inputBorderColor }
                    ]}
                    onPress={() => setGender(g)}
                    disabled={isLoading}
                  >
                    <ThemedText style={{ color: gender === g ? white : textColor, textTransform: 'capitalize' }}>{g}</ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={[styles.inputContainer, { zIndex: 1000 }]}>
              <ThemedText type="body2" style={{ fontWeight: '600' }}>Location</ThemedText>
              <View style={[styles.inputWrapper, { backgroundColor: inputBackgroundColor, borderColor: inputBorderColor }]}>
                <TextInput
                  style={[styles.input, { color: textColor, flex: 1 }]}
                  placeholder="Your location"
                  placeholderTextColor={lightTextColor}
                  value={location}
                  onChangeText={handleLocationChange}
                  editable={!isLoading}
                />
                <TouchableOpacity onPress={detectLocation} disabled={isLoading || detectingLocation} style={{ padding: spacing.sm }}>
                  {detectingLocation ? (
                    <ActivityIndicator size="small" color={primaryColor} />
                  ) : (
                    <IconSymbol name="location.fill" size={20} color={primaryColor} />
                  )}
                </TouchableOpacity>
              </View>
              {suggestions.length > 0 && (
                <View style={[styles.suggestionsDropdown, { backgroundColor: inputBackgroundColor, borderColor: inputBorderColor }]}>
                  {suggestions.map((city, index) => (
                    <TouchableOpacity key={index} style={styles.suggestionItem} onPress={() => selectSuggestion(city)}>
                      <ThemedText>{city}</ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
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
                <View style={{ marginTop: spacing.sm }}>
                  <View style={styles.passwordStrengthContainer}>
                    {/* Strength bars */}
                    <View style={styles.strengthBarsContainer}>
                      {[1, 2, 3, 4].map((level) => (
                        <View
                          key={level}
                          style={[
                            styles.strengthBar,
                            {
                              backgroundColor: level <= passwordStrength.level 
                                ? passwordStrength.color 
                                : inputBorderColor,
                            },
                          ]}
                        />
                      ))}
                    </View>
                    <ThemedText type="caption" style={{ color: passwordStrength.color, fontWeight: '500' }}>
                      {passwordStrength.label}
                    </ThemedText>
                  </View>
                  {/* Password requirements hints */}
                  <View style={styles.passwordHints}>
                    <ThemedText type="caption" style={{ color: lightTextColor, fontSize: 10 }}>
                      Use 8+ characters with uppercase, lowercase, numbers & symbols
                    </ThemedText>
                  </View>
                </View>
              )}
            </View>


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
  verifiedBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  genderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  genderButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
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
  suggestionsDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: borderRadius.md,
    borderBottomRightRadius: borderRadius.md,
    zIndex: 1000,
    marginTop: -2, // Overlap slightly with input border
    ...shadows.md,
  },
  suggestionItem: {
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc', // Or use theme border color if available in styles scope
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
  // Password Strength Indicator Styles
  passwordStrengthContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  strengthBarsContainer: {
    flexDirection: 'row',
    gap: spacing.xs,
    flex: 1,
    marginRight: spacing.md,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  passwordHints: {
    marginTop: spacing.xs,
  },
});
