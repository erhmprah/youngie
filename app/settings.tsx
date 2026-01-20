import React from 'react';
import { StyleSheet, Switch, TouchableOpacity, ScrollView, Alert, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol, IconName } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { spacing, borderRadius, typography } from '@/constants/design-tokens';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import * as Haptics from 'expo-haptics';

export default function SettingsScreen() {
    const router = useRouter();
    const { logout } = useAuth();
    const { mode } = useTheme();
    const colorScheme = useColorScheme();
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

    const SettingItem = ({ icon, label, value, onPress, isDestructive = false }: { icon: IconName, label: string, value?: string | boolean, onPress?: () => void, isDestructive?: boolean }) => (
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

    return (
        <ThemedView style={[styles.container, { backgroundColor }]} safe>
            <View style={[styles.header, { borderBottomColor: borderColor }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <IconSymbol name="chevron.left" size={24} color={textColor} />
                </TouchableOpacity>
                <ThemedText type="title" style={{ fontFamily: typography.families.bold }}>Settings</ThemedText>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <ThemedText style={[styles.sectionTitle, { color: lightTextColor }]}>Account</ThemedText>
                <View style={[styles.section, { backgroundColor: surfaceColor, borderColor, borderWidth: 1 }]}>
                    <SettingItem icon="shield" label="Security" onPress={() => router.push('/security-settings')} />
                    <SettingItem icon="lock" label="Privacy" onPress={() => router.push('/privacy-settings')} />
                    <SettingItem icon="volume-mute" label="Muted Users" onPress={() => router.push('/muted-users')} />
                </View>

                <ThemedText style={[styles.sectionTitle, { color: lightTextColor }]}>App Settings</ThemedText>
                <View style={[styles.section, { backgroundColor: surfaceColor, borderColor, borderWidth: 1 }]}>
                    <SettingItem icon={mode === 'dark' ? 'moon' : mode === 'light' ? 'sun.max' : 'device-phone-portrait'} label="Appearance" value={mode.charAt(0).toUpperCase() + mode.slice(1)} onPress={() => router.push('/appearance')} />
                </View>

                <ThemedText style={[styles.sectionTitle, { color: lightTextColor }]}>Support</ThemedText>
                <View style={[styles.section, { backgroundColor: surfaceColor, borderColor, borderWidth: 1 }]}>
                    <SettingItem icon="help-circle" label="Help Center" onPress={() => router.push('/help-center')} />
                    <SettingItem icon="info" label="About" onPress={() => router.push('/about')} />
                </View>

                <View style={[styles.section, { backgroundColor: surfaceColor, borderColor, borderWidth: 1, marginTop: spacing.lg }]}>
                    <SettingItem icon="log-out" label="Log Out" onPress={handleLogout} isDestructive />
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