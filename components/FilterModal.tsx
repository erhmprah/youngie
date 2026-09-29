import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  StyleSheet,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  PanResponder,
  ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { spacing, borderRadius, typography, shadows } from '@/constants/design-tokens';

export interface FilterState {
  minAge: string;
  maxAge: string;
  gender: string[];
  location: string;
  latitude?: number;
  longitude?: number;
  radius?: number;
}

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: FilterState) => void;
  initialFilters: FilterState;
}

export function FilterModal({ visible, onClose, onApply, initialFilters }: FilterModalProps) {
  const [minAge, setMinAge] = useState(initialFilters.minAge);
  const [maxAge, setMaxAge] = useState(initialFilters.maxAge);
  const [selectedGenders, setSelectedGenders] = useState<string[]>(initialFilters.gender);
  const [location, setLocation] = useState(initialFilters.location);
  const [latitude, setLatitude] = useState<number | undefined>(initialFilters.latitude);
  const [longitude, setLongitude] = useState<number | undefined>(initialFilters.longitude);
  const [radius, setRadius] = useState<string>(initialFilters.radius ? String(initialFilters.radius) : '50');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const skipLocationSearch = useRef(false);
  const [detectingLocation, setDetectingLocation] = useState(false);

  const backgroundColor = useThemeColor('background');
  const primaryColor = useThemeColor('primary');
  const textColor = useThemeColor('text');
  const lightTextColor = useThemeColor('lightText');
  const inputBackgroundColor = useThemeColor('inputBackground');
  const inputBorderColor = useThemeColor('inputBorder');
  const white = useThemeColor('white');

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      // The modal form must reset from its incoming filters when opened.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMinAge(initialFilters.minAge);
      setMaxAge(initialFilters.maxAge);
      setSelectedGenders(initialFilters.gender);
      setLocation(initialFilters.location);
      setLatitude(initialFilters.latitude);
      setLongitude(initialFilters.longitude);
      setRadius(initialFilters.radius ? String(initialFilters.radius) : '50');
    }
  }, [visible, initialFilters]);

  // Location Autocomplete Logic
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
            const name = city && country ? `${city}, ${country}` : item.display_name.split(',').slice(0, 2).join(',');
            return { name, lat: item.lat, lon: item.lon };
          });
          setSuggestions(places);
        }
      } catch {
        console.log('Location search error:', error);
        setSuggestions([]);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [location]);

  const toggleGender = (g: string) => {
    if (selectedGenders.includes(g)) {
      setSelectedGenders(selectedGenders.filter((item) => item !== g));
    } else {
      setSelectedGenders([...selectedGenders, g]);
    }
  };

  const selectSuggestion = (item: any) => {
    skipLocationSearch.current = true;
    setLocation(item.name);
    setLatitude(parseFloat(item.lat));
    setLongitude(parseFloat(item.lon));
    setSuggestions([]);
  };

  const handleApply = () => {
    onApply({ 
      minAge, 
      maxAge, 
      gender: selectedGenders, 
      location,
      latitude,
      longitude,
      radius: radius ? parseInt(radius) : undefined
    });
    onClose();
  };

  const handleClear = () => {
    setMinAge('');
    setMaxAge('');
    setSelectedGenders([]);
    setLocation('');
    setLatitude(undefined);
    setLongitude(undefined);
    setRadius('50');
  };

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

      if (locationData) {
        setLatitude(locationData.coords.latitude);
        setLongitude(locationData.coords.longitude);

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
      }
    } catch {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const inferredLocation = timeZone ? timeZone.split('/').pop()?.replace(/_/g, ' ') : null;
      setLocation(inferredLocation || 'Unknown Location');
    } finally {
      setDetectingLocation(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%' }}>
          <Pressable style={[styles.modalContent, { backgroundColor }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.header}>
              <ThemedText type="heading2" style={{ fontFamily: typography.families.bold }}>Filters</ThemedText>
              <TouchableOpacity onPress={onClose}>
                <IconSymbol name="xmark" size={24} color={textColor} />
              </TouchableOpacity>
            </View>

            <ScrollView 
              contentContainerStyle={styles.scrollContent} 
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={true}
              scrollEnabled={true}
            >
                  {/* Age Range */}
                  <View style={styles.section}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                      <ThemedText type="body2" style={styles.sectionTitle}>Age Range</ThemedText>
                      <ThemedText style={{ color: primaryColor, fontWeight: '600' }}>
                        {minAge || '13'} - {maxAge || '29'}
                      </ThemedText>
                    </View>
                    <RangeSlider
                      min={13}
                      max={29}
                      low={parseInt(minAge) || 13}
                      high={parseInt(maxAge) || 29}
                      onChange={(l, h) => {
                        setMinAge(l.toString());
                        setMaxAge(h.toString());
                      }}
                      primaryColor={primaryColor}
                      backgroundColor={white}
                      borderColor={inputBorderColor}
                    />
                  </View>

                  {/* Gender */}
                  <View style={styles.section}>
                    <ThemedText type="body2" style={styles.sectionTitle}>Gender</ThemedText>
                    <View style={styles.genderContainer}>
                      {['male', 'female', 'other'].map((g) => (
                        <TouchableOpacity
                          key={g}
                          style={[
                            styles.genderButton,
                            {
                              backgroundColor: selectedGenders.includes(g) ? primaryColor : inputBackgroundColor,
                              borderColor: inputBorderColor
                            }
                          ]}
                          onPress={() => toggleGender(g)}
                        >
                          <ThemedText style={{ color: selectedGenders.includes(g) ? white : textColor, textTransform: 'capitalize' }}>
                            {g}
                          </ThemedText>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Location */}
                  <View style={[styles.section, { zIndex: 1000 }]}>
                    <ThemedText type="body2" style={styles.sectionTitle}>Location</ThemedText>
                    <View style={[styles.inputWrapper, { backgroundColor: inputBackgroundColor, borderColor: inputBorderColor }]}>
                      <TextInput
                        style={[styles.input, { color: textColor, flex: 1 }]}
                        placeholder="Anywhere"
                        placeholderTextColor={lightTextColor}
                        value={location}
                        onChangeText={(text) => {
                          skipLocationSearch.current = false;
                          setLocation(text);
                          // Reset coords if user types manually
                          if (latitude) { setLatitude(undefined); setLongitude(undefined); }
                        }}
                      />
                      {location.length > 0 && (
                        <TouchableOpacity onPress={() => setLocation('')}>
                          <IconSymbol name="xmark.circle.fill" size={16} color={lightTextColor} />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity onPress={detectLocation} disabled={detectingLocation} style={{ paddingLeft: spacing.sm }}>
                        {detectingLocation ? (
                          <ActivityIndicator size="small" color={primaryColor} />
                        ) : (
                          <IconSymbol name="location.fill" size={20} color={primaryColor} />
                        )}
                      </TouchableOpacity>
                    </View>
                    {suggestions.length > 0 && (
                      <View style={[styles.suggestionsDropdown, { backgroundColor: inputBackgroundColor, borderColor: inputBorderColor }]}>
                        {suggestions.map((item, index) => (
                          <TouchableOpacity key={index} style={styles.suggestionItem} onPress={() => selectSuggestion(item)}>
                            <ThemedText>{item.name}</ThemedText>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>

                  {/* Radius */}
                  <View style={styles.section}>
                    <ThemedText type="body2" style={styles.sectionTitle}>Distance Radius (km)</ThemedText>
                    <View style={[styles.inputWrapper, { backgroundColor: inputBackgroundColor, borderColor: inputBorderColor }]}>
                      <TextInput
                        style={[styles.input, { color: textColor }]}
                        placeholder="50"
                        placeholderTextColor={lightTextColor}
                        value={radius}
                        onChangeText={setRadius}
                        keyboardType="number-pad"
                      />
                    </View>
                  </View>
                </ScrollView>

                <View style={styles.footer}>
                  <TouchableOpacity onPress={handleClear} style={{ padding: spacing.md }}>
                    <ThemedText style={{ color: lightTextColor }}>Clear All</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.applyButton, { backgroundColor: primaryColor }]}
                    onPress={handleApply}
                  >
                    <ThemedText style={{ color: white, fontWeight: 'bold' }}>Apply Filters</ThemedText>
                  </TouchableOpacity>
                </View>
          </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
    </Modal>
  );
}

interface RangeSliderProps {
  min: number;
  max: number;
  low: number;
  high: number;
  onChange: (low: number, high: number) => void;
  primaryColor: string;
  backgroundColor: string;
  borderColor: string;
}

function RangeSlider({ min, max, low, high, onChange, primaryColor, backgroundColor, borderColor }: RangeSliderProps) {
  const widthRef = useRef(0);
  const values = useRef({ low, high });

  useEffect(() => {
    values.current = { low, high };
  }, [low, high]);

  const startLow = useRef(low);
  const startHigh = useRef(high);

  // PanResponder must be created once with event handlers that read gesture refs.
  // eslint-disable-next-line react-hooks/refs
  const [panResponderLow] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { startLow.current = values.current.low; },
      onPanResponderMove: (_, gestureState) => {
        const w = widthRef.current;
        if (w === 0) return;
        const range = max - min;
        const delta = (gestureState.dx / w) * range;
        let newLow = Math.round(startLow.current + delta);
        newLow = Math.max(min, Math.min(newLow, values.current.high - 1));
        if (newLow !== values.current.low) onChange(newLow, values.current.high);
      },
    })
  );

  // eslint-disable-next-line react-hooks/refs
  const [panResponderHigh] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { startHigh.current = values.current.high; },
      onPanResponderMove: (_, gestureState) => {
        const w = widthRef.current;
        if (w === 0) return;
        const range = max - min;
        const delta = (gestureState.dx / w) * range;
        let newHigh = Math.round(startHigh.current + delta);
        newHigh = Math.max(values.current.low + 1, Math.min(newHigh, max));
        if (newHigh !== values.current.high) onChange(values.current.low, newHigh);
      },
    })
  );

  const lowPercent = ((low - min) / (max - min)) * 100;
  const highPercent = ((high - min) / (max - min)) * 100;

  return (
    <View style={{ height: 40, justifyContent: 'center', marginHorizontal: 12 }} onLayout={(e) => {
      const w = e.nativeEvent.layout.width;
      widthRef.current = w;
    }}>
      <View style={{ height: 4, backgroundColor: borderColor, borderRadius: 2, position: 'absolute', width: '100%' }} />
      <View style={{ height: 4, backgroundColor: primaryColor, borderRadius: 2, position: 'absolute', left: `${lowPercent}%`, width: `${highPercent - lowPercent}%` }} />
      <View
        {...panResponderLow.panHandlers}
        style={[styles.thumb, { left: `${lowPercent}%`, backgroundColor, borderColor: primaryColor }]}
      />
      <View
        {...panResponderHigh.panHandlers}
        style={[styles.thumb, { left: `${highPercent}%`, backgroundColor, borderColor: primaryColor }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    maxHeight: '85%',
    ...shadows.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: 50,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: typography.sizes.body1,
  },
  genderContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  genderButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ccc',
  },
  applyButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    ...shadows.md,
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
    marginTop: -2,
    ...shadows.md,
  },
  suggestionItem: {
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  thumb: {
    position: 'absolute',
    marginLeft: -12,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    ...shadows.sm,
    zIndex: 1,
  },
});