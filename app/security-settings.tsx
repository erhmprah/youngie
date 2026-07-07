import React from 'react';
import { StyleSheet, View, TouchableOpacity, ScrollView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { spacing, borderRadius, typography } from '@/constants/design-tokens';
import { IconSymbol } from '@/components/ui/icon-symbol';
import * as Haptics from 'expo-haptics';

export default function SecuritySettingsScreen() {
    const router = useRouter();

    const backgroundColor = useThemeColor('background');
    const textColor = useThemeColor('text');
    const lightTextColor = useThemeColor('lightText');
    const surfaceColor = useThemeColor('surface');
    const primaryColor = useThemeColor('primary');
    const borderColor = useThemeColor('border');

    const handleLoginActivity = () => {
        Haptics.selectionAsync();
        router.push('/login-activity');
    };

    return (
        <ThemedView style={[styles.container, { backgroundColor }]} safe>
            <Stack.Screen options={{ title: 'Security', headerBackTitle: 'Settings' }} />

            <ScrollView contentContainerStyle={styles.content}>
                <ThemedText style={[styles.sectionTitle, { color: lightTextColor }]}>Account Management</ThemedText>
                <View style={[styles.section, { backgroundColor: surfaceColor, borderColor, borderWidth: 1 }]}>
                    <TouchableOpacity
                        style={[styles.item, { borderBottomColor: borderColor }]}
                        onPress={handleLoginActivity}
                    >
                        <View style={styles.itemLeft}>
                            <IconSymbol name="clock" size={20} color={textColor} />
                            <ThemedText style={styles.label}>Login Activity</ThemedText>
                        </View>
                        <IconSymbol name="chevron.right" size={20} color={lightTextColor} />
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: spacing.md },
    sectionTitle: { fontSize: typography.sizes.caption, fontFamily: typography.families.bold, marginBottom: spacing.xs, marginLeft: spacing.xs, marginTop: spacing.md, textTransform: 'uppercase' },
    section: { borderRadius: borderRadius.lg, overflow: 'hidden' },
    item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md },
    itemLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    label: { fontSize: typography.sizes.body1, fontFamily: typography.families.medium },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md },
    rowText: { flex: 1, marginRight: spacing.md },
    description: { fontSize: typography.sizes.caption, lineHeight: 18, marginTop: spacing.xs },
});
