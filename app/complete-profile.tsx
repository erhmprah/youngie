// app/complete-profile.tsx

import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, TouchableOpacity, TextInput, ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { spacing, borderRadius, typography, shadows, sizes } from '@/constants/design-tokens';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { supabase } from '@/utils/supabase';
import { authAPI } from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';

export default function CompleteProfileScreen() {
  const [username, setUsername] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [gender, setGender] = useState('');
  const [location, setLocation] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();
  const { updateUser } = useAuth();
  const skipLocationSearch = useRef(false);

  const backgroundColor = useThemeColor('background');
  const primaryColor = useThemeColor('primary');
  const textColor = useThemeColor('text');
  const lightTextColor = useThemeColor('lightText');
  const inputBackgroundColor = useThemeColor('inputBackground');
  const inputBorderColor = useThemeColor('inputBorder');
  const white = useThemeColor('white');

  // Search location with debounce
  useEffect(() => {
    if (skipLocationSearch.current || location.length < 3) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&addressdetails=1&limit=5`,
          { headers: { 'User-Agent': 'YoungieApp/1.0' } }
        );
        
        if (!response.ok) {
          setSuggestions([]);
          return;
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
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
        setDetectingLocation(false);
        return;
      }

      const hasServices = await Location.hasServicesEnabledAsync();
      if (!hasServices) {
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const inferredLocation = timeZone ? timeZone.split('/').pop()?.replace(/_/g, ' ') : null;
        setLocation(inferredLocation || 'Unknown Location');
        setDetectingLocation(false);
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

  const handleComplete = async () => {
    // Validation
    if (!username || !birthYear || !gender) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (username.length < 3) {
      Alert.alert('Error', 'Username must be at least 3 characters');
      return;
    }

    const birthYearNum = parseInt(birthYear);
    const currentYear = new Date().getFullYear();

    if (birthYearNum > currentYear) {
      Alert.alert('Error', `Birth year cannot be in the future`);
      return;
    }

    const userAge = currentYear - birthYearNum;
    if (userAge > 29) {
      Alert.alert(
        'Age Restriction',
        'This app is intended for users below 29 years old. Are you sure this is your correct age?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Continue',
            onPress: () => proceedWithCompletion(birthYearNum),
          },
        ]
      );
      return;
    }

    await proceedWithCompletion(birthYearNum);
  };

  const proceedWithCompletion = async (birthYearNum: number) => {
    setIsLoading(true);

    let user: any = null;
    try {
      // Use timeout to avoid hanging
      const userPromise = supabase.auth.getUser();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('getUser timeout')), 5000)
      );

      const result = await Promise.race([userPromise, timeoutPromise]) as any;
      user = result?.data?.user;
    } catch (e) {
      console.log('getUser timed out or failed, checking stored values');
      // Try to get from stored values
      const storedUserId = await AsyncStorage.getItem('supabaseUserId');
      const storedEmail = await AsyncStorage.getItem('userEmail');
      if (storedUserId && storedEmail) {
        user = { id: storedUserId, email: storedEmail };
      }
    }

    if (!user) {
      Alert.alert('Error', 'You must be logged in to complete your profile');
      router.replace('/login');
      return;
    }

    if (!user.email) {
      Alert.alert('Error', 'Your account does not have an email address');
      setIsLoading(false);
      return;
    }

    try {
      // Update user metadata in Supabase
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          username,
          birthYear: birthYearNum,
          gender,
          location,
          profileComplete: true,
        }
      });

      if (updateError) {
        throw updateError;
      }

      // Also save to your MongoDB backend
      let backendUserData = null;
      try {
        const response = await authAPI.completeProfile({
          supabaseUserId: user.id,
          email: user.email,
          username,
          birthYear: birthYearNum,
          gender,
          location,
        });

        // Store the backend token if returned
        if (response.data?.token) {
          await AsyncStorage.setItem('authToken', response.data.token);
          console.log('Backend token stored successfully');
        }

        // Store the session ID if returned
        if (response.data?.sessionId) {
          await AsyncStorage.setItem('sessionId', response.data.sessionId);
          console.log('Session ID stored successfully');
        }

        // Store the user data for AuthContext
        backendUserData = response.data?.user;

        if (backendUserData?.suspended) {
          await AsyncStorage.removeItem('authToken');
          await AsyncStorage.removeItem('sessionId');
          await AsyncStorage.removeItem('profileCompleted');
          await AsyncStorage.removeItem('pendingProfileCompletion');
          await AsyncStorage.removeItem('supabaseUserId');
          await AsyncStorage.removeItem('userEmail');
          try {
            await supabase.auth.signOut();
          } catch (e) {
            console.log('Supabase signOut error:', e);
          }
          Alert.alert(
            'Not Authorized',
            'You are not authorized to use this app.',
            [{ text: 'OK', onPress: async () => {
              router.replace('/login');
            }}]
          );
          setIsLoading(false);
          return;
        }
      } catch (backendError) {
        console.log('Backend sync warning:', backendError);
        // Continue anyway - profile is complete in Supabase
      }

      // Update AuthContext with user data
      if (backendUserData) {
        console.log('Updating AuthContext with user data:', backendUserData);
        updateUser(backendUserData);
      } else {
        // If no backend user data, create a basic user object from inputs
        console.log('No backend user data, creating from inputs');
        updateUser({
          _id: user.id,
          username,
          email: user.email,
          birthYear: birthYearNum,
          gender,
          location,
        });
      }

      // Mark profile as completed
      await AsyncStorage.setItem('profileCompleted', 'true');

      // Clear pending profile flag
      await AsyncStorage.removeItem('pendingProfileCompletion');

      // Success - navigate to main app
      Alert.alert(
        'Welcome to Youngie!',
        `Your profile has been created successfully.`,
        [{
          text: 'Continue',
          onPress: () => router.replace('/(tabs)')
        }]
      );

    } catch (error: any) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor }}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <ThemedView style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.logoContainer, { backgroundColor: primaryColor, shadowColor: primaryColor }]}>
              <IconSymbol name="person.fill" size={sizes.iconXLarge} color={white} />
            </View>
            <ThemedText type="heading1" style={{ fontFamily: typography.families.bold }}>Complete Your Profile</ThemedText>
            <ThemedText type="body1" style={{ color: lightTextColor }}>Tell us a bit about yourself</ThemedText>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <ThemedText type="body2" style={{ fontWeight: '600' }}>Username *</ThemedText>
              <View style={[styles.inputWrapper, { backgroundColor: inputBackgroundColor, borderColor: inputBorderColor }]}>
                 <IconSymbol name="person.fill" size={sizes.iconMedium} color={textColor} style={{ marginRight: spacing.sm }} />
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
              <ThemedText type="body2" style={{ fontWeight: '600' }}>Year of Birth *</ThemedText>
              <View style={[styles.inputWrapper, { backgroundColor: inputBackgroundColor, borderColor: inputBorderColor }]}>
                 <IconSymbol name="calendar" size={sizes.iconMedium} color={textColor} style={{ marginRight: spacing.sm }} />
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
              <ThemedText type="body2" style={{ fontWeight: '600' }}>Gender *</ThemedText>
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
              <ThemedText type="body2" style={{ fontWeight: '600' }}>Location (Optional)</ThemedText>
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
                     <IconSymbol name="location.fill" size={sizes.iconMedium} color={primaryColor} />
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

            {/* Complete Button */}
            <TouchableOpacity
              style={[styles.button, { backgroundColor: primaryColor }, isLoading && styles.buttonDisabled]}
              onPress={handleComplete}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color={white} size="small" />
              ) : (
                <ThemedText style={[styles.buttonText, { color: white }]}>Complete Profile</ThemedText>
              )}
            </TouchableOpacity>
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
    width: sizes.logoSmall,
    height: sizes.logoSmall,
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
    borderWidth: sizes.borderWidth,
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
    borderWidth: sizes.borderWidth,
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
  suggestionsDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    borderWidth: sizes.borderWidth,
    borderTopWidth: 0,
    borderBottomLeftRadius: borderRadius.md,
    borderBottomRightRadius: borderRadius.md,
    zIndex: 1000,
    marginTop: -2,
    ...shadows.md,
  },
  suggestionItem: {
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
});
