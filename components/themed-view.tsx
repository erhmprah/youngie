// components/themed-view.tsx

import React, { useMemo } from 'react';
import { View, type ViewProps, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColor } from '@/hooks/use-theme-color';
import { borderRadius as br, shadows, spacing } from '@/constants/design-tokens';
import { ColorName } from '@/hooks/use-theme-color';

export type ThemedViewProps = ViewProps & {
  color?: ColorName;
  variant?: 'default' | 'surface' | 'outline';
  safe?: boolean;
  gutter?: boolean;
};

const ThemedViewComponent = ({
  style,
  color,
  variant = 'default',
  safe = false,
  gutter = false,
  ...otherProps
}: ThemedViewProps) => {
  const insets = useSafeAreaInsets();
  
  const defaultColor = variant === 'surface' ? 'surface' : 'background';
  const backgroundColor = useThemeColor(color || defaultColor);
  const borderColor = useThemeColor('border');

  // Memoize style to prevent unnecessary re-renders
  const memoizedStyle = useMemo(() => [
    { backgroundColor },
    variant === 'surface' && styles.surface,
    variant === 'outline' && [styles.outline, { borderColor }],
    gutter && styles.gutter,
    safe && { paddingTop: insets.top, paddingBottom: insets.bottom },
    style,
  ].filter(Boolean), [backgroundColor, variant, borderColor, gutter, safe, insets.top, insets.bottom, style]);

  return (
    <View 
      style={memoizedStyle}
      {...otherProps} 
    />
  );
};

export const ThemedView = React.memo(ThemedViewComponent);

const styles = StyleSheet.create({
  surface: {
    borderRadius: br.lg,
    ...shadows.sm,
    padding: spacing.md,
  },
  outline: {
    borderRadius: br.md,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  gutter: {
    paddingHorizontal: spacing.lg,
  },
});
