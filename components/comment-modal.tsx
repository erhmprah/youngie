// components/comment-modal.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { Modal, StyleSheet, View, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Alert, Image, TouchableWithoutFeedback } from 'react-native';
import { ThemedView } from './themed-view';
import { ThemedText } from './themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { spacing, borderRadius, typography } from '@/constants/design-tokens';
import { Ionicons } from '@expo/vector-icons';
import { postAPI, userAPI, getImageUrl } from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';
import { getRelativeTime } from '@/utils/helpers';
import { useDebounce } from '@/hooks/use-debounce';
import * as Haptics from 'expo-haptics';
import { ReactionPicker, ReactionType } from './reaction-picker';
import { getSocket } from '@/utils/socket';
import { useRouter } from 'expo-router';

interface Comment {
    _id: string;
    author: {
        _id: string;
        username: string;
        profilePhoto?: string;
    };
    content: string;
    createdAt: string;
    reactions?: { user: { _id: string; username: string }; type: string; sticker?: string }[];
    tags?: { _id: string; username: string }[];
    parent?: string;
}

interface CommentModalProps {
    visible: boolean;
    onClose: () => void;
    post: {
        _id: string;
        comments: Comment[];
        isAnonymous?: boolean;
        commentsDisabled?: boolean;
        author?: {
            _id: string;
            username: string;
        };
    } | null;
    initialAnonymous?: boolean;
}

export function CommentModal({ visible, onClose, post, initialAnonymous = false }: CommentModalProps) {
    const { user } = useAuth();
    const [comment, setComment] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [comments, setComments] = useState<Comment[]>([]);
    const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
    const [isAnonymous, setIsAnonymous] = useState(initialAnonymous);
    const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
    const [taggedUsers, setTaggedUsers] = useState<string[]>([]);
    const [showTagModal, setShowTagModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [friends, setFriends] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isLoadingFriends, setIsLoadingFriends] = useState(false);
    const [showReactionPicker, setShowReactionPicker] = useState(false);
    const [selectedCommentForReaction, setSelectedCommentForReaction] = useState<string | null>(null);
    const router = useRouter();

    const debouncedSearchQuery = useDebounce(searchQuery, 500);

    // Update comments when post changes
    useEffect(() => {
        if (post?.comments) {
            setComments(post.comments);
        } else {
            setComments([]);
        }
    }, [post]);

    // Listen for real-time updates
    useEffect(() => {
        const socket = getSocket();
        if (!socket || !post?._id) return;

        const handlePostUpdate = (updatedPost: any) => {
            if (updatedPost._id === post._id) {
                setComments(updatedPost.comments);
            }
        };

        socket.on('post:updated', handlePostUpdate);

        return () => {
            socket.off('post:updated', handlePostUpdate);
        };
    }, [post?._id]);

    const fetchFriends = async () => {
        if (!user?._id) return;

        setIsLoadingFriends(true);
        try {
            const response = await userAPI.getProfile(user._id);
            setFriends(response.data.friends || []);
        } catch (error) {
            console.error('Error fetching friends:', error);
            setFriends([]);
        } finally {
            setIsLoadingFriends(false);
        }
    };

    const performSearch = async (query: string) => {
        if (!query.trim()) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            const response = await userAPI.searchUsers(query);
            setSearchResults(response.data);
        } catch (error) {
            console.error('Search failed:', error);
        } finally {
            setIsSearching(false);
        }
    };

    useEffect(() => {
        if (visible) {
            if (post?.isAnonymous) {
                setIsAnonymous(true);
            } else {
                setIsAnonymous(initialAnonymous);
            }
        }
    }, [visible, initialAnonymous, post]);

    useEffect(() => {
        if (showTagModal) {
            setTaggedUsers([]);
            setSearchQuery('');
            setSearchResults([]);
            fetchFriends();
        }
    }, [showTagModal, user?._id]);

    useEffect(() => {
        performSearch(debouncedSearchQuery);
    }, [debouncedSearchQuery]);

    const { rootComments, repliesByParent } = useMemo(() => {
        const roots: Comment[] = [];
        const replies: Record<string, Comment[]> = {};
        comments.forEach(c => {
            if (c.parent) {
                if (!replies[c.parent]) replies[c.parent] = [];
                replies[c.parent].push(c);
            } else {
                roots.push(c);
            }
        });
        return { rootComments: roots, repliesByParent: replies };
    }, [comments]);

    const toggleReplies = (commentId: string) => {
        setExpandedComments(prev => {
            const next = new Set(prev);
            if (next.has(commentId)) next.delete(commentId);
            else next.add(commentId);
            return next;
        });
    };

    const backgroundColor = useThemeColor('background');
    const textColor = useThemeColor('text');
    const primaryColor = useThemeColor('primary');
    const lightTextColor = useThemeColor('lightText');
    const surfaceColor = useThemeColor('surface');
    const white = useThemeColor('white');

    const getReactionIcon = (type: string) => {
        switch (type) {
            case 'heart': return 'heart';
            case 'laugh': return 'happy-outline';
            case 'sticker': return 'image-outline';
            default: return 'thumbs-up-outline';
        }
    };

    const handleAddComment = async () => {
        if (!comment.trim()) return;

        setIsLoading(true);
        try {
            if (post) {
                const response = await postAPI.addComment(post._id, {
                    content: comment,
                    parent: replyingTo?._id,
                    isAnonymous,
                    tags: taggedUsers.length > 0 ? taggedUsers : undefined
                });
                // The API returns the updated post, so get comments from it
                setComments(response.data.comments);
                setComment('');
                setReplyingTo(null);
                setTaggedUsers([]);
            }
        } catch (error) {
            console.error('Error adding comment:', error);
            Alert.alert('Error', 'Failed to add comment.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleReactComment = async (commentId: string, reactionType: ReactionType | 'sticker' | 'remove' = 'like', sticker?: string) => {
        if (!post) return;
        try {
            const response = await postAPI.reactComment(post._id, commentId, { reactionType, sticker });
            setComments(response.data.comments);
            setShowReactionPicker(false);
            setSelectedCommentForReaction(null);
        } catch (error) {
            console.error('Error reacting to comment:', error);
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        if (!post) return;
        Alert.alert(
            'Delete Comment',
            'Are you sure you want to delete this comment?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const response = await postAPI.deleteComment(post._id, commentId);
                            setComments(response.data.comments);
                        } catch (error) {
                            console.error('Error deleting comment:', error);
                            Alert.alert('Error', 'Failed to delete comment.');
                        }
                    }
                }
            ]
        );
    };

    const openReactionPicker = (commentId: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelectedCommentForReaction(commentId);
        setShowReactionPicker(true);
    };

    const renderCommentContent = (item: Comment) => {
        const userReaction = item.reactions?.find(r => r.user._id === user?._id);
        const reactionCounts = item.reactions?.reduce((acc, r) => {
            acc[r.type] = (acc[r.type] || 0) + 1;
            return acc;
        }, {} as Record<string, number>) || {};
        const totalReactions = item.reactions?.length || 0;
        const isReply = !!item.parent;
        const canDelete = user?._id === item.author._id || user?._id === post?.author?._id;

        const getReactionColor = (type: string) => {
            return userReaction?.type === type ? primaryColor : lightTextColor;
        };

        return (
            <View style={[styles.commentContainer, isReply && styles.replyContainer]}>
                <TouchableOpacity onPress={() => {
                    onClose();
                    router.push(`/user/${item.author._id}`);
                }}>
                    {item.author.profilePhoto ? (
                        <Image source={{ uri: getImageUrl(item.author.profilePhoto) }} style={styles.avatar} />
                    ) : (
                        <View style={[styles.avatar, { backgroundColor: surfaceColor, justifyContent: 'center', alignItems: 'center' }]}>
                            <Ionicons name="person" size={20} color={lightTextColor} />
                        </View>
                    )}
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <ThemedText>
                        <ThemedText 
                            style={{ fontFamily: typography.families.bold }}
                            onPress={() => {
                                onClose();
                                router.push(`/user/${item.author._id}`);
                            }}
                        >
                            {item.author.username}{' '}
                        </ThemedText>
                        {item.content}
                    </ThemedText>
                    {item.tags && item.tags.length > 0 && (
                        <View style={styles.commentTags}>
                            <ThemedText style={{ color: lightTextColor, fontSize: typography.sizes.caption }}>
                                Tagged: {item.tags.map(tag => tag.username).join(', ')}
                            </ThemedText>
                        </View>
                    )}

                    <View style={styles.commentActions}>
                        <ThemedText style={{ color: lightTextColor, fontSize: typography.sizes.caption }}>
                            {getRelativeTime(item.createdAt)}
                        </ThemedText>

                        <TouchableOpacity onLongPress={() => openReactionPicker(item._id)} style={styles.actionButton}>
                            <ThemedText style={{ color: lightTextColor, fontSize: typography.sizes.caption, fontFamily: typography.families.medium }}>
                                {totalReactions} Reactions
                            </ThemedText>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => setReplyingTo(item)} style={styles.actionButton}>
                            <ThemedText style={{ color: lightTextColor, fontSize: typography.sizes.caption, fontFamily: typography.families.medium }}>
                                Reply
                            </ThemedText>
                        </TouchableOpacity>
                        {canDelete && (
                            <TouchableOpacity onPress={() => handleDeleteComment(item._id)} style={styles.actionButton}>
                                <Ionicons name="trash" size={14} color="#ff4444" />
                            </TouchableOpacity>
                        )}
                    </View>

                    {totalReactions > 0 && (
                        <View style={styles.reactionsContainer}>
                            {Object.entries(reactionCounts).map(([type, count]) => (
                                <TouchableOpacity
                                    key={type}
                                    onPress={() => handleReactComment(item._id, userReaction?.type === type ? 'remove' : type)}
                                    style={styles.reactionButton}
                                >
                                    <Ionicons
                                        name={getReactionIcon(type)}
                                        size={16}
                                        color={getReactionColor(type)}
                                    />
                                    <ThemedText style={{ color: getReactionColor(type), fontSize: typography.sizes.caption }}>
                                        {count}
                                    </ThemedText>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>
                <TouchableOpacity onLongPress={() => openReactionPicker(item._id)} style={styles.likeIcon}>
                    <Ionicons
                        name={userReaction ? getReactionIcon(userReaction.type) : "thumbs-up-outline"}
                        size={14}
                        color={userReaction ? primaryColor : lightTextColor}
                    />
                </TouchableOpacity>
            </View>
        );
    };

    const renderCommentNode = ({ item }: { item: Comment }) => {
        const replies = repliesByParent[item._id];
        const hasReplies = replies && replies.length > 0;
        const isExpanded = expandedComments.has(item._id);

        return (
            <View>
                {renderCommentContent(item)}
                {hasReplies && (
                    <View>
                        <TouchableOpacity 
                            onPress={() => toggleReplies(item._id)} 
                            style={{ marginLeft: spacing.xl + spacing.lg, paddingVertical: spacing.xs, flexDirection: 'row', alignItems: 'center' }}
                        >
                            <View style={{ width: 30, height: 1, backgroundColor: lightTextColor, marginRight: spacing.sm }} />
                            <ThemedText style={{ color: lightTextColor, fontSize: typography.sizes.caption, fontFamily: typography.families.medium }}>
                                {isExpanded ? 'Hide replies' : `View ${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}`}
                            </ThemedText>
                        </TouchableOpacity>

                        {isExpanded && replies.map(reply => (
                            <View key={reply._id}>
                                {renderCommentNode({ item: reply })}
                            </View>
                        ))}
                    </View>
                )}
            </View>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
            <ThemedView style={[styles.container, { backgroundColor }]}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose}>
                        <Ionicons name="close" size={24} color={textColor} />
                    </TouchableOpacity>
                    <ThemedText style={{ fontSize: typography.sizes.title, fontFamily: typography.families.bold }}>Comments</ThemedText>
                    <View style={{ width: 24 }} />
                </View>

                <FlatList
                    data={rootComments}
                    renderItem={renderCommentNode}
                    keyExtractor={(item) => item._id}
                    style={styles.commentList}
                    ListEmptyComponent={<ThemedText style={{ textAlign: 'center', marginTop: spacing.xl, color: lightTextColor }}>No comments yet.</ThemedText>}
                />

                <View style={{ borderTopWidth: 1, borderTopColor: useThemeColor('border') }}>
                    {replyingTo && (
                        <View style={[styles.replyBanner, { backgroundColor: useThemeColor('surface') }]}>
                            <ThemedText style={{ fontSize: typography.sizes.caption, color: lightTextColor }}>
                                Replying to <ThemedText style={{ fontFamily: typography.families.bold }}>{replyingTo.author.username}</ThemedText>
                            </ThemedText>
                            <TouchableOpacity onPress={() => setReplyingTo(null)}>
                                <Ionicons name="close" size={16} color={textColor} />
                            </TouchableOpacity>
                        </View>
                    )}
                    {post?.commentsDisabled ? (
                        <View style={[styles.inputContainer, { justifyContent: 'center' }]}>
                            <ThemedText style={{ color: lightTextColor, fontStyle: 'italic' }}>Comments are disabled for this post.</ThemedText>
                        </View>
                    ) : (
                        <View style={styles.inputContainer}>
                            {isAnonymous ? (
                                <Image source={{ uri: 'https://i.pravatar.cc/150?u=anon' }} style={styles.avatar} />
                            ) : user?.profilePhoto ? (
                                <Image source={{ uri: getImageUrl(user.profilePhoto) }} style={styles.avatar} />
                            ) : (
                                <View style={[styles.avatar, { backgroundColor: surfaceColor, justifyContent: 'center', alignItems: 'center' }]}><Ionicons name="person" size={20} color={lightTextColor} /></View>
                            )}
                            <TextInput
                                style={[styles.input, { color: textColor }]}
                                placeholder={replyingTo ? "Write a reply..." : "Add a comment..."}
                                placeholderTextColor={lightTextColor}
                                value={comment}
                                onChangeText={setComment}
                                autoFocus={!!replyingTo}
                            />
                            {taggedUsers.length > 0 && (
                                <View style={styles.tagsContainer}>
                                    <ThemedText style={{ color: lightTextColor, fontSize: typography.sizes.caption }}>Tagged: </ThemedText>
                                    <View style={styles.tagsList}>
                                        {taggedUsers.slice(0, 2).map((userId) => {
                                            const user = searchResults.find(u => u._id === userId) || friends.find(u => u._id === userId);
                                            return user ? (
                                                <TouchableOpacity
                                                    key={userId}
                                                    style={[styles.tagChip, { backgroundColor: primaryColor }]}
                                                    onPress={() => setTaggedUsers(prev => prev.filter(id => id !== userId))}
                                                >
                                                    <ThemedText style={{ color: white, fontSize: typography.sizes.caption }}>{user.username}</ThemedText>
                                                    <Ionicons name="close" size={12} color={white} />
                                                </TouchableOpacity>
                                            ) : null;
                                        })}
                                        {taggedUsers.length > 2 && (
                                            <View style={[styles.tagChip, { backgroundColor: surfaceColor, borderWidth: 1, borderColor: '#E0E0E0' }]}>
                                                <ThemedText style={{ color: textColor, fontSize: typography.sizes.caption }}>
                                                    +{taggedUsers.length - 2} others
                                                </ThemedText>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            )}
                            <TouchableOpacity
                                onPress={() => !post?.isAnonymous && setIsAnonymous(!isAnonymous)}
                                disabled={!!post?.isAnonymous}
                            >
                                <Ionicons
                                    name={isAnonymous ? "glasses" : "person"}
                                    size={20}
                                    color={isAnonymous ? primaryColor : lightTextColor}
                                    style={{ opacity: post?.isAnonymous ? 0.5 : 1 }}
                                />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setShowTagModal(true)} style={styles.tagButton}>
                                <Ionicons name="person-add" size={20} color={primaryColor} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleAddComment} disabled={isLoading}>
                                {isLoading ? <ActivityIndicator color={primaryColor} /> : <Ionicons name="send" size={24} color={primaryColor} />}
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* Tag Modal */}
                <Modal visible={showTagModal} animationType="slide" transparent={true} onRequestClose={() => setShowTagModal(false)}>
                    <View style={styles.modalOverlay}>
                        <ThemedView style={[styles.tagModal, { backgroundColor }]}>
                            <View style={styles.modalHeader}>
                                <ThemedText style={{ fontSize: typography.sizes.title, fontFamily: typography.families.bold }}>Tag Users</ThemedText>
                                <TouchableOpacity onPress={() => setShowTagModal(false)}>
                                    <Ionicons name="close" size={24} color={textColor} />
                                </TouchableOpacity>
                            </View>
                            <TextInput
                                style={[styles.searchInput, { color: textColor, backgroundColor: surfaceColor, borderColor: '#E0E0E0' }]}
                                placeholder="Search users..."
                                placeholderTextColor={lightTextColor}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                            {isSearching || isLoadingFriends ? (
                                <ActivityIndicator size="small" color={primaryColor} />
                            ) : (
                                <FlatList
                                    data={searchQuery.trim() ? searchResults : friends}
                                    keyExtractor={(item) => item._id}
                                    renderItem={({ item }) => (
                                        <TouchableOpacity
                                            style={[styles.userRow, { borderBottomColor: '#E0E0E0' }]}
                                            onPress={() => {
                                                if (!taggedUsers.includes(item._id)) {
                                                    setTaggedUsers(prev => [...prev, item._id]);
                                                }
                                            }}
                                        >
                                            <View style={[styles.userAvatar, { backgroundColor: surfaceColor }]}>
                                                {item.profilePhoto ? (
                                                    <Image source={{ uri: getImageUrl(item.profilePhoto) }} style={styles.avatarImage} />
                                                ) : (
                                                    <Ionicons name="person" size={20} color={lightTextColor} />
                                                )}
                                            </View>
                                            <ThemedText style={{ color: textColor }}>{item.username}</ThemedText>
                                            {taggedUsers.includes(item._id) && (
                                                <Ionicons name="checkmark" size={20} color={primaryColor} />
                                            )}
                                        </TouchableOpacity>
                                    )}
                                    style={{ maxHeight: 200 }}
                                    ListEmptyComponent={
                                        searchQuery.trim() ? (
                                            <ThemedText style={{ color: lightTextColor, textAlign: 'center', padding: spacing.md }}>
                                                No users found
                                            </ThemedText>
                                        ) : (
                                            <ThemedText style={{ color: lightTextColor, textAlign: 'center', padding: spacing.md }}>
                                                No friends yet
                                            </ThemedText>
                                        )
                                    }
                                />
                            )}
                            <TouchableOpacity
                                style={[styles.doneButton, { backgroundColor: primaryColor }]}
                                onPress={() => setShowTagModal(false)}
                            >
                                <ThemedText style={{ color: white, fontFamily: typography.families.bold }}>Done</ThemedText>
                            </TouchableOpacity>
                        </ThemedView>
                    </View>
                </Modal>

                {/* Reaction Picker Modal */}
                <Modal visible={showReactionPicker} animationType="fade" transparent={true} onRequestClose={() => setShowReactionPicker(false)}>
                    <TouchableWithoutFeedback onPress={() => setShowReactionPicker(false)}>
                        <View style={styles.modalOverlay}>
                            <ReactionPicker 
                                onSelect={(type) => selectedCommentForReaction && handleReactComment(selectedCommentForReaction, type)}
                                onClose={() => setShowReactionPicker(false)}
                            />
                        </View>
                    </TouchableWithoutFeedback>
                </Modal>
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
    commentList: {
        flex: 1,
    },
    commentContainer: {
        flexDirection: 'row',
        padding: spacing.md,
        gap: spacing.md,
    },
    replyContainer: {
        marginLeft: spacing.xl,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    commentActions: {
        flexDirection: 'row',
        gap: spacing.md,
        marginTop: spacing.xs,
        alignItems: 'center',
    },
    actionButton: {
        paddingVertical: 2,
    },
    likeIcon: {
        paddingTop: spacing.xs,
    },
    replyBanner: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        gap: spacing.md,
    },
    input: {
        flex: 1,
        fontSize: typography.sizes.body1,
    },
    tagButton: {
        paddingHorizontal: spacing.xs,
    },
    tagsContainer: {
        marginTop: spacing.sm,
    },
    tagsList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.xs,
        marginTop: spacing.xs,
    },
    tagChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.lg,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    tagModal: {
        width: '90%',
        maxHeight: '80%',
        borderRadius: borderRadius.lg,
        padding: spacing.md,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    searchInput: {
        height: 40,
        borderWidth: 1,
        borderRadius: borderRadius.md,
        paddingHorizontal: spacing.md,
        marginBottom: spacing.md,
    },
    doneButton: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.md,
        alignSelf: 'flex-end',
    },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
    },
    userAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.sm,
    },
    avatarImage: {
        width: 32,
        height: 32,
        borderRadius: 16,
    },
    commentTags: {
        marginTop: spacing.xs,
    },
    reactionsContainer: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: spacing.xs,
    },
    reactionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
        borderRadius: borderRadius.md,
        backgroundColor: 'rgba(0,0,0,0.05)',
    },
});
