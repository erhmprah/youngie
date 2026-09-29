// components/select-friend-modal.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { Modal, StyleSheet, View, TouchableOpacity, SectionList, ActivityIndicator, Image, TextInput, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { spacing, borderRadius, typography } from '@/constants/design-tokens';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { userAPI, getImageUrl } from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';

interface Friend {
    _id: string;
    username: string;
    profilePhoto?: string;
    age?: number;
}

interface SelectFriendModalProps {
    visible: boolean;
    onClose: () => void;
    onSelectFriend: (friendId: string) => void;
    onCreateGroup?: (friendIds: string[], groupName: string, isTemporary: boolean, isAnonymous: boolean) => void;
}

export function SelectFriendModal({ visible, onClose, onSelectFriend, onCreateGroup }: SelectFriendModalProps) {
    const { user } = useAuth();
    const [friends, setFriends] = useState<Friend[]>([]);
    const [incomingRequests, setIncomingRequests] = useState<Friend[]>([]);
    const [sentRequests, setSentRequests] = useState<Friend[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [friendsPage, setFriendsPage] = useState(1);
    const [friendsHasMore, setFriendsHasMore] = useState(true);
    const [friendsLoadingMore, setFriendsLoadingMore] = useState(false);
    const [isGroupMode, setIsGroupMode] = useState(false);
    const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
    const [groupName, setGroupName] = useState('');
    const [isTemporary, setIsTemporary] = useState(false);
    const [isAnonymous, setIsAnonymous] = useState(false);

    const backgroundColor = useThemeColor('background');
    const textColor = useThemeColor('text');
    const primaryColor = useThemeColor('primary');
    const lightTextColor = useThemeColor('lightText');
    const surfaceColor = useThemeColor('surface');
    const borderColor = useThemeColor('border');
    const white = useThemeColor('white');

    const fetchFriends = useCallback(async (pageToLoad: number = 1, append: boolean = false) => {
        if (!user?._id) return;

        if (pageToLoad === 1) {
            setIsLoading(true);
        } else {
            setFriendsLoadingMore(true);
        }

        try {
            const [friendsResponse, incomingResponse, sentResponse] = await Promise.all([
                userAPI.getFriendsList(pageToLoad, 20),
                userAPI.getIncomingFriendRequests(),
                userAPI.getSentFriendRequests()
            ]);

            const newFriends = friendsResponse.data.friends || [];
            setFriends(prev => append ? [...prev, ...newFriends] : newFriends);
            setFriendsPage(pageToLoad);
            setFriendsHasMore(!!friendsResponse.data.hasMore);
            setIncomingRequests(incomingResponse.data || []);
            setSentRequests(sentResponse.data || []);
        } catch (error) {
            console.error('Error fetching friends and requests:', error);
            if (pageToLoad === 1) {
                setFriends([]);
            }
            setIncomingRequests([]);
            setSentRequests([]);
        } finally {
            setIsLoading(false);
            setFriendsLoadingMore(false);
        }
    }, [user?._id]);

    const loadMoreFriends = useCallback(() => {
        if (!friendsLoadingMore && friendsHasMore && !isLoading) {
            fetchFriends(friendsPage + 1, true);
        }
    }, [friendsLoadingMore, friendsHasMore, isLoading, friendsPage, fetchFriends]);

    useEffect(() => {
        if (visible) {
            // Opening the modal intentionally refreshes data and resets its form.
            // eslint-disable-next-line react-hooks/set-state-in-effect
            fetchFriends(1);
            setIsGroupMode(false);
            setSelectedFriends([]);
            setGroupName('');
            setIsTemporary(false);
            setIsAnonymous(false);
            setIncomingRequests([]);
            setSentRequests([]);
        }
    }, [visible, user?._id, fetchFriends]);

    const toggleFriendSelection = (friendId: string) => {
        if (selectedFriends.includes(friendId)) {
            setSelectedFriends(prev => prev.filter(id => id !== friendId));
        } else {
            setSelectedFriends(prev => [...prev, friendId]);
        }
    };

    const handleAcceptRequest = async (senderId: string) => {
        try {
            await userAPI.acceptFriendRequest(user!._id, senderId);
            // Refresh data
            fetchFriends(1);
        } catch (error) {
            console.error('Error accepting friend request:', error);
        }
    };

    const handleIgnoreRequest = async (senderId: string) => {
        try {
            await userAPI.ignoreFriendRequest(user!._id, senderId);
            // Refresh data
            fetchFriends(1);
        } catch (error) {
            console.error('Error ignoring friend request:', error);
        }
    };

    const handleCancelRequest = async (targetUserId: string) => {
        try {
            await userAPI.cancelFriendRequest(user!._id, targetUserId);
            // Refresh data
            fetchFriends(1);
        } catch (error) {
            console.error('Error canceling friend request:', error);
        }
    };

    const sections = [
        {
            title: 'Friends',
            data: friends,
            type: 'friends'
        },
        {
            title: 'Friend Requests',
            data: incomingRequests,
            type: 'incoming'
        },
        {
            title: 'Pending Requests',
            data: sentRequests,
            type: 'sent'
        }
    ];

    const handleCreateGroup = () => {
        if (onCreateGroup && groupName.trim() && selectedFriends.length > 0) {
            onCreateGroup(selectedFriends, groupName.trim(), isTemporary, isAnonymous);
            onClose();
        }
    };

    const renderFriendsFooter = () => {
        if (!friendsHasMore) return null;
        return (
            <View style={styles.loadMoreContainer}>
                {friendsLoadingMore ? (
                    <ActivityIndicator size="small" color={primaryColor} />
                ) : (
                    <TouchableOpacity onPress={loadMoreFriends}>
                        <ThemedText style={{ color: primaryColor, fontWeight: 'bold' }}>
                            Load more friends
                        </ThemedText>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    const renderFriendItem = ({ item, section }: { item: Friend; section: any }) => {
        const avatarSource = item.profilePhoto ? { uri: getImageUrl(item.profilePhoto) } : undefined;
        const isSelected = selectedFriends.includes(item._id);

        const renderActionButtons = () => {
            if (section.type === 'incoming') {
                return (
                    <View style={styles.actionButtons}>
                        <TouchableOpacity
                            style={[styles.actionButton, { backgroundColor: primaryColor }]}
                            onPress={() => handleAcceptRequest(item._id)}
                        >
                            <ThemedText style={{ color: 'white', fontSize: 12 }}>Accept</ThemedText>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.actionButton, { backgroundColor: lightTextColor }]}
                            onPress={() => handleIgnoreRequest(item._id)}
                        >
                            <ThemedText style={{ color: textColor, fontSize: 12 }}>Ignore</ThemedText>
                        </TouchableOpacity>
                    </View>
                );
            } else if (section.type === 'sent') {
                return (
                    <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: '#ff6b6b' }]}
                        onPress={() => handleCancelRequest(item._id)}
                    >
                        <ThemedText style={{ color: 'white', fontSize: 12 }}>Cancel</ThemedText>
                    </TouchableOpacity>
                );
            } else if (isGroupMode) {
                return (
                    <Ionicons
                        name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                        size={24}
                        color={isSelected ? primaryColor : lightTextColor}
                    />
                );
            }
            return null;
        };

        return (
            <TouchableOpacity
                style={[styles.friendRow, { borderBottomColor: borderColor }, isGroupMode && section.type === 'friends' && isSelected && { backgroundColor: surfaceColor }]}
                onPress={() => {
                    if (isGroupMode && section.type === 'friends') {
                        toggleFriendSelection(item._id);
                    } else if (section.type === 'friends') {
                        onSelectFriend(item._id);
                        onClose();
                    }
                }}
                disabled={section.type !== 'friends'}
            >
                <View style={[styles.avatarCircle, { backgroundColor: surfaceColor }]}>
                    {avatarSource ? (
                        <Image source={avatarSource} style={styles.friendAvatar} />
                    ) : (
                        <IconSymbol name="person.fill" size={24} color={lightTextColor} />
                    )}
                </View>
                <View style={styles.friendInfo}>
                    <ThemedText style={[styles.friendName, { color: textColor }]}>
                        {item.username}
                    </ThemedText>
                    {item.age && (
                        <ThemedText style={[styles.friendAge, { color: lightTextColor }]}>
                            {item.age} years old
                        </ThemedText>
                    )}
                </View>
                {renderActionButtons()}
            </TouchableOpacity>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
            <ThemedView style={[styles.container, { backgroundColor }]} safe>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose}>
                        <IconSymbol name="x" size={24} color={textColor} />
                    </TouchableOpacity>
                    <ThemedText style={{ fontSize: typography.sizes.title, fontWeight: 'bold' }}>
                        {isGroupMode ? 'New Group' : 'Select Friend'}
                    </ThemedText>
                    <TouchableOpacity onPress={() => setIsGroupMode(!isGroupMode)}>
                        <ThemedText style={{ color: primaryColor, fontWeight: 'bold' }}>
                            {isGroupMode ? 'Cancel' : 'Group'}
                        </ThemedText>
                    </TouchableOpacity>
                </View>

                {isGroupMode && (
                    <View>
                        <View style={styles.groupInputContainer}>
                            <TextInput
                                style={[styles.groupInput, { color: textColor, borderColor, backgroundColor: surfaceColor }]}
                                placeholder="Group Name"
                                placeholderTextColor={lightTextColor}
                                value={groupName}
                                onChangeText={setGroupName}
                            />
                            <TouchableOpacity
                                style={[styles.createButton, { backgroundColor: primaryColor, opacity: (!groupName.trim() || selectedFriends.length === 0) ? 0.5 : 1 }]}
                                onPress={handleCreateGroup}
                                disabled={!groupName.trim() || selectedFriends.length === 0}
                            >
                                <ThemedText style={{ color: 'white', fontWeight: 'bold' }}>Create</ThemedText>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.optionsContainer}>
                            <View style={styles.optionRow}>
                                <ThemedText>Temporary (24h)</ThemedText>
                                <Switch
                                    value={isTemporary}
                                    onValueChange={setIsTemporary}
                                    trackColor={{ false: '#767577', true: primaryColor }}
                                    thumbColor={white}
                                />
                            </View>
                            <View style={styles.optionRow}>
                                <ThemedText>Anonymous Group</ThemedText>
                                <Switch
                                    value={isAnonymous}
                                    onValueChange={setIsAnonymous}
                                    trackColor={{ false: '#767577', true: primaryColor }}
                                    thumbColor={white}
                                />
                            </View>
                        </View>
                    </View>
                )}

                <View style={styles.content}>
                    {isLoading ? (
                        <ActivityIndicator size="large" color={primaryColor} style={{ marginTop: spacing.xl }} />
                    ) : (
                        <SectionList
                            sections={sections}
                            renderItem={renderFriendItem}
                            renderSectionHeader={({ section: { title } }) => (
                                title ? (
                                    <View style={styles.sectionHeader}>
                                        <ThemedText style={[styles.sectionTitle, { color: textColor }]}>
                                            {title}
                                        </ThemedText>
                                    </View>
                                ) : null
                            )}
                            keyExtractor={item => item._id}
                            contentContainerStyle={styles.listContainer}
                            onEndReached={loadMoreFriends}
                            onEndReachedThreshold={0.2}
                            ListFooterComponent={renderFriendsFooter}
                            ListEmptyComponent={
                                <ThemedText style={[styles.emptyText, { color: lightTextColor }]}>
                                    No friends or requests yet.
                                </ThemedText>
                            }
                        />
                    )}
                </View>
            </ThemedView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    content: {
        flex: 1,
        paddingHorizontal: spacing.md,
    },
    listContainer: {
        paddingVertical: spacing.md,
    },
    friendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
    },
    avatarCircle: {
        width: 50,
        height: 50,
        borderRadius: borderRadius.round,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    friendAvatar: {
        width: '100%',
        height: '100%',
        borderRadius: borderRadius.round,
    },
    friendInfo: {
        flex: 1,
    },
    friendName: {
        fontSize: typography.sizes.title,
        fontWeight: 'bold',
    },
    friendAge: {
        fontSize: typography.sizes.caption,
        marginTop: spacing.xs,
    },
    emptyText: {
        textAlign: 'center',
        marginTop: spacing.xl,
        fontSize: typography.sizes.body1,
    },
    groupInputContainer: {
        padding: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    groupInput: {
        flex: 1,
        height: 40,
        borderWidth: 1,
        borderRadius: borderRadius.md,
        paddingHorizontal: spacing.md,
    },
    createButton: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
    },
    optionsContainer: {
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.sm,
    },
    optionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.xs,
    },
    actionButtons: {
        flexDirection: 'row',
        gap: spacing.xs,
    },
    actionButton: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.sm,
        minWidth: 60,
        alignItems: 'center',
    },
    sectionHeader: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        backgroundColor: '#f5f5f5',
    },
    sectionTitle: {
        fontSize: typography.sizes.body1,
        fontWeight: 'bold',
    },
    loadMoreContainer: {
        paddingVertical: spacing.md,
        alignItems: 'center',
    },
});