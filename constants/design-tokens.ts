// constants/design-tokens.ts

// Define the color palette for the light theme (blue)
const lightColors = {
  // Primary Colors - A professional and modern blue
  primary: '#007AFF', // Apple's standard blue
  primaryLight: '#3395FF',
  primaryDark: '#005ECC',

  // Secondary Colors - A complementary and subtle gray
  secondary: '#8E8E93',
  secondaryLight: '#AEAEB2',
  secondaryDark: '#636366',

  // Accent Colors
  accent: '#FFD60A', // A vibrant yellow for attention
  success: '#34C759',
  warning: '#FF9500',
  error: '#FF3B30',

  // Neutral Colors - Clean and Professional Light Theme
  white: '#FFFFFF',
  background: '#F2F2F7', // A very light gray for the background
  surface: '#FFFFFF',
  surfaceLight: '#E5E5EA',
  border: '#D1D1D6',
  divider: '#D1D1D6',

  // Text Colors
  text: '#000000',
  lightText: '#636366',
  lighterText: '#8E8E93',

  // Input
  inputBackground: '#FFFFFF',
  inputBorder: '#D1D1D6',
  inputText: '#000000',

  // Shadow
  shadow: '#000000',

  // Status
  online: '#34C759',
  offline: '#8E8E93',
  away: '#FF9500',
};

// Define the color palette for the light theme (magenta)
const lightMagentaColors = {
  // Primary Colors - Magenta for light mode
  primary: '#D72C67',
  primaryLight: '#E55A87',
  primaryDark: '#B02557',

  // Secondary Colors - A complementary and subtle gray
  secondary: '#8E8E93',
  secondaryLight: '#AEAEB2',
  secondaryDark: '#636366',

  // Accent Colors
  accent: '#FFD60A', // A vibrant yellow for attention
  success: '#34C759',
  warning: '#FF9500',
  error: '#FF3B30',

  // Neutral Colors - Clean and Professional Light Theme
  white: '#FFFFFF',
  background: '#F2F2F7', // A very light gray for the background
  surface: '#FFFFFF',
  surfaceLight: '#E5E5EA',
  border: '#D1D1D6',
  divider: '#D1D1D6',

  // Text Colors
  text: '#000000',
  lightText: '#636366',
  lighterText: '#8E8E93',

  // Input
  inputBackground: '#FFFFFF',
  inputBorder: '#D1D1D6',
  inputText: '#000000',

  // Shadow
  shadow: '#000000',

  // Status
  online: '#34C759',
  offline: '#8E8E93',
  away: '#FF9500',
};

// Define the color palette for the dark theme (blue)
const darkColors = {
  // Primary Colors - A vibrant blue for dark mode
  primary: '#0A84FF',
  primaryLight: '#3B9BFF',
  primaryDark: '#0062CC',

  // Secondary Colors
  secondary: '#8E8E93',
  secondaryLight: '#AEAEB2',
  secondaryDark: '#636366',

  // Accent Colors
  accent: '#FFD60A',
  success: '#34C759',
  warning: '#FF9500',
  error: '#FF453A',

  // Neutral Colors - A deep and rich dark theme
  white: '#FFFFFF',
  background: '#000000',
  surface: '#1C1C1E',
  surfaceLight: '#2C2C2E',
  border: '#38383A',
  divider: '#38383A',

  // Text Colors
  text: '#FFFFFF',
  lightText: '#8E8E93',
  lighterText: '#636366',

  // Input
  inputBackground: '#1C1C1E',
  inputBorder: '#38383A',
  inputText: '#FFFFFF',

  // Shadow
  shadow: '#000000',

  // Status
  online: '#34C759',
  offline: '#8E8E93',
  away: '#FF9500',
};

// Define the color palette for the dark theme (magenta)
const darkMagentaColors = {
  // Primary Colors - Magenta for dark mode
  primary: '#D72C67',
  primaryLight: '#E55A87',
  primaryDark: '#B02557',

  // Secondary Colors
  secondary: '#8E8E93',
  secondaryLight: '#AEAEB2',
  secondaryDark: '#636366',

  // Accent Colors
  accent: '#FFD60A',
  success: '#34C759',
  warning: '#FF9500',
  error: '#FF453A',

  // Neutral Colors - A deep and rich dark theme
  white: '#FFFFFF',
  background: '#000000',
  surface: '#1C1C1E',
  surfaceLight: '#2C2C2E',
  border: '#38383A',
  divider: '#38383A',

  // Text Colors
  text: '#FFFFFF',
  lightText: '#8E8E93',
  lighterText: '#636366',

  // Input
  inputBackground: '#1C1C1E',
  inputBorder: '#38383A',
  inputText: '#FFFFFF',

  // Shadow
  shadow: '#000000',

  // Status
  online: '#34C759',
  offline: '#8E8E93',
  away: '#FF9500',
};

// Spacing - A consistent and scalable spacing system
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

// Typography - Using system fonts for a native feel
export const typography = {
  families: {
    // Using system fonts for a native and professional look
    regular: 'System',
    medium: 'System-Medium',
    bold: 'System-Bold',
  },
  sizes: {
    heading1: 34,
    heading2: 28,
    heading3: 22,
    heading4: 20,
    title: 17,
    body1: 17,
    body2: 15,
    caption: 13,
    tiny: 12,
  },
  weights: {
    light: '300',
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  } as const,
};

// Border Radius
export const borderRadius = {
  none: 0,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  round: 999,
};

// Shadows - Subtle and realistic shadows
export const shadows = {
  sm: {
    shadowColor: darkColors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: darkColors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  lg: {
    shadowColor: darkColors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  xl: {
    shadowColor: darkColors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
};

// Helper function to generate color palette from custom primary color
const generateColorPalette = (primaryColor: string, theme: 'light' | 'dark') => {
  // For now, use predefined palettes for named schemes, generate custom for hex colors
  if (primaryColor === 'blue') {
    return theme === 'light' ? lightColors : darkColors;
  } else if (primaryColor === 'magenta') {
    return theme === 'light' ? lightMagentaColors : darkMagentaColors;
  } else {
    // Generate custom palette based on primary color
    // This is a simplified approach - in a real app, you'd use color manipulation libraries
    const isLight = theme === 'light';
    const baseColors = isLight ? lightColors : darkColors;

    return {
      ...baseColors,
      primary: primaryColor,
      primaryLight: primaryColor, // Simplified - could use color manipulation
      primaryDark: primaryColor,  // Simplified - could use color manipulation
    };
  }
};

// Export a function that returns the correct color palette
export const getColors = (theme: 'light' | 'dark', colorScheme: string = 'blue') => {
  return generateColorPalette(colorScheme, theme);
};

// Export default colors (light theme) for backward compatibility
export const colors = lightColors;
