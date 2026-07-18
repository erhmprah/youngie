import { Platform } from 'react-native';
import * as Location from 'expo-location';
import Constants from 'expo-constants';

/**
 * Returns a human-readable device name including brand and model when available,
 * e.g. "Samsung Galaxy Note 5", "Apple iPhone 12", "Web Browser".
 */
export async function getDeviceName(): Promise<string> {
  try {
    if (Platform.OS === 'web') {
      return 'Web Browser';
    }

    if (Platform.OS === 'ios') {
      const model = Constants.platform?.ios?.model || '';
      return model ? `Apple ${model}` : 'Apple iPhone';
    }

    if (Platform.OS === 'android') {
      const android = Constants.platform?.android as
        | {
            model?: string;
            brand?: string;
            manufacturer?: string;
            version?: { release?: string };
          }
        | undefined;

      const brand =
        android?.manufacturer || android?.brand || '';
      const model = android?.model || '';

      const cleanBrand = brand ? capitalize(brand) : '';
      if (cleanBrand && model && !model.toLowerCase().startsWith(cleanBrand.toLowerCase())) {
        return `${cleanBrand} ${model}`.trim();
      }
      if (model) return model;
      if (cleanBrand) return `${cleanBrand} Device`;
    }

    return `${capitalize(Platform.OS)} Device`;
  } catch (error) {
    console.warn('[deviceInfo] Failed to detect device name:', error);
    return `${capitalize(Platform.OS)} Device`;
  }
}

/**
 * Returns an approximate location string, e.g. "Accra, Ghana".
 * Uses the device's GPS + reverse geocoding with a timezone fallback.
 */
export async function getClientLocation(): Promise<string | undefined> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
        const geocode = await Location.reverseGeocodeAsync({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        if (geocode && geocode.length > 0) {
          const place = geocode[0];
          const city = place.city || place.subregion || place.region || '';
          const country = place.country || '';
          const location = [city, country].filter(Boolean).join(', ');
          if (location) return location;
        }
      } catch (geoError) {
        console.warn('[deviceInfo] Reverse geocoding failed:', geoError);
      }
    }
  } catch (error) {
    console.warn('[deviceInfo] Location detection failed:', error);
  }

  // Fallback to timezone-based location (e.g. "Accra")
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timeZone) {
      const parts = timeZone.split('/');
      const city = parts[parts.length - 1]?.replace(/_/g, ' ');
      if (city) return city;
    }
  } catch (error) {
    console.warn('[deviceInfo] Timezone fallback failed:', error);
  }

  return undefined;
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}
