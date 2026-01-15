import React, { useState } from 'react';
import { StyleSheet, View, Switch, TouchableOpacity, Alert, ScrollView, TextInput } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { spacing, borderRadius, typography } from '@/constants/design-tokens';
import { IconSymbol } from '@/components/ui/icon-symbol';
import * as Haptics from 'expo-haptics';

export default function SecuritySettingsScreen() {
    const router = useRouter();
    const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
    const [biometricEnabled, setBiometricEnabled] = useState(false);

    const backgroundColor = useThemeColor('background');
    const textColor = useThemeColor('text');
    const lightTextColor = useThemeColor('lightText');
    const surfaceColor = useThemeColor('surface');
    const primaryColor = useThemeColor('primary');
    const borderColor = useThemeColor('border');

    const handleChangePassword = () => {
        Haptics.selectionAsync();
        Alert.alert('Change Password', 'This feature is not yet implemented.');
    };

    const handleToggleTwoFactor = (value: boolean) => {
        Haptics.selectionAsync();
        if (value) {
            Alert.alert(
                'Enable Two-Factor Authentication',
                'This will add an extra layer of security to your account.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Enable', onPress: () => setTwoFactorEnabled(true) }
                ]
            );
        } else {
            setTwoFactorEnabled(false);
        }
    };

    const handleToggleBiometric = (value: boolean) => {
        Haptics.selectionAsync();
        setBiometricEnabled(value);
    };

    const handleLoginActivity = () => {
        Haptics.selectionAsync();
        Alert.alert('Login Activity', 'View your recent login sessions.');
    };

    const handleAccountRecovery = () => {
        Haptics.selectionAsync();
        Alert.alert('Account Recovery', 'Set up recovery options for your account.');
    };

    return (
        <ThemedView style={[styles.container, { backgroundColor }]} safe>
            <Stack.Screen options={{ title: 'Security', headerBackTitle: 'Settings' }} />

            <ScrollView contentContainerStyle={styles.content}>
                <ThemedText style={[styles.sectionTitle, { color: lightTextColor }]}>Account Security</ThemedText>
                <View style={[styles.section, { backgroundColor: surfaceColor, borderColor, borderWidth: 1 }]}>
                    <TouchableOpacity
                        style={[styles.item, { borderBottomColor: borderColor }]}
                        onPress={handleChangePassword}
                    >
                        <View style={styles.itemLeft}>
                            <IconSymbol name="lock" size={20} color={textColor} />
                            <ThemedText style={styles.label}>Change Password</ThemedText>
                        </View>
                        <IconSymbol name="chevron.right" size={20} color={lightTextColor} />
                    </TouchableOpacity>

                    <View style={[styles.row, { borderBottomColor: borderColor }]}>
                        <View style={styles.rowText}>
                            <ThemedText style={styles.label}>Two-Factor Authentication</ThemedText>
                            <ThemedText style={[styles.description, { color: lightTextColor }]}>
                                Add an extra layer of security to your account.
                            </ThemedText>
                        </View>
                        <Switch
                            value={twoFactorEnabled}
                            onValueChange={handleToggleTwoFactor}
                            trackColor={{ false: surfaceColor, true: primaryColor }}
                        />
                    </View>

                    <View style={styles.row}>
                        <View style={styles.rowText}>
                            <ThemedText style={styles.label}>Biometric Login</ThemedText>
                            <ThemedText style={[styles.description, { color: lightTextColor }]}>
                                Use fingerprint or face ID to log in.
                            </ThemedText>
                        </View>
                        <Switch
                            value={biometricEnabled}
                            onValueChange={handleToggleBiometric}
                            trackColor={{ false: surfaceColor, true: primaryColor }}
                        />
                    </View>
                </View>

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

                    <TouchableOpacity
                        style={styles.item}
                        onPress={handleAccountRecovery}
                    >
                        <View style={styles.itemLeft}>
                            <IconSymbol name="key" size={20} color={textColor} />
                            <ThemedText style={styles.label}>Account Recovery</ThemedText>
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