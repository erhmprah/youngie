// hooks/use-theme-color.ts

import { useColorScheme } from '@/hooks/use-color-scheme';
import { getColors } from '@/constants/design-tokens';
import { useTheme } from '@/contexts/ThemeContext';

// Define the type for all possible color names
export type ColorName = keyof ReturnType<typeof getColors>;

export function useThemeColor(colorName: ColorName) {
  const theme = useColorScheme() ?? 'light';
  const { colorScheme } = useTheme();
  const colors = getColors(theme, colorScheme);

  return colors[colorName];
}