import React from 'react';
import { StyleSheet, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { spacing, borderRadius, typography, shadows } from '@/constants/design-tokens';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface GoogleSignInButtonProps {
  onPress: () => void;
  disabled?: boolean;
}

export default function GoogleSignInButton({ onPress, disabled = false, label = "Continue with Google" }: GoogleSignInButtonProps & { label?: string }) {
  const backgroundColor = useThemeColor('inputBackground');
  const textColor = useThemeColor('text');
  const white = useThemeColor('white');

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor },
        disabled && styles.buttonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <View style={styles.content}>
        {disabled ? (
          <ActivityIndicator size="small" color={textColor} />
        ) : (
          <>
            <IconSymbol name="logo-google" size={24} color={textColor} />
            <ThemedText style={[styles.buttonText, { color: textColor }]}>
              {label}
            </ThemedText>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  buttonText: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.families.medium,
  },
});
