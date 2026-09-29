import React from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, Linking, Image } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { spacing, borderRadius, typography } from '@/constants/design-tokens';
import { IconSymbol } from '@/components/ui/icon-symbol';
import * as Haptics from 'expo-haptics';

export default function AboutScreen() {
    const router = useRouter();
    const backgroundColor = useThemeColor('background');
    const textColor = useThemeColor('text');
    const lightTextColor = useThemeColor('lightText');
    const surfaceColor = useThemeColor('surface');
    const primaryColor = useThemeColor('primary');
    const borderColor = useThemeColor('border');

    const handleOpenLink = async (url: string) => {
        Haptics.selectionAsync();
        try {
            await Linking.openURL(url);
        } catch (error) {
        }
    };

    return (
        <ThemedView style={[styles.container, { backgroundColor }]} safe>
            <Stack.Screen options={{ title: 'About', headerBackTitle: 'Settings' }} />

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.header}>
                    <View style={[styles.logoContainer, { backgroundColor: primaryColor }]}>
                        <Image source={require('@/assets/images/youngie_icon.png')} style={styles.logo} resizeMode="contain" />
                    </View>
                    <ThemedText style={[styles.appName, { color: textColor }]}>Youngie</ThemedText>
                    <ThemedText style={[styles.version, { color: lightTextColor }]}>Version 1.0.0</ThemedText>
                </View>

                <View style={[styles.section, { backgroundColor: surfaceColor, borderColor, borderWidth: 1 }]}>
                    <ThemedText style={[styles.sectionTitle, { color: textColor }]}>About Youngie</ThemedText>
                    <ThemedText style={[styles.description, { color: lightTextColor }]}>
                        Youngie is a social networking app designed for young people to connect, share, and discover new experiences.
                        Our mission is to create meaningful connections and foster a positive community.
                    </ThemedText>
                </View>

                <View style={[styles.section, { backgroundColor: surfaceColor, borderColor, borderWidth: 1 }]}>
                    <ThemedText style={[styles.sectionTitle, { color: textColor }]}>Features</ThemedText>
                    <View style={styles.featuresList}>
                        <View style={styles.featureItem}>
                            <IconSymbol name="person.2" size={20} color={primaryColor} />
                            <ThemedText style={[styles.featureText, { color: textColor }]}>Connect with friends</ThemedText>
                        </View>
                        <View style={styles.featureItem}>
                            <IconSymbol name="camera" size={20} color={primaryColor} />
                            <ThemedText style={[styles.featureText, { color: textColor }]}>Share photos and videos</ThemedText>
                        </View>
                        <View style={styles.featureItem}>
                            <IconSymbol name="message" size={20} color={primaryColor} />
                            <ThemedText style={[styles.featureText, { color: textColor }]}>Real-time messaging</ThemedText>
                        </View>
                        <View style={styles.featureItem}>
                            <IconSymbol name="globe" size={20} color={primaryColor} />
                            <ThemedText style={[styles.featureText, { color: textColor }]}>Discover communities</ThemedText>
                        </View>
                    </View>
                </View>

                <View style={[styles.section, { backgroundColor: surfaceColor, borderColor, borderWidth: 1 }]}>
                    <ThemedText style={[styles.sectionTitle, { color: textColor }]}>Contact Us</ThemedText>
                    <TouchableOpacity
                        style={styles.contactItem}
                        onPress={() => handleOpenLink('mailto:support@youngie.com')}
                    >
                        <IconSymbol name="envelope" size={20} color={primaryColor} />
                        <ThemedText style={[styles.contactText, { color: textColor }]}>support@youngie.com</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.contactItem}
                        onPress={() => handleOpenLink('https://youngie.com')}
                    >
                        <IconSymbol name="globe" size={20} color={primaryColor} />
                        <ThemedText style={[styles.contactText, { color: textColor }]}>www.youngie.com</ThemedText>
                    </TouchableOpacity>
                </View>

                <View style={[styles.section, { backgroundColor: surfaceColor, borderColor, borderWidth: 1 }]}>
                    <ThemedText style={[styles.sectionTitle, { color: textColor }]}>Legal</ThemedText>
                    <TouchableOpacity
                        style={styles.legalItem}
                        onPress={() => handleOpenLink('https://youngback.onrender.com/static-pages/policy')}
                    >
                        <ThemedText style={[styles.legalText, { color: textColor }]}>Privacy Policy</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.legalItem}
                        onPress={() => handleOpenLink('https://youngback.onrender.com/static-pages/terms')}
                    >
                        <ThemedText style={[styles.legalText, { color: textColor }]}>Terms of Service</ThemedText>
                    </TouchableOpacity>
                </View>

                <ThemedText style={[styles.copyright, { color: lightTextColor }]}>
                    © 2024 Youngie. All rights reserved.
                </ThemedText>
            </ScrollView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: spacing.md },
    header: { alignItems: 'center', marginBottom: spacing.xl },
    logoContainer: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md },
    logo: { width: 48, height: 48 },
    appName: { fontSize: typography.sizes.title, fontFamily: typography.families.bold, marginBottom: spacing.xs },
    version: { fontSize: typography.sizes.caption },
    section: { borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md },
    sectionTitle: { fontSize: typography.sizes.body1, fontFamily: typography.families.bold, marginBottom: spacing.md },
    description: { fontSize: typography.sizes.body2, lineHeight: 20 },
    featuresList: { gap: spacing.sm },
    featureItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    featureText: { fontSize: typography.sizes.body2 },
    contactItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
    contactText: { fontSize: typography.sizes.body2 },
    legalItem: { marginBottom: spacing.sm },
    legalText: { fontSize: typography.sizes.body2, color: '#007AFF' },
    copyright: { textAlign: 'center', fontSize: typography.sizes.caption, marginTop: spacing.lg },
});