import React from 'react';
import { StyleSheet, Switch, TouchableOpacity, ScrollView, Alert, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol, IconName } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { spacing, borderRadius, typography, sizes } from '@/constants/design-tokens';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { userAPI } from '@/utils/api';
import * as Haptics from 'expo-haptics';

interface SettingItemProps {
    icon: IconName;
    label: string;
    value?: string | boolean;
    onPress?: () => void;
    isDestructive?: boolean;
    borderColor: string;
    errorColor: string;
    surfaceColor: string;
    textColor: string;
    lightTextColor: string;
    primaryColor: string;
}

function SettingItem({
    icon,
    label,
    value,
    onPress,
    isDestructive = false,
    borderColor,
    errorColor,
    surfaceColor,
    textColor,
    lightTextColor,
    primaryColor,
}: SettingItemProps) {
    return (
        <TouchableOpacity
            style={[styles.item, { borderBottomColor: borderColor }]}
            onPress={() => {
                if (onPress) {
                    Haptics.selectionAsync();
                    onPress();
                }
            }}
            disabled={value === undefined && !onPress}
        >
            <View style={styles.itemLeft}>
                <View style={[styles.iconContainer, { backgroundColor: isDestructive ? errorColor + '20' : surfaceColor }]}>
                    <IconSymbol name={icon} size={20} color={isDestructive ? errorColor : textColor} />
                </View>
                <ThemedText style={[styles.label, isDestructive && { color: errorColor }]}>{label}</ThemedText>
            </View>
            <View style={styles.itemRight}>
                {typeof value === 'string' && (
                    <ThemedText style={{ color: lightTextColor, marginRight: spacing.sm }}>{value}</ThemedText>
                )}
                {(onPress || typeof value === 'string') && (
                    <IconSymbol name="chevron.right" size={20} color={lightTextColor} />
                )}
                {typeof value === 'boolean' && (
                    <Switch
                        value={value}
                        onValueChange={onPress}
                        trackColor={{ false: surfaceColor, true: primaryColor }}
                    />
                )}
            </View>
        </TouchableOpacity>
    );
}

export default function SettingsScreen() {
    const router = useRouter();
    const { logout } = useAuth();
    const { mode } = useTheme();
    const backgroundColor = useThemeColor('background');
    const textColor = useThemeColor('text');
    const lightTextColor = useThemeColor('lightText');
    const borderColor = useThemeColor('border');
    const surfaceColor = useThemeColor('surface');
    const primaryColor = useThemeColor('primary');
    const errorColor = useThemeColor('error');

    const handleLogout = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        Alert.alert(
            'Log Out',
            'Are you sure you want to log out?',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Log Out', style: 'destructive', onPress: logout }
            ]
        );
    };

    const handleDeleteAccount = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        Alert.alert(
            'Delete Account',
            'Your account will be deactivated and your photos, posts and messages will be permanently deleted after 30 days. This cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await userAPI.deleteAccount();
                            Alert.alert('Account deleted', 'Your account has been scheduled for deletion.');
                            await logout();
                        } catch {
                            Alert.alert('Error', 'Could not delete your account. Please try again.');
                        }
                    },
                },
            ]
        );
    };

    const settingColors = { borderColor, errorColor, surfaceColor, textColor, lightTextColor, primaryColor };

    return (
        <ThemedView style={[styles.container, { backgroundColor }]} safe>
            <View style={[styles.header, { borderBottomColor: borderColor }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <IconSymbol name="chevron.left" size={24} color={textColor} />
                </TouchableOpacity>
                <ThemedText type="title" style={{ fontFamily: typography.families.bold }}>Settings</ThemedText>
                <View style={{ width: sizes.iconSmall }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <ThemedText style={[styles.sectionTitle, { color: lightTextColor }]}>Account</ThemedText>
                <View style={[styles.section, { backgroundColor: surfaceColor, borderColor, borderWidth: sizes.dividerWidth }]}>
                    <SettingItem {...settingColors} icon="shield" label="Security" onPress={() => router.push('/security-settings')} />
                    <SettingItem {...settingColors} icon="lock" label="Privacy" onPress={() => router.push('/privacy-settings')} />
                    <SettingItem {...settingColors} icon="volume-mute" label="Muted Users" onPress={() => router.push('/muted-users')} />
                    <SettingItem {...settingColors} icon="person.slash" label="Blocked Users" onPress={() => router.push('/blocked-users')} />
                </View>

                <ThemedText style={[styles.sectionTitle, { color: lightTextColor }]}>App Settings</ThemedText>
                <View style={[styles.section, { backgroundColor: surfaceColor, borderColor, borderWidth: sizes.dividerWidth }]}>
                    <SettingItem {...settingColors} icon={mode === 'dark' ? 'moon' : mode === 'light' ? 'sun.max' : 'device-phone-portrait'} label="Appearance" value={mode.charAt(0).toUpperCase() + mode.slice(1)} onPress={() => router.push('/appearance')} />
                </View>

                <ThemedText style={[styles.sectionTitle, { color: lightTextColor }]}>Support</ThemedText>
                <View style={[styles.section, { backgroundColor: surfaceColor, borderColor, borderWidth: sizes.dividerWidth }]}>
                    <SettingItem {...settingColors} icon="help-circle" label="Help Center" onPress={() => router.push('/help-center')} />
                    <SettingItem {...settingColors} icon="shield-check" label="Policies" onPress={() => router.push('/policies')} />
                    <SettingItem {...settingColors} icon="info" label="About" onPress={() => router.push('/about')} />
                </View>

                <View style={[styles.section, { backgroundColor: surfaceColor, borderColor, borderWidth: sizes.dividerWidth, marginTop: spacing.lg }]}>
                    <SettingItem {...settingColors} icon="log-out" label="Log Out" onPress={handleLogout} isDestructive />
                </View>

                <View style={[styles.section, { backgroundColor: surfaceColor, borderColor, borderWidth: sizes.dividerWidth, marginTop: spacing.lg }]}>
                    <SettingItem {...settingColors} icon="trash" label="Delete Account" onPress={handleDeleteAccount} isDestructive />
                </View>
                
                <ThemedText style={[styles.version, { color: lightTextColor }]}>Version 1.0.0</ThemedText>
            </ScrollView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1 },
    backButton: { padding: spacing.xs },
    content: { padding: spacing.md },
    sectionTitle: { fontSize: typography.sizes.caption, fontFamily: typography.families.bold, marginBottom: spacing.xs, marginLeft: spacing.xs, marginTop: spacing.md, textTransform: 'uppercase' },
    section: { borderRadius: borderRadius.lg, overflow: 'hidden' },
    item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1 },
    itemLeft: { flexDirection: 'row', alignItems: 'center' },
    iconContainer: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
    label: { fontSize: typography.sizes.body1, fontFamily: typography.families.medium },
    itemRight: { flexDirection: 'row', alignItems: 'center' },
    version: { textAlign: 'center', marginTop: spacing.xl, marginBottom: spacing.xl, fontSize: typography.sizes.caption },
});