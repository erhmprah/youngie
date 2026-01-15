import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { spacing, borderRadius, typography } from '@/constants/design-tokens';
import { IconSymbol } from '@/components/ui/icon-symbol';
import * as Haptics from 'expo-haptics';

interface FAQItem {
    id: string;
    question: string;
    answer: string;
}

const faqs: FAQItem[] = [
    {
        id: '1',
        question: 'How do I create a post?',
        answer: 'Tap the + button in the feed to create a new post. You can add text, photos, videos, or polls.'
    },
    {
        id: '2',
        question: 'How do I connect with friends?',
        answer: 'Use the swipe feature to discover people, or search for users in the explore tab. Send friend requests to connect.'
    },
    {
        id: '3',
        question: 'How do I start a chat?',
        answer: 'Go to a user\'s profile and tap the message button, or find them in your friends list.'
    },
    {
        id: '4',
        question: 'How do I join a community?',
        answer: 'Browse communities in the explore tab and tap "Join" on communities that interest you.'
    },
    {
        id: '5',
        question: 'How do I change my privacy settings?',
        answer: 'Go to Settings > Privacy to control who can see your posts and profile information.'
    },
    {
        id: '6',
        question: 'How do I report inappropriate content?',
        answer: 'Tap the menu (⋯) on any post or profile and select "Report" to report inappropriate content.'
    }
];

export default function HelpCenterScreen() {
    const router = useRouter();
    const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);

    const backgroundColor = useThemeColor('background');
    const textColor = useThemeColor('text');
    const lightTextColor = useThemeColor('lightText');
    const surfaceColor = useThemeColor('surface');
    const primaryColor = useThemeColor('primary');
    const borderColor = useThemeColor('border');

    const toggleFAQ = (id: string) => {
        Haptics.selectionAsync();
        setExpandedFAQ(expandedFAQ === id ? null : id);
    };

    const handleContactSupport = () => {
        Haptics.selectionAsync();
        Linking.openURL('mailto:support@youngie.com');
    };

    const handleOpenFAQ = () => {
        Haptics.selectionAsync();
        // Could scroll to FAQ section or open external link
    };

    return (
        <ThemedView style={[styles.container, { backgroundColor }]} safe>
            <Stack.Screen options={{ title: 'Help Center', headerBackTitle: 'Settings' }} />

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.header}>
                    <View style={[styles.iconContainer, { backgroundColor: primaryColor }]}>
                        <IconSymbol name="questionmark.circle" size={32} color="white" />
                    </View>
                    <ThemedText style={[styles.title, { color: textColor }]}>How can we help you?</ThemedText>
                    <ThemedText style={[styles.subtitle, { color: lightTextColor }]}>
                        Find answers to common questions or contact our support team.
                    </ThemedText>
                </View>

                <View style={[styles.section, { backgroundColor: surfaceColor, borderColor, borderWidth: 1 }]}>
                    <ThemedText style={[styles.sectionTitle, { color: textColor }]}>Quick Actions</ThemedText>
                    <TouchableOpacity
                        style={[styles.actionButton, { borderColor }]}
                        onPress={handleContactSupport}
                    >
                        <IconSymbol name="envelope" size={20} color={primaryColor} />
                        <View style={styles.actionText}>
                            <ThemedText style={[styles.actionTitle, { color: textColor }]}>Contact Support</ThemedText>
                            <ThemedText style={[styles.actionSubtitle, { color: lightTextColor }]}>Get help from our team</ThemedText>
                        </View>
                        <IconSymbol name="chevron.right" size={20} color={lightTextColor} />
                    </TouchableOpacity>
                </View>

                <View style={[styles.section, { backgroundColor: surfaceColor, borderColor, borderWidth: 1 }]}>
                    <ThemedText style={[styles.sectionTitle, { color: textColor }]}>Frequently Asked Questions</ThemedText>
                    {faqs.map((faq) => (
                        <TouchableOpacity
                            key={faq.id}
                            style={[styles.faqItem, { borderBottomColor: borderColor }]}
                            onPress={() => toggleFAQ(faq.id)}
                        >
                            <View style={styles.faqHeader}>
                                <ThemedText style={[styles.faqQuestion, { color: textColor }]}>
                                    {faq.question}
                                </ThemedText>
                                <IconSymbol
                                    name={expandedFAQ === faq.id ? "chevron.up" : "chevron.down"}
                                    size={16}
                                    color={lightTextColor}
                                />
                            </View>
                            {expandedFAQ === faq.id && (
                                <ThemedText style={[styles.faqAnswer, { color: lightTextColor }]}>
                                    {faq.answer}
                                </ThemedText>
                            )}
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={[styles.section, { backgroundColor: surfaceColor, borderColor, borderWidth: 1 }]}>
                    <ThemedText style={[styles.sectionTitle, { color: textColor }]}>Still need help?</ThemedText>
                    <ThemedText style={[styles.helpText, { color: lightTextColor }]}>
                        Can't find what you're looking for? Our support team is here to help.
                    </ThemedText>
                    <TouchableOpacity
                        style={[styles.contactButton, { backgroundColor: primaryColor }]}
                        onPress={handleContactSupport}
                    >
                        <ThemedText style={[styles.contactButtonText, { color: 'white' }]}>
                            Contact Support
                        </ThemedText>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: spacing.md },
    header: { alignItems: 'center', marginBottom: spacing.xl },
    iconContainer: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md },
    title: { fontSize: typography.sizes.title, fontFamily: typography.families.bold, marginBottom: spacing.xs, textAlign: 'center' },
    subtitle: { fontSize: typography.sizes.body2, textAlign: 'center', lineHeight: 20 },
    section: { borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md },
    sectionTitle: { fontSize: typography.sizes.body1, fontFamily: typography.families.bold, marginBottom: spacing.md },
    actionButton: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderWidth: 1, borderRadius: borderRadius.md, marginBottom: spacing.sm },
    actionText: { flex: 1, marginLeft: spacing.sm },
    actionTitle: { fontSize: typography.sizes.body1, fontFamily: typography.families.medium },
    actionSubtitle: { fontSize: typography.sizes.caption },
    faqItem: { paddingVertical: spacing.md, borderBottomWidth: 1 },
    faqHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    faqQuestion: { fontSize: typography.sizes.body1, fontFamily: typography.families.medium, flex: 1 },
    faqAnswer: { fontSize: typography.sizes.body2, lineHeight: 20, marginTop: spacing.sm, paddingLeft: spacing.sm },
    helpText: { fontSize: typography.sizes.body2, lineHeight: 20, marginBottom: spacing.md },
    contactButton: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: borderRadius.md, alignItems: 'center' },
    contactButtonText: { fontSize: typography.sizes.body1, fontFamily: typography.families.medium },
});