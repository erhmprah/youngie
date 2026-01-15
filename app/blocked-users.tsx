import React, { useState, useEffect } from 'react';
import { StyleSheet, FlatList, TouchableOpacity, Image, View, ActivityIndicator, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { userAPI, getImageUrl } from '@/utils/api';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { spacing, borderRadius, typography } from '@/constants/design-tokens';
import { useAuth } from '@/contexts/AuthContext';

interface BlockedUser {
    _id: string;
    username: string;
    profilePhoto?: string;
    avatar?: string;
}

export default function BlockedUsersScreen() {
    const { user } = useAuth();
    const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const backgroundColor = useThemeColor('background');
    const textColor = useThemeColor('text');
    const surfaceColor = useThemeColor('surface');
    const primaryColor = useThemeColor('primary');

    useEffect(() => {
        fetchBlockedUsers();
    }, []);

    const fetchBlockedUsers = async () => {
        try {
            const response = await userAPI.getBlockedUsers();
            setBlockedUsers(response.data);
        } catch (error) {
            console.error('Failed to fetch blocked users:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleUnblock = async (userId: string, username: string) => {
        if (!user?._id) return;
        try {
            await userAPI.unblockUser(user._id, userId);
            setBlockedUsers(prev => prev.filter(u => u._id !== userId));
            Alert.alert('Success', `${username} has been unblocked`);
        } catch (error) {
            console.error('Failed to unblock user:', error);
            Alert.alert('Error', 'Failed to unblock user');
        }
    };

    const renderItem = ({ item }: { item: BlockedUser }) => (
        <View style={[styles.userItem, { backgroundColor: surfaceColor }]}>
            <View style={styles.userInfo}>
                <Image 
                    source={{ uri: getImageUrl(item.profilePhoto || item.avatar) }} 
                    style={styles.avatar} 
                />
                <ThemedText style={styles.username}>{item.username}</ThemedText>
            </View>
            <TouchableOpacity 
                style={[styles.unblockButton, { borderColor: primaryColor }]}
                onPress={() => handleUnblock(item._id, item.username)}
            >
                <ThemedText style={{ color: primaryColor, fontSize: typography.sizes.caption, fontFamily: typography.families.bold }}>
                    Unblock
                </ThemedText>
            </TouchableOpacity>
        </View>
    );

    return (
        <ThemedView style={[styles.container, { backgroundColor }]}>
            <Stack.Screen options={{ title: 'Blocked Users', headerBackTitle: 'Privacy' }} />
            
            {isLoading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={primaryColor} />
                </View>
            ) : blockedUsers.length === 0 ? (
                <View style={styles.centerContainer}>
                    <IconSymbol name="shield" size={48} color={textColor} style={{ opacity: 0.5 }} />
                    <ThemedText style={[styles.emptyText, { color: textColor }]}>
                        No blocked users
                    </ThemedText>
                </View>
            ) : (
                <FlatList
                    data={blockedUsers}
                    renderItem={renderItem}
                    keyExtractor={item => item._id}
                    contentContainerStyle={styles.listContent}
                />
            )}
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: spacing.md,
    },
    userItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.md,
        borderRadius: borderRadius.md,
        marginBottom: spacing.sm,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: spacing.md,
        backgroundColor: '#ccc',
    },
    username: {
        fontSize: typography.sizes.body1,
        fontFamily: typography.families.medium,
    },
    unblockButton: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.round,
        borderWidth: 1,
    },
    emptyText: {
        marginTop: spacing.md,
        fontSize: typography.sizes.body1,
        opacity: 0.7,
    },
});