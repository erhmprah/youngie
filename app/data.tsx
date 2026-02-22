// Data Policy View Screen

import React from 'react';
import { StyleSheet, ScrollView, View } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { spacing, typography } from '@/constants/design-tokens';
import { dataPolicyData } from './data-policy';

export default function DataPolicyView() {
  const textColor = useThemeColor('text');
  const lightTextColor = useThemeColor('lightText');

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
    <ThemedView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <ThemedText style={[styles.title, { color: textColor }]}>
            Data Policy
          </ThemedText>
          <ThemedText style={[styles.lastUpdated, { color: lightTextColor }]}>
            Last Updated: {dataPolicyData.lastUpdated}
          </ThemedText>
        </View>

        {dataPolicyData.sections.map(renderSection)}

        <View style={styles.footer}>
          <ThemedText style={[styles.footerText, { color: lightTextColor }]}>
            For data-related questions or requests, please contact us at privacy@youngieapp.com
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
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: typography.sizes.heading1,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.sm,
  },
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
    borderTopColor: '#E0E0E0',
  },
  footerText: {
    fontSize: typography.sizes.body2,
    textAlign: 'center',
    lineHeight: typography.sizes.body2 * 1.5,
  },
});
