// components/themed-text.tsx

import { StyleSheet, Text, type TextProps } from 'react-native';
import { useThemeColor } from '@/hooks/use-theme-color';
import { typography } from '@/constants/design-tokens';
import { ColorName } from '@/hooks/use-theme-color';

type TypographyType = keyof typeof typography.sizes;

export type ThemedTextProps = TextProps & {
  color?: ColorName;
  type?: TypographyType | 'link' | 'default';
};

export function ThemedText({
  style,
  color,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const textColor = useThemeColor(color || 'text');
  const linkColor = useThemeColor('primary');
  const captionColor = useThemeColor('lightText');

  // Determine font style from typography tokens
  const fontStyle = type !== 'link' && type !== 'default' ? 
    { fontSize: typography.sizes[type], fontWeight: typography.weights.regular } : 
    styles.default;

  return (
    <Text
      style={[
        { color: textColor },
        fontStyle,
        type === 'caption' && { color: captionColor },
        type === 'link' && [styles.link, { color: linkColor }],
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontSize: typography.sizes.body1,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  link: {
    fontSize: typography.sizes.body1,
    fontWeight: '600',
    textDecorationLine: 'none',
  },
});
