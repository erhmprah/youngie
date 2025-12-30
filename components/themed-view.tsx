// components/themed-view.tsx

import { View, type ViewProps, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColor } from '@/hooks/use-theme-color';
import { borderRadius as br, shadows, spacing } from '@/constants/design-tokens';
import { ColorName } from '@/hooks/use-theme-color'; // Assuming ColorName is exported from the hook

export type ThemedViewProps = ViewProps & {
  color?: ColorName;
  variant?: 'default' | 'surface' | 'outline';
  safe?: boolean; // Automatically applies safe area padding
  gutter?: boolean; // Applies standard horizontal screen padding
};

export function ThemedView({ 
  style, 
  color,
  variant = 'default', 
  safe = false,
  gutter = false,
  ...otherProps 
}: ThemedViewProps) {
  const insets = useSafeAreaInsets();
  
  // Determine background color
  const defaultColor = variant === 'surface' ? 'surface' : 'background';
  const backgroundColor = useThemeColor(color || defaultColor);
  const borderColor = useThemeColor('border');

  return (
    <View 
      style={[
        { backgroundColor },
        variant === 'surface' && styles.surface,
        variant === 'outline' && [styles.outline, { borderColor }],
        gutter && styles.gutter,
        safe && { paddingTop: insets.top, paddingBottom: insets.bottom },
        style
      ]} 
      {...otherProps} 
    />
  );
}

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
