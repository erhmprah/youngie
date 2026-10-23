// hooks/use-theme-color.ts

import { getColors } from '@/constants/design-tokens';
import { useTheme } from '@/contexts/ThemeContext';

// Define the type for all possible color names
export type ColorName = keyof ReturnType<typeof getColors>;

export function useThemeColor(colorName: ColorName) {
  const { theme, colorScheme } = useTheme();
  const colors = getColors(theme as 'light' | 'dark', colorScheme);

  return colors[colorName];
}