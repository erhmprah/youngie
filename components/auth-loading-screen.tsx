import React from 'react';
import { View, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { spacing, borderRadius } from '@/constants/design-tokens';

export default function AuthLoadingScreen() {
  const backgroundColor = useThemeColor('background');
  const primaryColor = useThemeColor('primary');
  const textColor = useThemeColor('text');

  return (
    <ThemedView style={[styles.container, { backgroundColor }]}>
      <View style={styles.content}>
        <View>
          <Image
            source={require('@/assets/images/youngie_icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        <ThemedText type="heading2" style={[styles.title, { color: textColor }]}>
          Youngie
        </ThemedText>
        <ActivityIndicator size="large" color={primaryColor} style={styles.spinner} />
        <ThemedText type="body1" style={[styles.subtitle, { color: textColor }]}>
          Signing you in...
        </ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: borderRadius.round,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  logo: {
    width: 100,
    height: 100,
  },
  title: {
    marginBottom: spacing.xl,
    fontWeight: 'bold',
  },
  spinner: {
    marginBottom: spacing.md,
  },
  subtitle: {
    opacity: 0.7,
  },
});