// components/card.tsx

import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { ThemedView, ThemedViewProps } from './themed-view';
import { spacing, borderRadius, shadows } from '@/constants/design-tokens';
import { useThemeColor } from '@/hooks/use-theme-color';
import * as Haptics from 'expo-haptics';

// CardProps now extends ThemedViewProps for better integration
interface CardProps extends ThemedViewProps {
  onPress?: () => void;
}

export const Card: React.FC<CardProps> = ({ 
  onPress, 
  style,
  children,
  variant = 'surface', // 'surface' is a good default for cards
  ...rest
}) => {
  const cardStyle = [
    styles.card,
    variant === 'surface' && styles.surface,
    variant === 'outline' && styles.outline,
    style,
  ];

  const cardContent = (
    <ThemedView style={cardStyle} {...rest}>
      {children}
    </ThemedView>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={(e) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }} activeOpacity={0.85}>
        {cardContent}
      </TouchableOpacity>
    );
  }

  return cardContent;
};

// CardHeader, CardContent, and CardFooter
export const CardHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemedView style={styles.header}>{children}</ThemedView>
);

export const CardContent: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemedView style={styles.content}>{children}</ThemedView>
);

export const CardFooter: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const borderTopColor = useThemeColor('divider');

  return (
    <ThemedView style={[styles.footer, { borderTopColor }]}>
      {children}
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderRadius: borderRadius.lg,
  },
  surface: {
    ...shadows.md,
  },
  outline: {
    borderWidth: 1,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    backgroundColor: 'transparent',
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    backgroundColor: 'transparent',
  },
});