// components/themed-text.tsx

import React, { useMemo } from 'react';
import { StyleSheet, Text, type TextProps } from 'react-native';
import { useThemeColor } from '@/hooks/use-theme-color';
import { typography } from '@/constants/design-tokens';
import { ColorName } from '@/hooks/use-theme-color';

type TypographyType = keyof typeof typography.sizes;

export type ThemedTextProps = TextProps & {
  color?: ColorName;
  type?: TypographyType | 'link' | 'default';
};

const ThemedTextComponent = ({
  style,
  color,
  type = 'default',
  ...rest
}: ThemedTextProps) => {
  const textColor = useThemeColor(color || 'text');
  const linkColor = useThemeColor('primary');
  const captionColor = useThemeColor('lightText');

  // Memoize font style computation
  const fontStyle = useMemo(() => {
    if (type === 'link' || type === 'default') {
      return styles.default;
    }
    return { fontSize: typography.sizes[type], fontWeight: typography.weights.regular };
  }, [type]);

  // Memoize style array to prevent unnecessary re-renders
  const memoizedStyle = useMemo(() => [
    { color: textColor },
    fontStyle,
    type === 'caption' && { color: captionColor },
    type === 'link' && [styles.link, { color: linkColor }],
    style,
  ].filter(Boolean), [textColor, fontStyle, type, captionColor, linkColor, style]);

  return (
    <Text
      style={memoizedStyle}
      {...rest}
    />
  );
};

export const ThemedText = React.memo(ThemedTextComponent);

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
