// components/chat-settings-modal.tsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Modal, StyleSheet, View, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Switch, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemedView } from './themed-view';
import { ThemedText } from './themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/contexts/AuthContext';
import { spacing, borderRadius, typography } from '@/constants/design-tokens';
import { IconSymbol } from './ui/icon-symbol';
import { chatAPI, userAPI, communityAPI } from '@/utils/api';

interface ChatSettingsModalProps {
    visible: boolean;
    onClose: () => void;
    chat: any;
    onChatUpdate: (updatedChat: any) => void;
    onMessagesUpdate: (messages: any[]) => void;
    onFontSizeChange?: (size: 'small' | 'medium' | 'large') => void;
}

const ChatSettingsModalComponent = ({ visible, onClose, chat, onChatUpdate, onMessagesUpdate, onFontSizeChange }: ChatSettingsModalProps) => {
    const { user } = useAuth();
    const [chatName, setChatName] = useState(chat?.name || '');
    const [isMuted, setIsMuted] = useState(false);
    const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>('medium');
    const [isLoading, setIsLoading] = useState(false);
    const [showAddMembers, setShowAddMembers] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);

    // Load settings when modal opens
    const loadChatSettings = useCallback(async () => {
        if (!user?._id || !chat?._id) return;
        try {
            const settingsKey = `chat_settings_${user._id}_${chat._id}`;
            const settings = await AsyncStorage.getItem(settingsKey);
            if (settings) {
                const parsed = JSON.parse(settings);
                setIsMuted(parsed.isMuted || false);
                setFontSize(parsed.fontSize || 'medium');
            }
        } catch (error) {
            console.error('Failed to load chat settings:', error);
        }
    }, [user?._id, chat?._id]);

    useEffect(() => {
        if (visible && chat?._id && user?._id) {
            loadChatSettings();
        }
    }, [visible, chat?._id, user?._id, loadChatSettings]);

    const saveChatSettings = useCallback(async (newSettings: { isMuted?: boolean; fontSize?: 'small' | 'medium' | 'large' }) => {
        try {
            const settingsKey = `chat_settings_${user?._id}_${chat?._id}`;
            const currentSettings = { isMuted, fontSize };
            const updatedSettings = { ...currentSettings, ...newSettings };
            await AsyncStorage.setItem(settingsKey, JSON.stringify(updatedSettings));
        } catch (error) {
            console.error('Failed to save chat settings:', error);
        }
    }, [user?._id, chat?._id, isMuted, fontSize]);

    // Get theme colors at the top level (hooks must be called at top level)
    const backgroundColor = useThemeColor('background');
    const textColor = useThemeColor('text');
    const primaryColor = useThemeColor('primary');
    const whiteColor = useThemeColor('white');
    const lightTextColor = useThemeColor('lightText');
    const surfaceColor = useThemeColor('surface');
    const borderColor = useThemeColor('border');
    const errorColor = useThemeColor('error');

    // Memoize theme colors object for reference
    const themeColors = useMemo(() => ({
        backgroundColor,
        textColor,
        primaryColor,
        whiteColor,
        lightTextColor,
        surfaceColor,
        borderColor,
        errorColor,
    }), [backgroundColor, textColor, primaryColor, whiteColor, lightTextColor, surfaceColor, borderColor, errorColor]);

    // For backward compatibility
    const white = whiteColor;

    // Memoize derived values
    const computedValues = useMemo(() => ({
        isGroupChat: chat?.isGroupChat,
        isAdmin: chat?.admin === user?._id,
        isMember: chat?.participants?.some((p: any) => p._id === user?._id),
    }), [chat?.isGroupChat, chat?.admin, chat?.participants, user?._id]);

    const { isGroupChat, isAdmin, isMember } = computedValues;

    const handleUpdateChatName = async () => {
        if (!chatName.trim() || !isAdmin) return;

        setIsLoading(true);
        try {
            // TODO: Implement backend route for updating chat name
            Alert.alert('Info', 'Chat name update not yet implemented in backend');
            // const response = await chatAPI.updateChat(chat._id, { name: chatName });
            // onChatUpdate(response.data);
        } catch (error) {
            Alert.alert('Error', 'Failed to update chat name');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSearchUsers = async (query: string) => {
        if (!query.trim()) {
            setSearchResults([]);
            return;
        }
        try {
            const response = await userAPI.searchUsers(query);
            // Filter out current participants
            const filtered = response.data.filter((u: any) =>
                !chat?.participants?.some((p: any) => p._id === u._id)
            );
            setSearchResults(filtered.slice(0, 5)); // Limit to 5 results
        } catch (error) {
            console.error('Search failed:', error);
        }
    };

    const handleInviteMember = async (userId: string, username: string) => {
        if (!isAdmin) return;

        setIsLoading(true);
        try {
            const response = await chatAPI.addMember(chat._id, userId);
            onChatUpdate(response.data);
            setSearchQuery(''); // Clear search
            setSearchResults([]); // Clear results
            setShowAddMembers(false); // Hide add members section
            Alert.alert('Success', `Invitation sent to ${username}`);
        } catch (error: any) {
            console.error('Invite member error:', error);
            Alert.alert('Error', error.response?.data?.msg || 'Failed to send invitation');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancelInvitation = async (userId: string, username: string) => {
        if (!isAdmin) return;

        Alert.alert(
            'Cancel Invitation',
            `Are you sure you want to cancel the invitation for ${username}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        setIsLoading(true);
                        try {
                            const response = await chatAPI.cancelPendingInvitation(chat._id, userId);
                            onChatUpdate(response.data);
                            Alert.alert('Success', `Invitation cancelled for ${username}`);
                        } catch (error: any) {
                            console.error('Cancel invitation error:', error);
                            Alert.alert('Error', error.response?.data?.msg || 'Failed to cancel invitation');
                        } finally {
                            setIsLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const handleRemoveMember = async (userId: string, username: string) => {
        if (!isAdmin) return;

        Alert.alert(
            'Remove Member',
            `Are you sure you want to remove ${username} from this chat?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        setIsLoading(true);
                        try {
                            const response = await chatAPI.removeMember(chat._id, userId);
                            onChatUpdate(response.data);
                            Alert.alert('Success', `${username} has been removed from the chat`);
                        } catch (error: any) {
                            console.error('Remove member error:', error);
                            Alert.alert('Error', error.response?.data?.msg || 'Failed to remove member');
                        } finally {
                            setIsLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const handleLeaveChat = () => {
        const isCommunityChat = chat?.relatedCommunity;
        const leaveMessage = isCommunityChat
            ? 'Are you sure you want to leave this community? You will no longer have access to the community chat.'
            : 'Are you sure you want to leave this group chat?';

        Alert.alert(
            'Leave Chat',
            leaveMessage,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Leave',
                    style: 'destructive',
                    onPress: async () => {
                        setIsLoading(true);
                        try {
                            if (isCommunityChat) {
                                // Leave community (which also removes from chat)
                                await communityAPI.leave(chat.relatedCommunity);
                            } else {
                                // Leave group chat
                                await chatAPI.leave(chat._id);
                            }
                            Alert.alert('Success', 'You have left the chat successfully');
                            onClose(); // Close the modal
                            // The parent component should handle updating the chat list
                        } catch (error: any) {
                            console.error('Leave chat error:', error);
                            Alert.alert('Error', error.response?.data?.msg || 'Failed to leave chat');
                        } finally {
                            setIsLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const handleClearChat = () => {
        Alert.alert(
            'Clear Chat History',
            'Are you sure you want to clear your chat history? Messages will be hidden from your view but remain visible to other participants.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear',
                    style: 'destructive',
                    onPress: async () => {
                        // Clear messages from local state
                        onChatUpdate({ ...chat, messages: [] });
                        // TODO: Optionally save "cleared_at" timestamp to user preferences
                        // so old messages don't reappear on refresh
                        Alert.alert('Success', 'Chat history cleared');
                        onMessagesUpdate([]);
                        onClose();
                    }
                }
            ]
        );
    };

    const handleDeleteChat = () => {
        if (!isAdmin) return;

        Alert.alert(
            'Delete Chat',
            'Are you sure you want to delete this chat? This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        // TODO: Implement delete chat functionality
                        Alert.alert('Info', 'Delete chat functionality not yet implemented');
                    }
                }
            ]
        );
    };

    const handleToggleMute = async () => {
        const newMutedState = !isMuted;
        setIsMuted(newMutedState);
        await saveChatSettings({ isMuted: newMutedState });
        Alert.alert('Success', `Notifications ${newMutedState ? 'muted' : 'unmuted'} for this chat`);
    };

    const handleFontSizeChange = async (size: 'small' | 'medium' | 'large') => {
        setFontSize(size);
        await saveChatSettings({ fontSize: size });
        onFontSizeChange?.(size);
    };

    return (
        <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
            <ThemedView style={[styles.container, { backgroundColor }]} safe>
                <View style={[styles.header, { borderBottomColor: borderColor }]}>
                    <TouchableOpacity onPress={onClose}>
                        <IconSymbol name="x" size={24} color={textColor} />
                    </TouchableOpacity>
                    <ThemedText style={{ fontSize: typography.sizes.title, fontFamily: typography.families.bold }}>
                        Chat Settings
                    </ThemedText>
                    <View style={{ width: 24 }} />
                </View>

                <ScrollView style={styles.content}>
                    {/* Chat Info */}
                    <View style={styles.section}>
                        <ThemedText type="title" style={styles.sectionTitle}>Chat Info</ThemedText>

                        {/* Group Profile Photo - Only for group chats */}
                        {isGroupChat && chat?.groupPhoto && (
                            <View style={styles.groupPhotoContainer}>
                                <ThemedText style={styles.label}>Group Photo</ThemedText>
                                <View style={styles.groupPhotoRow}>
                                    <Image 
                                        source={{ uri: chat?.groupPhoto }} 
                                        style={styles.groupPhoto}
                                    />
                                </View>
                            </View>
                        )}

                        {isGroupChat && isAdmin && (
                            <View style={styles.inputContainer}>
                                <ThemedText style={styles.label}>Chat Name</ThemedText>
                                <View style={styles.inputRow}>
                                    <TextInput
                                        style={[styles.input, { backgroundColor: surfaceColor, borderColor, color: textColor }]}
                                        value={chatName}
                                        onChangeText={setChatName}
                                        placeholder="Chat name"
                                        placeholderTextColor={lightTextColor}
                                    />
                                    <TouchableOpacity
                                        style={[styles.saveButton, { backgroundColor: primaryColor }]}
                                        onPress={handleUpdateChatName}
                                        disabled={isLoading}
                                    >
                                        {isLoading ? (
                                            <ActivityIndicator size="small" color={white} />
                                        ) : (
                                            <IconSymbol name="checkmark" size={16} color={white} />
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        <View style={styles.infoRow}>
                            <ThemedText style={{ color: lightTextColor }}>Type:</ThemedText>
                            <ThemedText>{isGroupChat ? 'Group Chat' : 'Direct Message'}</ThemedText>
                        </View>

                        <View style={styles.infoRow}>
                            <ThemedText style={{ color: lightTextColor }}>Members:</ThemedText>
                            <ThemedText>{chat?.participants?.length || 0}</ThemedText>
                        </View>
                    </View>

                    {/* Members Management */}
                    {isGroupChat && (
                        <View style={styles.section}>
                            <ThemedText type="title" style={styles.sectionTitle}>Members</ThemedText>

                            {chat?.participants?.map((participant: any) => (
                                <View key={participant._id} style={[styles.memberRow, { borderBottomColor: borderColor }]}>
                                    <View style={[styles.memberAvatar, { backgroundColor: surfaceColor }]}>
                                        {participant.profilePhoto ? (
                                            <Image source={{ uri: participant.profilePhoto }} style={styles.avatar} />
                                        ) : (
                                            <IconSymbol name="person.fill" size={20} color={lightTextColor} />
                                        )}
                                    </View>
                                    <View style={styles.memberInfo}>
                                        <ThemedText type="body1" style={{ fontFamily: typography.families.bold }}>
                                            {participant.username}
                                        </ThemedText>
                                        {participant._id === chat.admin && (
                                            <ThemedText style={{ color: primaryColor, fontSize: typography.sizes.caption }}>
                                                Admin
                                            </ThemedText>
                                        )}
                                    </View>
                                    {isAdmin && participant._id !== user?._id && (
                                        <TouchableOpacity
                                            style={[styles.removeButton, { borderColor: errorColor }]}
                                            onPress={() => handleRemoveMember(participant._id, participant.username)}
                                        >
                                            <IconSymbol name="x" size={16} color={errorColor} />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            ))}

                            {isAdmin && (
                                <TouchableOpacity
                                    style={[styles.addButton, { backgroundColor: primaryColor }]}
                                    onPress={() => setShowAddMembers(!showAddMembers)}
                                >
                                    <IconSymbol name="plus" size={20} color={white} />
                                    <ThemedText style={{ color: white, marginLeft: spacing.sm }}>
                                        Add Members
                                    </ThemedText>
                                </TouchableOpacity>
                            )}

                            {showAddMembers && (
                                <View style={styles.addMembersContainer}>
                                    <TextInput
                                        style={[styles.searchInput, { backgroundColor: surfaceColor, borderColor, color: textColor }]}
                                        value={searchQuery}
                                        onChangeText={(text) => {
                                            setSearchQuery(text);
                                            handleSearchUsers(text);
                                        }}
                                        placeholder="Search users..."
                                        placeholderTextColor={lightTextColor}
                                    />
                                    {searchResults.map((user) => (
                                        <TouchableOpacity
                                            key={user._id}
                                            style={[styles.searchResult, { borderBottomColor: borderColor }]}
                                            onPress={() => handleInviteMember(user._id, user.username)}
                                        >
                                            <View style={[styles.memberAvatar, { backgroundColor: surfaceColor }]}>
                                                {user.profilePhoto ? (
                                                    <Image source={{ uri: user.profilePhoto }} style={styles.avatar} />
                                                ) : (
                                                    <IconSymbol name="person.fill" size={20} color={lightTextColor} />
                                                )}
                                            </View>
                                            <ThemedText>{user.username}</ThemedText>
                                            <IconSymbol name="plus" size={20} color={primaryColor} />
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}

                            {/* Pending Members Section */}
                            {isAdmin && chat?.pendingMembers && chat.pendingMembers.length > 0 && (
                                <View style={styles.pendingSection}>
                                    <ThemedText type="title" style={styles.sectionTitle}>Pending Invitations</ThemedText>
                                    {chat.pendingMembers.map((pendingUser: any) => (
                                        <View key={pendingUser._id} style={[styles.pendingRow, { borderBottomColor: borderColor }]}>
                                            <View style={[styles.memberAvatar, { backgroundColor: surfaceColor }]}>
                                                {pendingUser.profilePhoto ? (
                                                    <Image source={{ uri: pendingUser.profilePhoto }} style={styles.avatar} />
                                                ) : (
                                                    <IconSymbol name="person.fill" size={20} color={lightTextColor} />
                                                )}
                                            </View>
                                            <View style={styles.memberInfo}>
                                                <ThemedText type="body1" style={{ fontFamily: typography.families.bold }}>
                                                    {pendingUser.username}
                                                </ThemedText>
                                                <ThemedText style={{ color: lightTextColor, fontSize: typography.sizes.caption }}>
                                                    Invitation sent
                                                </ThemedText>
                                            </View>
                                            <TouchableOpacity
                                                style={[styles.cancelInviteBtn, { borderColor: errorColor }]}
                                                onPress={() => handleCancelInvitation(pendingUser._id, pendingUser.username)}
                                            >
                                                <IconSymbol name="x" size={16} color={errorColor} />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
                    )}

                    {/* Notifications */}
                    <View style={styles.section}>
                        <ThemedText type="title" style={styles.sectionTitle}>Notifications</ThemedText>

                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <IconSymbol name="bell" size={20} color={textColor} />
                                <ThemedText style={{ marginLeft: spacing.sm }}>Mute Notifications</ThemedText>
                            </View>
                            <Switch
                                value={isMuted}
                                onValueChange={handleToggleMute}
                                trackColor={{ false: surfaceColor, true: primaryColor }}
                                thumbColor={isMuted ? white : surfaceColor}
                            />
                        </View>
                    </View>

                    {/* Customization */}
                    <View style={styles.section}>
                        <ThemedText type="title" style={styles.sectionTitle}>Customization</ThemedText>

                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <IconSymbol name="textformat.size" size={20} color={textColor} />
                                <ThemedText style={{ marginLeft: spacing.sm }}>Font Size</ThemedText>
                            </View>
                            <View style={styles.fontSizeOptions}>
                                {(['small', 'medium', 'large'] as const).map((size) => (
                                    <TouchableOpacity
                                        key={size}
                                        style={[
                                            styles.fontSizeButton,
                                            {
                                                backgroundColor: fontSize === size ? primaryColor : surfaceColor,
                                                borderColor: fontSize === size ? primaryColor : borderColor
                                            }
                                        ]}
                                        onPress={() => handleFontSizeChange(size)}
                                    >
                                        <ThemedText
                                            style={{
                                                color: fontSize === size ? white : textColor,
                                                fontSize: typography.sizes.caption,
                                                textTransform: 'capitalize'
                                            }}
                                        >
                                            {size}
                                        </ThemedText>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </View>


                </ScrollView>
            </ThemedView>
        </Modal>
    );
}

export const ChatSettingsModal = React.memo(ChatSettingsModalComponent);

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.md,
        borderBottomWidth: 1,
    },
    content: { flex: 1, padding: spacing.md },
    section: { marginBottom: spacing.xl },
    sectionTitle: {
        fontSize: typography.sizes.title,
        fontFamily: typography.families.bold,
        marginBottom: spacing.md
    },
    inputContainer: { marginBottom: spacing.lg },
    label: {
        fontSize: typography.sizes.body1,
        fontFamily: typography.families.medium,
        marginBottom: spacing.sm,
    },
    groupPhotoContainer: {
        marginBottom: spacing.lg,
    },
    groupPhotoRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    groupPhotoButton: {
        position: 'relative',
    },
    groupPhoto: {
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 3,
        borderColor: '#4A90E2',
    },
    groupPhotoPlaceholder: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#CCCCCC',
        borderStyle: 'dashed',
        backgroundColor: '#F5F5F5',
    },
    editBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    helperText: {
        fontSize: typography.sizes.caption,
        marginTop: spacing.sm,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    input: {
        flex: 1,
        borderWidth: 1,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        fontSize: typography.sizes.body1,
    },
    saveButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: spacing.sm,
    },
    memberRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
    },
    memberAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    memberInfo: { flex: 1 },
    removeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.md,
        borderRadius: borderRadius.md,
        marginTop: spacing.md,
    },
    addMembersContainer: { marginTop: spacing.md },
    searchInput: {
        borderWidth: 1,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        fontSize: typography.sizes.body1,
        marginBottom: spacing.md,
    },
    searchResult: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.md,
    },
    settingInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dangerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        borderWidth: 1,
        borderRadius: borderRadius.md,
        marginBottom: spacing.sm,
    },
    pendingSection: { marginBottom: spacing.xl },
    pendingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
    },
    cancelInviteBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    fontSizeOptions: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    fontSizeButton: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        minWidth: 60,
        alignItems: 'center',
    },
});
