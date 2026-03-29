import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Switch, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { userAPI } from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';
import { spacing, borderRadius, typography } from '@/constants/design-tokens';
import { IconSymbol } from '@/components/ui/icon-symbol';
import * as Haptics from 'expo-haptics';

export default function PrivacySettingsScreen() {
    const { user, updateUser } = useAuth();
    const router = useRouter();
    const [isPrivate, setIsPrivate] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const backgroundColor = useThemeColor('background');
    const textColor = useThemeColor('text');
    const lightTextColor = useThemeColor('lightText');
    const surfaceColor = useThemeColor('surface');
    const primaryColor = useThemeColor('primary');
    const borderColor = useThemeColor('border');

    useEffect(() => {
        if (user) {
            fetchSettings();
        }
    }, [user]);

    const fetchSettings = async () => {
        if (!user?._id) return;
        try {
            const response = await userAPI.getProfile(user._id);
            setIsPrivate(response.data.isPrivate || false);
        } catch (error) {
        } finally {
            setIsLoading(false);
        }
    };

    const handleTogglePrivate = async (value: boolean) => {
        if (!user?._id) return;
        Haptics.selectionAsync();
        setIsPrivate(value); // Optimistic update
        setIsSaving(true);
        try {
            await userAPI.updateProfile(user._id, { isPrivate: value });
            updateUser({ isPrivate: value });
        } catch (error) {
            setIsPrivate(!value); // Revert
            Alert.alert('Error', 'Failed to update settings');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <ThemedView style={[styles.container, { backgroundColor }]} safe>
            <Stack.Screen options={{ title: 'Privacy', headerBackTitle: 'Settings' }} />
            
            {isLoading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={primaryColor} />
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.content}>
                    <ThemedText style={[styles.sectionTitle, { color: lightTextColor }]}>Account Privacy</ThemedText>
                    <View style={[styles.section, { backgroundColor: surfaceColor, borderColor, borderWidth: 1 }]}>
                        <View style={[styles.row, { borderBottomColor: borderColor }]}>
                            <View style={styles.rowText}>
                                <ThemedText style={styles.label}>Private Account</ThemedText>
                                <ThemedText style={[styles.description, { color: lightTextColor }]}>
                                    When your account is private, only people you approve can see your photos and videos. Your existing followers won't be affected.
                                </ThemedText>
                            </View>
                            <Switch
                                value={isPrivate}
                                onValueChange={handleTogglePrivate}
                                trackColor={{ false: surfaceColor, true: primaryColor }}
                            />
                        </View>
                    </View>

                    <ThemedText style={[styles.sectionTitle, { color: lightTextColor }]}>Connections</ThemedText>
                    <View style={[styles.section, { backgroundColor: surfaceColor, borderColor, borderWidth: 1 }]}>
                        <TouchableOpacity 
                            style={styles.item} 
                            onPress={() => {
                                Haptics.selectionAsync();
                                router.push('/blocked-users');
                            }}
                        >
                            <View style={styles.itemLeft}>
                                <IconSymbol name="person.slash" size={20} color={textColor} />
                                <ThemedText style={styles.itemLabel}>Blocked Users</ThemedText>
                            </View>
                            <IconSymbol name="chevron.right" size={20} color={lightTextColor} />
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            )}
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    content: { padding: spacing.md },
    sectionTitle: { fontSize: typography.sizes.caption, fontFamily: typography.families.bold, marginBottom: spacing.xs, marginLeft: spacing.xs, marginTop: spacing.md, textTransform: 'uppercase' },
    section: { borderRadius: borderRadius.lg, overflow: 'hidden' },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md },
    rowText: { flex: 1, marginRight: spacing.md },
    label: { fontSize: typography.sizes.body1, fontFamily: typography.families.medium, marginBottom: spacing.xs },
    description: { fontSize: typography.sizes.caption, lineHeight: 18 },
    item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md },
    itemLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    itemLabel: { fontSize: typography.sizes.body1, fontFamily: typography.families.medium },
});