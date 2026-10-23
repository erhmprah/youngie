// Community Guidelines View Screen

import React from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { spacing, typography, sizes } from '@/constants/design-tokens';
import { communityGuidelinesData } from './community-guidelines';

export default function CommunityGuidelinesView() {
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
          Community Guidelines
        </ThemedText>
        <View style={{ width: sizes.iconSmall }} />
      </View>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
         <View style={[styles.section, { backgroundColor: surfaceColor, borderColor, borderWidth: 1 }]}>
           <ThemedText style={[styles.title, { color: textColor }]}>
             Community Guidelines
           </ThemedText>
           <ThemedText style={[styles.lastUpdated, { color: lightTextColor }]}>
             Last Updated: {communityGuidelinesData.lastUpdated}
           </ThemedText>
         </View>

        {communityGuidelinesData.sections.map(renderSection)}

        <View style={[styles.footer, { borderTopColor: borderColor }]}>
          <ThemedText style={[styles.footerText, { color: lightTextColor }]}>
            For questions about these guidelines, please contact us at support@youngie.social
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
  },
  title: {
    fontSize: typography.sizes.heading1,
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
