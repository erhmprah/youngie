import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, Alert, ScrollView, Switch } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { spacing, borderRadius, typography } from '@/constants/design-tokens';
import { userAPI, storyAPI } from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';

interface MutedUser {
    _id: string;
    username: string;
    profilePhoto?: string;
    avatar?: string;
}

export default function SettingsScreen() {
    const router = useRouter();
    const { user, updateUser } = useAuth();
    const [mutedUsers, setMutedUsers] = useState<MutedUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPrivate, setIsPrivate] = useState(false);

    const backgroundColor = useThemeColor('background');
    const textColor = useThemeColor('text');
    const surfaceColor = useThemeColor('surface');
    const primaryColor = useThemeColor('primary');
    const lightTextColor = useThemeColor('lightText');
    const borderColor = useThemeColor('border');

    useEffect(() => {
        fetchMutedUsers();
    }, []);

    useEffect(() => {
        setIsPrivate((user as any)?.isPrivate || false);
    }, [user]);

    const fetchMutedUsers = async () => {
        try {
            const response = await storyAPI.getMutedUsers();
            setMutedUsers(response.data);
        } catch (error) {
            console.error('Failed to fetch muted users:', error);
            Alert.alert('Error', 'Failed to load muted users');
        } finally {
            setIsLoading(false);
        }
    };

    const handleUnmute = async (userId: string, username: string) => {
        try {
            await storyAPI.unmuteUser(userId);
            setMutedUsers(prev => prev.filter(u => u._id !== userId));
            Alert.alert('Success', `Unmuted ${username}'s stories`);
        } catch (error) {
            console.error('Failed to unmute user:', error);
            Alert.alert('Error', 'Failed to unmute user');
        }
    };

    const handlePrivacyToggle = async (value: boolean) => {
        if (!user?._id) return;
        try {
            await userAPI.updateProfile(user._id, { isPrivate: value });
            setIsPrivate(value);
            (updateUser as any)({ isPrivate: value });
            Alert.alert('Success', `Account is now ${value ? 'private' : 'public'}`);
        } catch (error) {
            console.error('Failed to update privacy:', error);
            Alert.alert('Error', 'Failed to update privacy settings');
        }
    };

    const handleLogout = () => {
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Logout', style: 'destructive', onPress: () => {
                    // Handle logout logic here
                    router.replace('/login');
                }}
            ]
        );
    };

    const renderMutedUserItem = ({ item }: { item: MutedUser }) => (
        <View style={[styles.settingItem, { backgroundColor: surfaceColor, borderColor }]}>
            <View style={styles.settingContent}>
                <IconSymbol name="speaker.slash" size={24} color={primaryColor} />
                <ThemedText style={[styles.settingText, { color: textColor }]}>
                    {item.username}
                </ThemedText>
            </View>
            <TouchableOpacity 
                style={[styles.unmuteButton, { borderColor: primaryColor }]}
                onPress={() => handleUnmute(item._id, item.username)}
            >
                <ThemedText style={{ color: primaryColor, fontSize: typography.sizes.caption, fontFamily: typography.families.bold }}>
                    Unmute
                </ThemedText>
            </TouchableOpacity>
        </View>
    );

    return (
        <ThemedView style={[styles.container, { backgroundColor }]}>
            <Stack.Screen options={{ title: 'Settings' }} />
            
            <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
                {/* Privacy Section */}
                <View style={styles.section}>
                    <ThemedText style={[styles.sectionTitle, { color: textColor }]}>
                        Privacy
                    </ThemedText>
                    
                    <TouchableOpacity 
                        style={[styles.settingItem, { backgroundColor: surfaceColor, borderColor }]}
                        onPress={() => router.push('/muted-users')}
                    >
                        <View style={styles.settingContent}>
                            <IconSymbol name="speaker.slash" size={24} color={primaryColor} />
                            <ThemedText style={[styles.settingText, { color: textColor }]}>
                                Muted Users
                            </ThemedText>
                        </View>
                        <IconSymbol name="chevron.right" size={20} color={lightTextColor} />
                    </TouchableOpacity>

                    <View style={[styles.settingItem, { backgroundColor: surfaceColor, borderColor }]}>
                        <View style={styles.settingContent}>
                            <IconSymbol name="lock.fill" size={24} color={primaryColor} />
                            <View>
                                <ThemedText style={[styles.settingText, { color: textColor }]}>
                                    Private Account
                                </ThemedText>
                                <ThemedText style={{ color: lightTextColor, fontSize: typography.sizes.caption }}>
                                    Only approved followers can see your posts
                                </ThemedText>
                            </View>
                        </View>
                        <Switch
                            value={isPrivate}
                            onValueChange={handlePrivacyToggle}
                            trackColor={{ false: '#767577', true: primaryColor }}
                            thumbColor={isPrivate ? '#fff' : '#f4f3f4'}
                        />
                    </View>
                </View>

                {/* Account Section */}
                <View style={styles.section}>
                    <ThemedText style={[styles.sectionTitle, { color: textColor }]}>
                        Account
                    </ThemedText>
                    
                    <TouchableOpacity
                        style={[styles.settingItem, { backgroundColor: surfaceColor, borderColor }]}
                        onPress={() => router.push('/notifications')}
                    >
                        <View style={styles.settingContent}>
                            <IconSymbol name="bell.fill" size={24} color={primaryColor} />
                            <ThemedText style={[styles.settingText, { color: textColor }]}>
                                Notifications
                            </ThemedText>
                        </View>
                        <IconSymbol name="chevron.right" size={20} color={lightTextColor} />
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.settingItem, { backgroundColor: surfaceColor, borderColor }]}>
                        <View style={styles.settingContent}>
                            <IconSymbol name="moon.fill" size={24} color={primaryColor} />
                            <ThemedText style={[styles.settingText, { color: textColor }]}>
                                Dark Mode
                            </ThemedText>
                        </View>
                        <IconSymbol name="chevron.right" size={20} color={lightTextColor} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.settingItem, { backgroundColor: surfaceColor, borderColor }]}
                        onPress={() => router.push('/help')}
                    >
                        <View style={styles.settingContent}>
                            <IconSymbol name="info.circle.fill" size={24} color={primaryColor} />
                            <ThemedText style={[styles.settingText, { color: textColor }]}>
                                Help & Support
                            </ThemedText>
                        </View>
                        <IconSymbol name="chevron.right" size={20} color={lightTextColor} />
                    </TouchableOpacity>
                </View>

                {/* Danger Zone */}
                <View style={styles.section}>
                    <ThemedText style={[styles.sectionTitle, { color: textColor }]}>
                        Danger Zone
                    </ThemedText>
                    
                    <TouchableOpacity 
                        style={[styles.settingItem, styles.dangerItem, { backgroundColor: surfaceColor, borderColor }]}
                        onPress={handleLogout}
                    >
                        <View style={styles.settingContent}>
                            <IconSymbol name="x.circle.fill" size={24} color="#FF3B30" />
                            <ThemedText style={[styles.settingText, { color: textColor }]}>
                                Logout
                            </ThemedText>
                        </View>
                        <IconSymbol name="chevron.right" size={20} color={lightTextColor} />
                    </TouchableOpacity>
                </View>

                {/* Muted Users List */}
                {mutedUsers.length > 0 && (
                    <View style={styles.section}>
                        <ThemedText style={[styles.sectionTitle, { color: textColor }]}>
                            Currently Muted ({mutedUsers.length})
                        </ThemedText>
                        {mutedUsers.map((user) => renderMutedUserItem({ item: user }))}
                    </View>
                )}
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
        marginBottom: spacing.lg,
    },
    sectionTitle: {
        fontSize: typography.sizes.body2,
        fontFamily: typography.families.bold,
        marginBottom: spacing.sm,
        opacity: 0.7,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.md,
        borderRadius: borderRadius.md,
        marginBottom: spacing.sm,
        borderWidth: 1,
    },
    dangerItem: {
        borderColor: '#FF3B30',
    },
    settingContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: spacing.md,
    },
    settingText: {
        fontSize: typography.sizes.body1,
        fontFamily: typography.families.medium,
    },
    unmuteButton: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.round,
        borderWidth: 1,
    },
});