// constants/design-tokens.ts

// Modern Dark Theme Color Palette
const darkTheme = {
  // Primary Colors - Modern vibrant magenta/pink for dark mode
  primary: '#FF2D7A',
  primaryLight: '#FF5A9B',
  primaryDark: '#D91E62',
  primaryGlass: 'rgba(255, 45, 122, 0.15)',

  // Secondary Colors - Subtle grays
  secondary: '#8E8E93',
  secondaryLight: '#AEAEB2',
  secondaryDark: '#636366',

  // Accent Colors
  accent: '#FFD60A',
  success: '#34C759',
  warning: '#FF9500',
  error: '#FF453A',

  // Neutral Colors - Deep rich dark theme
  white: '#FFFFFF',
  background: '#0A0A0C',      // Near black
  backgroundSecondary: '#121214', // Elevated background
  surface: '#1A1A1D',         // Card surface
  surfaceElevated: '#222226', // Elevated surface
  surfaceLight: '#2A2A2E',
  border: '#2E2E32',          // Subtle borders
  borderLight: '#3A3A3E',     // Lighter borders
  divider: '#2E2E32',

  // Text Colors
  text: '#FFFFFF',
  textSecondary: '#B0B0B4',
  textMuted: '#7A7A7E',
  lightText: '#B0B0B4',
  lighterText: '#7A7A7E',
  textDisabled: '#5A5A5E',

  // Input
  inputBackground: '#1A1A1D',
  inputBorder: '#3A3A3E',
  inputBorderFocus: '#FF2D7A',
  inputText: '#FFFFFF',
  inputPlaceholder: '#7A7A7E',

  // Shadow
  shadow: '#000000',

  // Glassmorphism
  glassLight: 'rgba(255, 255, 255, 0.05)',
  glassMedium: 'rgba(255, 255, 255, 0.1)',
  glassStrong: 'rgba(255, 255, 255, 0.15)',
  glassBorder: 'rgba(255, 255, 255, 0.1)',

  // Gradient colors
  gradientStart: '#FF2D7A',
  gradientMid: '#D91E62',
  gradientEnd: '#B81550',

  // Status
  online: '#34C759',
  offline: '#8E8E93',
  away: '#FF9500',
};

// Light Theme Color Palette (for completeness)
const lightTheme = {
  primary: '#E91E63',
  primaryLight: '#F06292',
  primaryDark: '#C2185B',
  primaryGlass: 'rgba(233, 30, 99, 0.1)',

  secondary: '#757575',
  secondaryLight: '#9E9E9E',
  secondaryDark: '#616161',

  accent: '#FFC107',
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',

  white: '#FFFFFF',
  background: '#FAFAFA',
  backgroundSecondary: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceLight: '#F5F5F5',
  border: '#E0E0E0',
  borderLight: '#EEEEEE',
  divider: '#E0E0E0',

  text: '#1A1A1A',
  textSecondary: '#616161',
  textMuted: '#9E9E9E',
  lightText: '#616161',
  lighterText: '#9E9E9E',
  textDisabled: '#BDBDBD',

  inputBackground: '#FFFFFF',
  inputBorder: '#E0E0E0',
  inputBorderFocus: '#E91E63',
  inputText: '#1A1A1A',
  inputPlaceholder: '#9E9E9E',

  shadow: '#000000',

  glassLight: 'rgba(0, 0, 0, 0.03)',
  glassMedium: 'rgba(0, 0, 0, 0.06)',
  glassStrong: 'rgba(0, 0, 0, 0.1)',
  glassBorder: 'rgba(0, 0, 0, 0.08)',

  gradientStart: '#E91E63',
  gradientMid: '#C2185B',
  gradientEnd: '#AD1457',

  online: '#4CAF50',
  offline: '#9E9E9E',
  away: '#FF9800',
};

import { scale, verticalScale, moderateScale, scaleFont, borderScale } from '@/utils/scale';

export { verticalScale };

// Spacing - responsive scaling (width-based)
export const spacing = {
  xxs: scale(2),
  xs: scale(4),
  sm: scale(8),
  md: scale(12),
  lg: scale(16),
  xl: scale(24),
  xxl: scale(32),
  xxxl: scale(48),
};

// Typography - responsive scaling (moderate font scaling)
export const typography = {
  families: {
    regular: 'Inter-Regular',
    medium: 'Inter-Medium',
    semibold: 'Inter-SemiBold',
    bold: 'Inter-Bold',
  },
  sizes: {
    display: scaleFont(40),
    heading1: scaleFont(32),
    heading2: scaleFont(26),
    heading3: scaleFont(22),
    heading4: scaleFont(19),
    title: scaleFont(17),
    body1: scaleFont(16),
    body2: scaleFont(14),
    caption: scaleFont(12),
    tiny: scaleFont(11),
  },
  weights: {
    light: '300',
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  } as const,
  lineHeights: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.7,
  },
};

// Common responsive sizes
export const sizes = {
  logo: scale(90),
  logoSmall: scale(72),
  iconSmall: moderateScale(14),
  iconMedium: moderateScale(20),
  iconLarge: moderateScale(28),
  iconXLarge: moderateScale(40),
  profilePhoto: scale(100),
  actionIcon: scale(44),
  actionIconSize: scale(22),
  storyRing: scale(60),
  storyBadge: scale(22),
  inputHeight: verticalScale(52),
  buttonHeight: verticalScale(52),
  checkboxSize: scale(20),
  checkboxIconSize: moderateScale(14),
  borderRadiusSm: scale(8),
  borderRadiusMd: scale(12),
  borderRadiusLg: scale(16),
  borderRadiusXl: scale(24),
  borderRadiusRound: 999,
  borderWidth: borderScale(1),
  dividerWidth: borderScale(0.5),
};

// Border Radius
export const borderRadius = {
  none: 0,
  sm: sizes.borderRadiusSm,
  md: sizes.borderRadiusMd,
  lg: sizes.borderRadiusLg,
  xl: sizes.borderRadiusXl,
  full: 999,
  round: 999,
};

// Shadows - Subtle and realistic shadows for dark mode
export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  xs: {
    shadowColor: darkTheme.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  sm: {
    shadowColor: darkTheme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: darkTheme.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: darkTheme.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  xl: {
    shadowColor: darkTheme.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12,
  },
  // Colored shadows for primary elements
  primarySm: {
    shadowColor: darkTheme.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryMd: {
    shadowColor: darkTheme.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryLg: {
    shadowColor: darkTheme.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
};

// Animation durations
export const animations = {
  fast: 150,
  normal: 250,
  slow: 350,
};

// Z-index layers
export const zIndex = {
  base: 0,
  dropdown: 100,
  sticky: 200,
  modal: 300,
  popover: 400,
  tooltip: 500,
  toast: 600,
};

// Helper function to get colors based on theme
export const getColors = (theme: 'light' | 'dark', colorScheme: string = 'default') => {
  // For now, we only support the modern dark theme as default
  // The colorScheme parameter is kept for backward compatibility
  if (theme === 'light') {
    return lightTheme;
  }
  return darkTheme;
};

// Export default colors (dark theme) for backward compatibility
export const colors = darkTheme;