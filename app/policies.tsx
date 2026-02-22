// Policies Screen - Displays all app policies

import React from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { spacing, borderRadius, typography } from '@/constants/design-tokens';

interface PolicyItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  route: string;
}

const policies: PolicyItem[] = [
  {
    id: 'privacy',
    title: 'Privacy Policy',
    description: 'Learn how we collect, use, and protect your personal information',
    icon: 'lock.shield',
    route: '/privacy'
  },
  {
    id: 'terms',
    title: 'Terms of Service',
    description: 'The rules and guidelines for using Youngie',
    icon: 'doc.text',
    route: '/terms'
  },
  {
    id: 'community',
    title: 'Community Guidelines',
    description: 'Standards for respectful and safe interactions',
    icon: 'person.3',
    route: '/community'
  },
  {
    id: 'data',
    title: 'Data Policy',
    description: 'How we handle and process your data',
    icon: 'chart.bar',
    route: '/data'
  }
];

export default function PoliciesScreen() {
  const router = useRouter();
  const backgroundColor = useThemeColor('background');
  const textColor = useThemeColor('text');
  const lightTextColor = useThemeColor('lightText');
  const borderColor = useThemeColor('border');
  const surfaceColor = useThemeColor('surface');
  const primaryColor = useThemeColor('primary');

  const handlePolicyPress = (route: string) => {
    router.push(route as any);
  };

  const renderPolicyItem = (item: PolicyItem) => (
    <TouchableOpacity
      key={item.id}
      style={[styles.policyItem, { backgroundColor: surfaceColor, borderColor }]}
      onPress={() => handlePolicyPress(item.route)}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: primaryColor + '20' }]}>
        <IconSymbol name={item.icon as any} size={24} color={primaryColor} />
      </View>
      <View style={styles.policyContent}>
        <ThemedText style={[styles.policyTitle, { color: textColor }]}>
          {item.title}
        </ThemedText>
        <ThemedText style={[styles.policyDescription, { color: lightTextColor }]}>
          {item.description}
        </ThemedText>
      </View>
      <IconSymbol name="chevron.right" size={20} color={lightTextColor} />
    </TouchableOpacity>
  );

  return (
    <ThemedView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <ThemedText style={[styles.headerTitle, { color: textColor }]}>
            Policies & Guidelines
          </ThemedText>
          <ThemedText style={[styles.headerSubtitle, { color: lightTextColor }]}>
            Review our policies to understand your rights and responsibilities
          </ThemedText>
        </View>

        <View style={styles.policiesList}>
          {policies.map(renderPolicyItem)}
        </View>

        <View style={[styles.lastUpdated, { backgroundColor: surfaceColor, borderColor }]}>
          <IconSymbol name="clock" size={16} color={lightTextColor} />
          <ThemedText style={[styles.lastUpdatedText, { color: lightTextColor }]}>
            All policies were last updated on February 22, 2026
          </ThemedText>
        </View>

        <View style={styles.footer}>
          <ThemedText style={[styles.footerTitle, { color: textColor }]}>
            Need Help?
          </ThemedText>
          <TouchableOpacity 
            style={[styles.helpButton, { borderColor }]}
            onPress={() => router.push('/help-center')}
          >
            <IconSymbol name="questionmark.circle" size={20} color={primaryColor} />
            <ThemedText style={[styles.helpButtonText, { color: primaryColor }]}>
              Visit Help Center
            </ThemedText>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.helpButton, { borderColor }]}
            onPress={() => Linking.openURL('mailto:support@youngieapp.com')}
          >
            <IconSymbol name="envelope" size={20} color={primaryColor} />
            <ThemedText style={[styles.helpButtonText, { color: primaryColor }]}>
              Contact Support
            </ThemedText>
          </TouchableOpacity>
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
  },
  headerTitle: {
    fontSize: typography.sizes.heading2,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.sm,
  },
  headerSubtitle: {
    fontSize: typography.sizes.body1,
    lineHeight: typography.sizes.body1 * 1.5,
  },
  policiesList: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  policyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  policyContent: {
    flex: 1,
    marginRight: spacing.sm,
  },
  policyTitle: {
    fontSize: typography.sizes.body1,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.xs,
  },
  policyDescription: {
    fontSize: typography.sizes.body2,
    lineHeight: typography.sizes.body2 * 1.4,
  },
  lastUpdated: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: spacing.xl,
  },
  lastUpdatedText: {
    fontSize: typography.sizes.body2,
    marginLeft: spacing.sm,
  },
  footer: {
    alignItems: 'center',
  },
  footerTitle: {
    fontSize: typography.sizes.title,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.md,
  },
  helpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    width: '100%',
    marginBottom: spacing.sm,
  },
  helpButtonText: {
    fontSize: typography.sizes.body1,
    fontWeight: typography.weights.medium,
    marginLeft: spacing.sm,
  },
});
