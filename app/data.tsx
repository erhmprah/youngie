// Data Policy View Screen

import React from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { spacing, typography } from '@/constants/design-tokens';
import { dataPolicyData } from './data-policy';

export default function DataPolicyView() {
  const router = useRouter();
  const backgroundColor = useThemeColor('background');
  const textColor = useThemeColor('text');
  const lightTextColor = useThemeColor('lightText');
  const borderColor = useThemeColor('border');
  const surfaceColor = useThemeColor('surface');

  const renderSection = (section: { title: string; content: string }, index: number) => (
    <View key={index} style={styles.section}>
      <ThemedText style={[styles.sectionTitle, { color: textColor }]}>
        {section.title}
      </ThemedText>
      <ThemedText style={[styles.sectionContent, { color: lightTextColor }]}>
        {section.content}
      </ThemedText>
    </View>
  );

  return (
    <ThemedView style={styles.container} safe>
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <IconSymbol name="chevron.left" size={24} color={textColor} />
        </TouchableOpacity>
        <ThemedText style={[styles.title, { color: textColor }]}>
          Data Policy
        </ThemedText>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
           <View style={[styles.section, { backgroundColor: surfaceColor, borderColor, borderWidth: 1, padding: spacing.lg }]}>
           <ThemedText style={[styles.title, { color: textColor }]}>
             Data Policy
           </ThemedText>
           <ThemedText style={[styles.lastUpdated, { color: lightTextColor }]}>
             Last Updated: {dataPolicyData.lastUpdated}
           </ThemedText>
         </View>

        {dataPolicyData.sections.map(renderSection)}

        <View style={[styles.footer, { borderTopColor: borderColor }]}>
          <ThemedText style={[styles.footerText, { color: lightTextColor }]}>
            For data-related questions or requests, please contact us at privacy@youngie.social
          </ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    marginBottom: spacing.xl,
    paddingTop: spacing.xs,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: typography.sizes.heading1,
    lineHeight: typography.sizes.heading1 * 1.2,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.sm,
  },
  backButton: { padding: spacing.xs },
  lastUpdated: {
    fontSize: typography.sizes.body2,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.sizes.title,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.md,
  },
  sectionContent: {
    fontSize: typography.sizes.body1,
    lineHeight: typography.sizes.body1 * 1.6,
  },
  footer: {
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
  },
  footerText: {
    fontSize: typography.sizes.body2,
    textAlign: 'center',
    lineHeight: typography.sizes.body2 * 1.5,
  },
});
