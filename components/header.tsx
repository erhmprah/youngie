// components/header.tsx

import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { spacing, typography, borderRadius } from '@/constants/design-tokens';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from './ui/icon-symbol';
import { IconName } from './ui/icon-symbol';

interface HeaderProps {
  title: string;
  subtitle?: string;
  rightIconName?: IconName;
  onRightPress?: () => void;
  transparent?: boolean;
  leftComponent?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  rightIconName,
  onRightPress,
  transparent = false,
  leftComponent,
}) => {
  const insets = useSafeAreaInsets();
  const theme = useColorScheme() ?? 'light';
  
  const textColor = useThemeColor('text');
  const subtitleColor = useThemeColor('lightText');
  const iconButtonBg = useThemeColor('surfaceLight');
  const borderBottomColor = useThemeColor('border');

  const Container = transparent ? BlurView : ThemedView;
  const containerProps = transparent 
    ? { intensity: 80, tint: theme }
    : { color: 'background' };

  return (
    <ThemedView style={[styles.wrapper, { paddingTop: insets.top }]}>
      <Container {...containerProps} style={[styles.header, { borderBottomColor }]}>
        <ThemedView style={styles.content}>
          {/* Left Slot */}
          <ThemedView style={styles.leftSlot}>
            {leftComponent}
          </ThemedView>

          {/* Center Slot */}
          <ThemedView style={styles.titleContainer}>
            <ThemedText type='title' style={{ fontFamily: typography.families.bold, color: textColor }} numberOfLines={1}>
              {title}
            </ThemedText>
            {subtitle && (
              <ThemedText type='caption' style={{ color: subtitleColor }} numberOfLines={1}>
                {subtitle}
              </ThemedText>
            )}
          </ThemedView>

          {/* Right Slot */}
          <ThemedView style={styles.rightSlot}>
            {rightIconName && (
              <TouchableOpacity 
                onPress={onRightPress} 
                style={[styles.iconButton, { backgroundColor: iconButtonBg }]}
                activeOpacity={0.7}
              >
                <IconSymbol name={rightIconName} size={22} color={textColor} />
              </TouchableOpacity>
            )}
          </ThemedView>
        </ThemedView>
      </Container>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    zIndex: 100,
  },
  header: {
    height: 56,
    justifyContent: 'center',
    borderBottomWidth: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  leftSlot: {
    flex: 1,
    alignItems: 'flex-start',
    backgroundColor: 'transparent',
  },
  titleContainer: {
    flex: 3,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  rightSlot: {
    flex: 1,
    alignItems: 'flex-end',
    backgroundColor: 'transparent',
  },
  iconButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.round,
  },
});