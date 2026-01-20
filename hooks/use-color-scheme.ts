import { useTheme } from '@/contexts/ThemeContext';

// Use the theme from ThemeContext
export function useColorScheme() {
  const { theme } = useTheme();
  return theme;
}
