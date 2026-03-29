import React, { useState, useEffect } from 'react';
import { StyleSheet, FlatList, TouchableOpacity, Image, View, ActivityIndicator, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { userAPI, getImageUrl } from '@/utils/api';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { spacing, borderRadius, typography } from '@/constants/design-tokens';

interface MutedUser {
    _id: string;
    username: string;
    profilePhoto?: string;
    avatar?: string;
}

export default function MutedUsersScreen() {
    const router = useRouter();
    const [mutedUsers, setMutedUsers] = useState<MutedUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const backgroundColor = useThemeColor('background');
    const textColor = useThemeColor('text');
    const surfaceColor = useThemeColor('surface');
    const primaryColor = useThemeColor('primary');

    useEffect(() => {
        fetchMutedUsers();
    }, []);

    const fetchMutedUsers = async () => {
        try {
            const response = await userAPI.getMutedUsers();
            setMutedUsers(response.data);
        } catch (error) {
            Alert.alert('Error', 'Failed to load muted users');
        } finally {
            setIsLoading(false);
        }
    };

    const handleUnmute = async (userId: string, username: string) => {
        try {
            await userAPI.unmuteUser(userId);
            setMutedUsers(prev => prev.filter(u => u._id !== userId));
            Alert.alert('Success', `Unmuted ${username}'s posts`);
        } catch (error) {
            Alert.alert('Error', 'Failed to unmute user');
        }
    };

    const renderItem = ({ item }: { item: MutedUser }) => (
        <View style={[styles.userItem, { backgroundColor: surfaceColor }]}>
            <View style={styles.userInfo}>
                <Image 
                    source={{ uri: getImageUrl(item.profilePhoto || item.avatar) }} 
                    style={styles.avatar} 
                />
                <ThemedText style={styles.username}>{item.username}</ThemedText>
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
        <ThemedView style={[styles.container, { backgroundColor }]} safe>
            <Stack.Screen options={{ title: 'Muted Users', headerBackTitle: 'Settings' }} />
            
            {isLoading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={primaryColor} />
                </View>
            ) : mutedUsers.length === 0 ? (
                <View style={styles.centerContainer}>
                    <IconSymbol name="speaker.slash" size={48} color={textColor} style={{ opacity: 0.5 }} />
                    <ThemedText style={[styles.emptyText, { color: textColor }]}>
                        No muted users
                    </ThemedText>
                    <ThemedText style={[styles.emptySubtext, { color: textColor }]}>
                        Users you mute won't appear in your feed
                    </ThemedText>
                </View>
            ) : (
                <FlatList
                    data={mutedUsers}
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
    unmuteButton: {
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
    emptySubtext: {
        marginTop: spacing.xs,
        fontSize: typography.sizes.caption,
        opacity: 0.5,
        textAlign: 'center',
    },
});