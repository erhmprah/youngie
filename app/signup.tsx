import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, TouchableOpacity, TextInput, ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
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
  const [birthYear, setBirthYear] = useState('');
  const [gender, setGender] = useState('');
  const [location, setLocation] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [validatingUsername, setValidatingUsername] = useState(false);
  const [validatingEmail, setValidatingEmail] = useState(false);
  const router = useRouter();
  const { register, isLoading } = useAuth();
  const skipLocationSearch = useRef(false);

  const backgroundColor = useThemeColor('background');
  const primaryColor = useThemeColor('primary');
  const textColor = useThemeColor('text');
  const lightTextColor = useThemeColor('lightText');
  const successColor = useThemeColor('success');
  const errorColor = useThemeColor('error');
  const inputBackgroundColor = useThemeColor('inputBackground');
  const inputBorderColor = useThemeColor('inputBorder');
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
    if (!username || !email || !birthYear || !gender) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    
    if (!password) {
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
      Alert.alert('Signup Failed', error.toString());
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
                <ThemedText type="body2" style={{ fontWeight: '600' }}>
                  Email
                </ThemedText>
                {validatingEmail && <ActivityIndicator size="small" color={primaryColor} />}
              </View>
              <View style={[styles.inputWrapper, {
                backgroundColor: inputBackgroundColor,
                borderColor: emailError ? errorColor : inputBorderColor
              }]}>
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
                  onChangeText={setPassword}
                  editable={!isLoading}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} disabled={isLoading}>
                  <IconSymbol name={showPassword ? "eye" : "eye-off"} size={20} color={textColor} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Create Account Button */}
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
});
