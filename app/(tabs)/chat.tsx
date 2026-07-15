// app/(tabs)/chat.tsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, View, FlatList, TouchableOpacity, ActivityIndicator, Alert, Image, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/contexts/AuthContext';
import { chatAPI, getImageUrl } from '@/utils/api';
import { useThemeColor } from '@/hooks/use-theme-color';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { spacing, borderRadius, typography } from '@/constants/design-tokens';
import { onNewNotification, offNewNotification, getSocket } from '@/utils/socket';
import { SelectFriendModal } from '@/components/select-friend-modal';
import * as Haptics from 'expo-haptics';
import { showErrorAlert } from '@/utils/error-handler';

interface User {
    _id: string;
    username: string;
    profilePhoto?: string;
    isOnline?: boolean;
    lastSeen?: string;
}

interface ChatMessage {
    _id: string;
    sender: string;
    content: string;
    timestamp: string;
    createdAt?: string;
}

interface Chat {
    _id: string;
    participants: User[];
    name?: string;
    messages?: ChatMessage[];
    lastMessage?: string;
    updatedAt?: string;
    isGroupChat?: boolean;
    groupPhoto?: string;
    unreadCount?: number;
}

export default function ChatScreen() {
    const { user } = useAuth();
    const router = useRouter();
    const [chats, setChats] = useState<Chat[]>([]);
    const chatsRef = useRef<Chat[]>([]);
    useEffect(() => { chatsRef.current = chats; }, [chats]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFriendModalVisible, setIsFriendModalVisible] = useState(false);
    const [activeTab, setActiveTab] = useState<'direct' | 'groups'>('direct');
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

    const EmptyComponent = () => (
        <View style={{ padding: spacing.lg }}>
            <ThemedText style={{ textAlign: 'center', marginTop: spacing.xl, color: lightTextColor }}>
                No {activeTab === 'direct' ? 'messages' : 'groups'} yet.
            </ThemedText>
        </View>
    );

    const backgroundColor = useThemeColor('background');
    const primaryColor = useThemeColor('primary');
    const textColor = useThemeColor('text');
    const lightTextColor = useThemeColor('lightText');
    const surfaceColor = useThemeColor('surface');
    const borderColor = useThemeColor('border');
    const white = useThemeColor('white');
    const errorColor = useThemeColor('error');

    const fetchChats = useCallback(async (isRefresh = false) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
            } else {
                setIsLoading(true);
            }
            if (user?._id) {
                const response = await chatAPI.getUserChats(user._id, 1, 20);
                setChats(response.data.data || []);
                setHasMore(response.data.pagination?.hasNextPage || false);
                setPage(1);
            } else {
                setChats([]);
            }
        } catch (error: any) {
            if (!isRefresh) {
                showErrorAlert(error, () => fetchChats());
            }
            setChats([]);
        } finally {
            if (isRefresh) {
                setRefreshing(false);
            } else {
                setIsLoading(false);
            }
        }
    }, [user?._id]);

    const loadMoreChats = useCallback(async () => {
        if (loadingMore || !hasMore || !user?._id) return;
        setLoadingMore(true);
        try {
            const nextPage = page + 1;
            const response = await chatAPI.getUserChats(user._id, nextPage, 20);
            setChats(prev => [...prev, ...(response.data.data || [])]);
            setHasMore(response.data.pagination?.hasNextPage || false);
            setPage(nextPage);
        } catch (error: any) {
        } finally {
            setLoadingMore(false);
        }
    }, [user?._id, page, hasMore, loadingMore]);

    useFocusEffect(
        useCallback(() => {
            fetchChats();
        }, [fetchChats])
    );

    const onRefresh = useCallback(() => {
        fetchChats(true);
    }, [fetchChats]);
    
    const handleNewChat = () => {
        setIsFriendModalVisible(true);
    };

    const handleSelectFriend = async (friendId: string) => {
        if (user?._id) {
            try {
                const response = await chatAPI.createChat({
                    participants: [user._id, friendId],
                    isGroupChat: false,
                });
                router.push({
                    pathname: '/chat/[id]',
                    params: { id: response.data._id }
                });
            } catch (error: any) {
                if (error.response?.data?.msg === 'Chat already exists') {
                      Alert.alert('Chat Exists', 'A chat with this user already exists.');
                } else {
                    Alert.alert('Error', 'Failed to create chat.');
                }
            }
        }
    };

    const handleCreateGroup = async (friendIds: string[], groupName: string, isTemporary: boolean, isAnonymous: boolean) => {
        if (user?._id) {
            try {
                const response = await chatAPI.createChat({
                    participants: [user._id, ...friendIds],
                    isGroupChat: true,
                    name: groupName,
                    isTemporary,
                    isAnonymous,
                });
                router.push({
                    pathname: '/chat/[id]',
                    params: { id: response.data._id }
                });
            } catch (error: any) {
                Alert.alert('Error', 'Failed to create group chat.');
            }
        }
    };

    useEffect(() => {
        const socket = getSocket();

        const handleChatUpdated = (newMessage: any) => {
            // If the chat isn't in the list (e.g. it was deleted and is now
            // revived by this incoming message), refresh so it reappears.
            if (!chatsRef.current.some(chat => chat._id === newMessage.chat)) {
                fetchChats();
                return;
            }

            setChats(prev => prev.map(chat => {
                if (chat._id === newMessage.chat) {
                    const isMyMessage = newMessage.sender._id === user?._id;
                    return {
                        ...chat,
                        lastMessage: newMessage.content,
                        updatedAt: newMessage.createdAt,
                        unreadCount: isMyMessage ? (chat.unreadCount || 0) : (chat.unreadCount || 0) + 1
                    };
                }
                return chat;
            }).sort((a, b) => {
                const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
                const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
                return bTime - aTime;
            }));
        };

        const handleNewChat = (newChat: Chat) => {
            setChats(prev => {
                if (prev.find(c => c._id === newChat._id)) return prev;
                return [newChat, ...prev];
            });
        };

        const handleChatDeleted = (data: { chatId: string }) => {
            setChats(prev => prev.filter(c => c._id !== data.chatId));
        };

        const handleNotification = (data: any) => {
            if (data.type === 'message') {
                fetchChats();
            }
        };

        const handleMessagesRead = (data: { userId: string; chatId: string }) => {
            if (data.userId === user?._id) {
                setChats(prev => prev.map(chat =>
                    chat._id === data.chatId ? { ...chat, unreadCount: 0 } : chat
                ));
            }
        };

        const handleStatusChange = (data: { userId: string; isOnline: boolean }) => {
            setChats(prev => prev.map(chat => {
                const updatedParticipants = chat.participants.map(p => 
                    p._id === data.userId ? { ...p, isOnline: data.isOnline } : p
                );
                return { ...chat, participants: updatedParticipants };
            }));
        };

        if (socket) {
            socket.on('chatUpdated', handleChatUpdated);
            socket.on('newChat', handleNewChat);
            socket.on('messages-read', handleMessagesRead);
            socket.on('user_status_change', handleStatusChange);
            socket.on('chatDeleted', handleChatDeleted);
        }
        onNewNotification(handleNotification);

        return () => {
            if (socket) {
                socket.off('chatUpdated', handleChatUpdated);
                socket.off('newChat', handleNewChat);
                socket.off('messages-read', handleMessagesRead);
                socket.off('user_status_change', handleStatusChange);
                socket.off('chatDeleted', handleChatDeleted);
            }
            offNewNotification();
        };
    }, [user, fetchChats]);

    const filteredChats = chats.filter(chat => {
        if (activeTab === 'direct') return !chat.isGroupChat;
        return chat.isGroupChat;
    });

    const renderChatItem = ({ item }: { item: Chat }) => {
        const participant = item.participants.find(p => p._id !== user?._id);
        
        let chatName = '';
        let avatarSource = undefined;
        const isGroup = item.isGroupChat;

        if (isGroup) {
            chatName = item.name || 'Group Chat';
            avatarSource = item.groupPhoto ? { uri: getImageUrl(item.groupPhoto) } : undefined;
        } else {
            chatName = participant?.username || 'Unknown User';
            avatarSource = participant?.profilePhoto ? { uri: getImageUrl(participant.profilePhoto) } : undefined;
        }

        return (
            <TouchableOpacity 
                style={[styles.chatRow, { borderBottomColor: borderColor }]} 
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push({
                        pathname: '/chat/[id]',
                        params: { id: item._id }
                    });
                }}
            >
                <View style={[styles.avatarCircle, { backgroundColor: surfaceColor }]}>
                    {avatarSource ? (
                        <Image source={avatarSource} style={styles.chatAvatar} />
                    ) : (
                        <IconSymbol name={isGroup ? "person.2.fill" : "person.fill"} size={24} color={lightTextColor} />
                    )}
                    {!isGroup && participant?.isOnline && <View style={[styles.onlineIndicator, { borderColor: surfaceColor }]} />}
                </View>
                <View style={styles.chatInfo}>
                    <View style={styles.chatHeader}>
                        <ThemedText style={[styles.chatName, { color: textColor }]}>
                            {chatName}
                        </ThemedText>
                        <View style={styles.timeAndBadgeContainer}>
                            <ThemedText style={[styles.chatDate, { color: lightTextColor }]}>
                                {item.updatedAt ? new Date(item.updatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''}
                            </ThemedText>
                            {!!item.unreadCount && item.unreadCount > 0 && (
                                <View style={[styles.unreadBadge, { backgroundColor: primaryColor }]}>
                                    <ThemedText style={styles.unreadText}>
                                        {item.unreadCount > 99 ? '99' : item.unreadCount.toString()}
                                    </ThemedText>
                                </View>
                            )}
                        </View>
                    </View>
                    <ThemedText style={[styles.chatPreview, { color: lightTextColor }]} numberOfLines={1}>
                        {String(item.messages?.[item.messages.length - 1]?.content || item.lastMessage || 'No messages')}
                    </ThemedText>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor }}>
            <ThemedView style={styles.container}>
                <ThemedView style={[styles.listHeader, { borderBottomColor: borderColor }]}>
                    <ThemedText type="heading1" style={{ fontFamily: typography.families.bold, color: primaryColor }}>Messages</ThemedText>
                    <TouchableOpacity style={[styles.editBtn, { backgroundColor: primaryColor }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); handleNewChat(); }}>
                        <IconSymbol name="plus" size={24} color={white} />
                    </TouchableOpacity>
                </ThemedView>

                <View style={[styles.tabsContainer, { borderBottomColor: borderColor }]}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'direct' && { borderBottomColor: primaryColor }]}
                        onPress={() => { Haptics.selectionAsync(); setActiveTab('direct'); }}
                    >
                        <ThemedText style={[styles.tabText, { color: activeTab === 'direct' ? primaryColor : lightTextColor }]}>Direct</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'groups' && { borderBottomColor: primaryColor }]}
                        onPress={() => { Haptics.selectionAsync(); setActiveTab('groups'); }}
                    >
                        <ThemedText style={[styles.tabText, { color: activeTab === 'groups' ? primaryColor : lightTextColor }]}>Groups</ThemedText>
                    </TouchableOpacity>
                </View>

                {isLoading ? (
                    <ActivityIndicator size="large" color={primaryColor} style={{ marginTop: spacing.xl }} />
                ) : (
                    <FlatList
                        data={filteredChats}
                        renderItem={renderChatItem}
                        keyExtractor={item => item._id}
                        contentContainerStyle={styles.listContainer}
                        ListEmptyComponent={EmptyComponent}
                        onEndReached={loadMoreChats}
                        onEndReachedThreshold={0.3}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={onRefresh}
                                colors={[primaryColor]}
                                tintColor={primaryColor}
                            />
                        }
                    />
                )}
            </ThemedView>

            <SelectFriendModal
                visible={isFriendModalVisible}
                onClose={() => setIsFriendModalVisible(false)}
                onSelectFriend={handleSelectFriend}
                onCreateGroup={handleCreateGroup}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    listHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: spacing.lg, alignItems: 'center', borderBottomWidth: 1 },
    editBtn: { padding: spacing.sm, borderRadius: borderRadius.md },
    listContainer: { paddingHorizontal: spacing.md },
    chatRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1 },
    avatarCircle: { width: 55, height: 55, borderRadius: borderRadius.round, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
    chatAvatar: { width: '100%', height: '100%', borderRadius: borderRadius.round },
    chatInfo: { flex: 1 },
    chatHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
    timeAndBadgeContainer: { flexDirection: 'row', alignItems: 'center' },
    chatName: { fontSize: typography.sizes.title, fontFamily: typography.families.bold },
    chatDate: { fontSize: typography.sizes.caption },
    chatPreview: { fontSize: typography.sizes.body2 },
    tabsContainer: { flexDirection: 'row', borderBottomWidth: 1 },
    tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
    tabText: { fontSize: typography.sizes.body1, fontFamily: typography.families.medium },
    unreadBadge: { minWidth: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5, marginLeft: spacing.sm },
    unreadText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
    onlineIndicator: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#4CAF50',
        borderWidth: 2,
    },
});