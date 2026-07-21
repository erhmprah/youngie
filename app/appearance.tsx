import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View, ScrollView, Modal, FlatList } from 'react-native';
import { Stack } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { spacing, borderRadius, typography, sizes } from '@/constants/design-tokens';
import { useTheme } from '@/contexts/ThemeContext';

export default function AppearanceScreen() {
  const { mode, setMode, colorScheme, setColorScheme } = useTheme();
  const backgroundColor = useThemeColor('background');
  const textColor = useThemeColor('text');
  const surfaceColor = useThemeColor('surface');
  const primaryColor = useThemeColor('primary');
  const borderColor = useThemeColor('border');
  const lightTextColor = useThemeColor('lightText');

  const [showColorPicker, setShowColorPicker] = useState(false);

  const customColors = [
    '#007AFF', '#D72C67', '#34C759', '#FF9500', '#AF52DE', '#FF3B30',
    '#5856D6', '#FFCC00', '#32D74B', '#FF453A', '#64D2FF', '#FFD60A',
    '#BF5AF2', '#FF9F0A', '#30D158', '#E5E5EA', '#8E8E93', '#636366'
  ];

  const themeOptions = [
    { label: 'System Default', value: 'system', icon: 'device-phone-portrait' },
    { label: 'Light', value: 'light', icon: 'sun.max' },
    { label: 'Dark', value: 'dark', icon: 'moon' },
  ] as const;

  const colorOptions = [
    { label: 'Blue', value: 'blue', color: '#007AFF' },
    { label: 'Magenta', value: 'magenta', color: '#D72C67' },
    { label: 'Green', value: '#34C759', color: '#34C759' },
    { label: 'Orange', value: '#FF9500', color: '#FF9500' },
    { label: 'Purple', value: '#AF52DE', color: '#AF52DE' },
    { label: 'Red', value: '#FF3B30', color: '#FF3B30' },
    { label: 'Custom', value: 'custom', color: colorScheme.startsWith('#') ? colorScheme : '#007AFF' },
  ];

  return (
    <ThemedView style={[styles.container, { backgroundColor }]} safe>
      <Stack.Screen options={{ title: 'Appearance', headerBackTitle: 'Settings' }} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <ThemedText style={[styles.description, { color: lightTextColor }]}>
            Choose how Youngie looks on your device.
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: lightTextColor }]}>Theme</ThemedText>
          <View style={[styles.section, { backgroundColor: surfaceColor, borderColor, borderWidth: 1 }]}>
            {themeOptions.map((option, index) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.option,
                  { borderBottomWidth: index === themeOptions.length - 1 ? 0 : 1, borderBottomColor: borderColor }
                ]}
                onPress={() => setMode(option.value)}
              >
                <View style={styles.optionLeft}>
                  <IconSymbol name={option.icon} size={24} color={textColor} />
                  <ThemedText style={styles.optionLabel}>{option.label}</ThemedText>
                </View>
                {mode === option.value && (
                  <IconSymbol name="checkmark" size={20} color={primaryColor} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: lightTextColor }]}>Color Scheme</ThemedText>
          <View style={[styles.section, { backgroundColor: surfaceColor, borderColor, borderWidth: 1 }]}>
            {colorOptions.map((option, index) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.option,
                  { borderBottomWidth: index === colorOptions.length - 1 ? 0 : 1, borderBottomColor: borderColor }
                ]}
                onPress={() => {
                  if (option.value === 'custom') {
                    setShowColorPicker(true);
                  } else {
                    setColorScheme(option.value);
                  }
                }}
              >
                <View style={styles.optionLeft}>
                  <View style={[styles.colorCircle, { backgroundColor: option.color }]} />
                  <ThemedText style={styles.optionLabel}>{option.label}</ThemedText>
                </View>
                {(colorScheme === option.value || (option.value === 'custom' && colorScheme.startsWith('#'))) && (
                  <IconSymbol name="checkmark" size={20} color={primaryColor} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={showColorPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowColorPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: surfaceColor }]}>
            <ThemedText style={[styles.modalTitle, { color: textColor }]}>Choose Custom Color</ThemedText>
            <FlatList
              data={customColors}
              keyExtractor={(item) => item}
              numColumns={6}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.colorOption, { backgroundColor: item }]}
                  onPress={() => {
                    setColorScheme(item);
                    setShowColorPicker(false);
                  }}
                >
                  {colorScheme === item && (
                    <IconSymbol name="checkmark" size={16} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.colorGrid}
            />
            <TouchableOpacity
              style={[styles.closeButton, { borderColor }]}
              onPress={() => setShowColorPicker(false)}
            >
              <ThemedText style={[styles.closeButtonText, { color: textColor }]}>Close</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
  },
  header: {
    marginBottom: spacing.lg,
  },
  description: {
    fontSize: typography.sizes.body2,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.families.medium,
    marginBottom: spacing.sm,
  },
  themeSection: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionLabel: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.families.medium,
    marginLeft: spacing.md,
  },
  colorCircle: {
    width: sizes.iconSmall,
    height: sizes.iconSmall,
    borderRadius: sizes.iconSmall / 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '70%',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  modalTitle: {
    fontSize: typography.sizes.title,
    fontFamily: typography.families.medium,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  colorGrid: {
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  colorOption: {
    width: sizes.iconLarge,
    height: sizes.iconLarge,
    borderRadius: sizes.iconLarge / 2,
    margin: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.families.medium,
  },
});