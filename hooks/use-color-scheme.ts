import { useColorScheme as useNativeColorScheme } from 'react-native';

// Force dark theme as default across the entire app
export function useColorScheme() {
  return 'dark' as const;
}
