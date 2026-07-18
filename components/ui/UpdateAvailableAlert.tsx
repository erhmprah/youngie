// components/ui/UpdateAvailableAlert.tsx

import React from 'react';
import { Modal, StyleSheet, View, Text, TouchableOpacity, ScrollView, Linking, Platform } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors , spacing, borderRadius, typography, shadows } from '@/constants/design-tokens';
import { IconSymbol } from '@/components/ui/icon-symbol';

export interface UpdateAvailableAlertProps {
  visible: boolean;
  forceUpdate?: boolean;
  currentVersion?: string;
  newVersion?: string;
  releaseNotes?: string;
  storeUrl?: string;
  onDismiss?: () => void;
}

export function UpdateAvailableAlert({
  visible,
  forceUpdate = false,
  currentVersion = '0.0.0',
  newVersion = '0.0.0',
  releaseNotes,
  storeUrl,
  onDismiss,
}: UpdateAvailableAlertProps) {
  const { theme, colorScheme } = useTheme();
  const colors = getColors(theme as 'light' | 'dark', colorScheme as 'blue' | 'magenta');
  const isDark = theme === 'dark';

  const accentColor = forceUpdate ? colors.error : colors.primary;
  const iconName = forceUpdate ? 'alert-circle' : 'info.circle';
  const title = forceUpdate ? 'Update Required' : 'Update Available';
  const subtitle = forceUpdate
    ? 'Please update to continue using the app.'
    : 'A new version is available with improvements and bug fixes.';

  const handleUpdate = () => {
    if (storeUrl) {
      Linking.openURL(storeUrl);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!forceUpdate && onDismiss) {
          onDismiss();
        }
      }}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[styles.iconWrapper, { backgroundColor: accentColor + '20' }]}>
              <View style={[styles.iconCircle, { borderColor: accentColor }]}>
                <IconSymbol name={iconName} size={32} color={accentColor} />
              </View>
            </View>

            <Text style={[styles.title, { color: colors.text }]}>
              {title}
            </Text>

            <Text style={[styles.subtitle, { color: colors.lightText }]}>
              {subtitle}
            </Text>

            <View style={[styles.versionBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]}>
              <View style={styles.versionRow}>
                <Text style={[styles.versionLabel, { color: colors.lightText }]}>Current</Text>
                <Text style={[styles.versionValue, { color: colors.text }]}>{currentVersion}</Text>
              </View>
              <View style={[styles.versionDivider, { backgroundColor: colors.border }]} />
              <IconSymbol name="chevron.down" size={14} color={colors.lightText} />
              <View style={[styles.versionDivider, { backgroundColor: colors.border }]} />
              <View style={styles.versionRow}>
                <Text style={[styles.versionLabel, { color: colors.lightText }]}>Latest</Text>
                <Text style={[styles.versionValue, { color: accentColor }]}>{newVersion}</Text>
              </View>
            </View>

            {releaseNotes ? (
              <View style={[styles.notesContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)', borderColor: colors.border }]}>
                <Text style={[styles.notesTitle, { color: colors.text }]}>What's New</Text>
                <ScrollView
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                  style={styles.notesScroll}
                >
                  <Text style={[styles.notesText, { color: colors.lightText }]}>
                    {releaseNotes}
                  </Text>
                </ScrollView>
              </View>
            ) : null}

            <View style={styles.buttonContainer}>
              {!forceUpdate && (
                <TouchableOpacity
                  style={[styles.secondaryButton, { borderColor: colors.border }]}
                  onPress={onDismiss}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>
                    Later
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: accentColor }]}
                onPress={handleUpdate}
                activeOpacity={0.7}
              >
                <IconSymbol name="arrow.up" size={18} color={colors.white} />
                <Text style={[styles.primaryButtonText, { color: colors.white }]}>
                  Update Now
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  container: {
    width: '100%',
    maxWidth: 360,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    ...shadows.xl,
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
  },
  iconWrapper: {
    marginBottom: spacing.lg,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: typography.sizes.heading3,
    fontWeight: typography.weights.bold,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.sizes.body2,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
    paddingHorizontal: spacing.sm,
  },
  versionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.xl,
  },
  versionRow: {
    flexDirection: 'column',
    alignItems: 'center',
    flex: 1,
  },
  versionLabel: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.medium,
    marginBottom: spacing.xxs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  versionValue: {
    fontSize: typography.sizes.body1,
    fontWeight: typography.weights.semibold,
  },
  versionDivider: {
    width: 1,
    height: 24,
    marginHorizontal: spacing.xs,
  },
  notesContainer: {
    width: '100%',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: spacing.xl,
  },
  notesTitle: {
    fontSize: typography.sizes.body2,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.sm,
  },
  notesScroll: {
    maxHeight: 140,
  },
  notesText: {
    fontSize: typography.sizes.body2,
    lineHeight: 22,
  },
  buttonContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: spacing.md,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md + 2,
    borderRadius: borderRadius.lg,
    ...shadows.md,
  },
  primaryButtonText: {
    fontSize: typography.sizes.body1,
    fontWeight: typography.weights.semibold,
  },
  secondaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md + 2,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
  },
  secondaryButtonText: {
    fontSize: typography.sizes.body1,
    fontWeight: typography.weights.semibold,
  },
});
