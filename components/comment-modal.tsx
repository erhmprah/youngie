// components/comment-modal.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { Modal, StyleSheet, View, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Alert, Image } from 'react-native';
import { ThemedView } from './themed-view';
import { ThemedText } from './themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { spacing, borderRadius, typography } from '@/constants/design-tokens';
import { Ionicons } from '@expo/vector-icons';
import { postAPI, getImageUrl } from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';
import { getRelativeTime } from '@/utils/helpers';

interface Comment {
    _id: string;
    author: {
        _id: string;
        username: string;
        profilePhoto?: string;
    };
    content: string;
    createdAt: string;
    likes?: { _id: string; username: string }[];
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

    // Update comments when post changes
    useEffect(() => {
        if (post?.comments) {
            setComments(post.comments);
        } else {
            setComments([]);
        }
    }, [post]);

    useEffect(() => {
        if (visible) {
            if (post?.isAnonymous) {
                setIsAnonymous(true);
            } else {
                setIsAnonymous(initialAnonymous);
            }
        }
    }, [visible, initialAnonymous, post]);

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

    const handleAddComment = async () => {
        if (!comment.trim()) return;

        setIsLoading(true);
        try {
            if (post) {
                const response = await postAPI.addComment(post._id, { content: comment, parent: replyingTo?._id, isAnonymous });
                // The API returns the updated post, so get comments from it
                setComments(response.data.comments);
                setComment('');
                setReplyingTo(null);
            }
        } catch (error) {
            console.error('Error adding comment:', error);
            Alert.alert('Error', 'Failed to add comment.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLikeComment = async (commentId: string) => {
        if (!post) return;
        try {
            const response = await postAPI.likeComment(post._id, commentId);
            setComments(response.data.comments);
        } catch (error) {
            console.error('Error liking comment:', error);
        }
    };

    const renderCommentContent = (item: Comment) => {
        const isLiked = item.likes?.some(like => like._id === user?._id);
        const isReply = !!item.parent;

        return (
            <View style={[styles.commentContainer, isReply && styles.replyContainer]}>
                {item.author.profilePhoto ? (
                    <Image source={{ uri: getImageUrl(item.author.profilePhoto) }} style={styles.avatar} />
                ) : (
                    <View style={[styles.avatar, { backgroundColor: surfaceColor, justifyContent: 'center', alignItems: 'center' }]}>
                        <Ionicons name="person" size={20} color={lightTextColor} />
                    </View>
                )}
                <View style={{ flex: 1 }}>
                    <ThemedText>
                        <ThemedText style={{ fontFamily: typography.families.bold }}>{item.author.username} </ThemedText>
                        {item.content}
                    </ThemedText>
                    
                    <View style={styles.commentActions}>
                        <ThemedText style={{ color: lightTextColor, fontSize: typography.sizes.caption }}>
                            {getRelativeTime(item.createdAt)}
                        </ThemedText>
                        
                        <TouchableOpacity onPress={() => handleLikeComment(item._id)} style={styles.actionButton}>
                            <ThemedText style={{ color: lightTextColor, fontSize: typography.sizes.caption, fontFamily: typography.families.medium }}>
                                {item.likes?.length || 0} Likes
                            </ThemedText>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => setReplyingTo(item)} style={styles.actionButton}>
                            <ThemedText style={{ color: lightTextColor, fontSize: typography.sizes.caption, fontFamily: typography.families.medium }}>
                                Reply
                            </ThemedText>
                        </TouchableOpacity>
                    </View>
                </View>
                <TouchableOpacity onPress={() => handleLikeComment(item._id)} style={styles.likeIcon}>
                    <Ionicons 
                        name={isLiked ? "heart" : "heart-outline"} 
                        size={14} 
                        color={isLiked ? primaryColor : lightTextColor} 
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
                            <TouchableOpacity onPress={handleAddComment} disabled={isLoading}>
                                {isLoading ? <ActivityIndicator color={primaryColor} /> : <Ionicons name="send" size={24} color={primaryColor} />}
                            </TouchableOpacity>
                        </View>
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
});
