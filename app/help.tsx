import React from 'react';
import { StyleSheet, ScrollView, Linking, View, TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { spacing, typography } from '@/constants/design-tokens';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function HelpScreen() {
    const router = useRouter();
    const backgroundColor = useThemeColor('background');
    const textColor = useThemeColor('text');
    const primaryColor = useThemeColor('primary');

    const handleContact = () => {
        Linking.openURL('mailto:support@youngie.com?subject=Help Request');
    };

    return (
        <ThemedView style={[styles.container, { backgroundColor }]}>
            <Stack.Screen options={{ title: 'Help & Support' }} />

            <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
                <View style={styles.section}>
                    <ThemedText style={[styles.sectionTitle, { color: textColor }]}>
                        Getting Started
                    </ThemedText>
                    <ThemedText style={[styles.text, { color: textColor }]}>
                        Welcome to Youngie! Here's how to get started:
                    </ThemedText>
                    <ThemedText style={[styles.bullet, { color: textColor }]}>
                        • Create your profile and add interests
                    </ThemedText>
                    <ThemedText style={[styles.bullet, { color: textColor }]}>
                        • Swipe through profiles to find matches
                    </ThemedText>
                    <ThemedText style={[styles.bullet, { color: textColor }]}>
                        • Start chatting with your matches
                    </ThemedText>
                    <ThemedText style={[styles.bullet, { color: textColor }]}>
                        • Join communities and share posts
                    </ThemedText>
                </View>

                <View style={styles.section}>
                    <ThemedText style={[styles.sectionTitle, { color: textColor }]}>
                        Features
                    </ThemedText>
                    <ThemedText style={[styles.text, { color: textColor }]}>
                        • Swipe: Find and match with other users
                    </ThemedText>
                    <ThemedText style={[styles.text, { color: textColor }]}>
                        • Chat: Private messaging with matches
                    </ThemedText>
                    <ThemedText style={[styles.text, { color: textColor }]}>
                        • Stories: Share temporary posts
                    </ThemedText>
                    <ThemedText style={[styles.text, { color: textColor }]}>
                        • Communities: Join groups and discussions
                    </ThemedText>
                    <ThemedText style={[styles.text, { color: textColor }]}>
                        • Posts: Share content and interact
                    </ThemedText>
                </View>

                <View style={styles.section}>
                    <ThemedText style={[styles.sectionTitle, { color: textColor }]}>
                        Privacy & Safety
                    </ThemedText>
                    <ThemedText style={[styles.text, { color: textColor }]}>
                        Your privacy is important to us. You can:
                    </ThemedText>
                    <ThemedText style={[styles.bullet, { color: textColor }]}>
                        • Make your account private
                    </ThemedText>
                    <ThemedText style={[styles.bullet, { color: textColor }]}>
                        • Block unwanted users
                    </ThemedText>
                    <ThemedText style={[styles.bullet, { color: textColor }]}>
                        • Mute story notifications
                    </ThemedText>
                    <ThemedText style={[styles.bullet, { color: textColor }]}>
                        • Report inappropriate content
                    </ThemedText>
                </View>

                <View style={styles.section}>
                    <ThemedText style={[styles.sectionTitle, { color: textColor }]}>
                        Need More Help?
                    </ThemedText>
                    <TouchableOpacity style={[styles.contactButton, { borderColor: primaryColor }]} onPress={handleContact}>
                        <IconSymbol name="envelope" size={20} color={primaryColor} />
                        <ThemedText style={[styles.contactText, { color: primaryColor }]}>
                            Contact Support
                        </ThemedText>
                    </TouchableOpacity>
                    <ThemedText style={[styles.disclaimer, { color: textColor }]}>
                        For urgent issues, please email us at support@youngie.com
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
    scrollContainer: {
        flex: 1,
        padding: spacing.md,
    },
    section: {
        marginBottom: spacing.xl,
    },
    sectionTitle: {
        fontSize: typography.sizes.heading4,
        fontFamily: typography.families.bold,
        marginBottom: spacing.md,
    },
    text: {
        fontSize: typography.sizes.body1,
        marginBottom: spacing.sm,
        lineHeight: 22,
    },
    bullet: {
        fontSize: typography.sizes.body1,
        marginBottom: spacing.xs,
        marginLeft: spacing.md,
        lineHeight: 22,
    },
    contactButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.md,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: spacing.md,
    },
    contactText: {
        fontSize: typography.sizes.body1,
        fontFamily: typography.families.medium,
        marginLeft: spacing.sm,
    },
    disclaimer: {
        fontSize: typography.sizes.caption,
        textAlign: 'center',
        opacity: 0.7,
    },
});