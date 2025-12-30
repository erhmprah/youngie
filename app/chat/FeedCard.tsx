import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View, Alert, Image, Dimensions, Share } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { spacing, borderRadius, typography } from '@/constants/design-tokens';
import { FeedPostOptions } from '@/app/chat/FeedPostOptions';
import { EditPostModal } from '@/components/edit-post-modal';
import { postAPI, getImageUrl } from '@/utils/api';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface FeedPost {
    _id: string;
    author: {
        _id: string;
        username: string;
    };
    content?: string;
    image?: string;
    video?: string;
    createdAt: string;
    updatedAt: string;
    likes: { _id: string; username: string }[];
    comments: any[];
}

interface FeedCardProps {
    post: FeedPost;
    currentUserId: string;
    onDelete?: (postId: string) => void;
    onReport?: (postId: string) => void;
    onUpdate?: (updatedPost: any) => void;
    onLike?: (postId: string) => void;
    onComment?: (post: FeedPost) => void;
}

export function FeedCard({ post, currentUserId, onDelete, onReport, onUpdate, onLike, onComment }: FeedCardProps) {
    const [optionsVisible, setOptionsVisible] = useState(false);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const textColor = useThemeColor('text');
    const lightTextColor = useThemeColor('lightText');
    const errorColor = useThemeColor('error');
    const isOwner = post.author._id === currentUserId;
    const isLiked = post.likes.some(l => l._id === currentUserId);
    const { width } = Dimensions.get('window');

    const handleEdit = () => {
        setOptionsVisible(false);
        setEditModalVisible(true);
    };

    const handleDelete = () => {
        setOptionsVisible(false);
        Alert.alert(
            "Delete Post",
            "Are you sure you want to delete this post?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => onDelete?.(post._id)
                }
            ]
        );
    };

    const handleReport = () => {
        setOptionsVisible(false);
        Alert.alert(
            "Report Post",
            "Are you sure you want to report this post?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Report",
                    onPress: () => {
                        onReport?.(post._id);
                        Alert.alert("Reported", "Thanks for letting us know. We will review this post.");
                    }
                }
            ]
        );
    };

    const handleSaveEdit = async (content: string, imagePath?: string) => {
        try {
            const response = await postAPI.updatePost(post._id, {
                content,
                image: imagePath,
            });
            onUpdate?.(response.data);
            Alert.alert("Success", "Post updated successfully");
        } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to update post");
        }
    };

    const handleShare = async () => {
        try {
            let message = `Check out this post by ${post.author.username}`;

            if (post.content) {
                message += `: "${post.content}"`;
            }

            if (post.image) {
                message += ' [with image]';
            } else if (post.video) {
                message += ' [with video]';
            }

            message += ' - Shared from Youngie';

            await Share.share({
                message,
            });
        } catch (error: any) {
            Alert.alert('Error', 'Failed to share post');
        }
    };

    return (
        <ThemedView style={styles.card}>
            <View style={styles.header}>
                <View style={styles.userInfo}>
                    <ThemedText type="default">{post.author.username}</ThemedText>
                    <ThemedText style={styles.timestamp}>
                        {new Date(post.createdAt).toLocaleDateString()}
                    </ThemedText>
                </View>
                <TouchableOpacity onPress={() => setOptionsVisible(true)} hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }} style={{ zIndex: 10 }}>
                    <Ionicons name="ellipsis-horizontal" size={20} color={textColor} />
                </TouchableOpacity>
            </View>

            {post.content && <ThemedText style={styles.content}>{post.content}</ThemedText>}

            {post.image && <Image source={{ uri: getImageUrl(post.image) }} style={[styles.postMedia, { width, height: width }]} resizeMode="cover" />}
            {post.video && (
                <Video
                    source={{ uri: getImageUrl(post.video)! }}
                    style={[styles.postMedia, { width, height: width }]}
                    useNativeControls
                    resizeMode={ResizeMode.COVER}
                    isLooping={false}
                />
            )}

            <View style={styles.actionBar}>
                <View style={styles.leftActions}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => onLike?.(post._id)}>
                        <IconSymbol name="heart.fill" size={24} color={isLiked ? errorColor : textColor} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => onComment?.(post)}>
                        <IconSymbol name="message.fill" size={24} color={textColor} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
                        <IconSymbol name="paperplane.fill" size={24} color={textColor} />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.socialStats}>
                <ThemedText style={{ fontWeight: '600', fontSize: typography.sizes.body2 }}>{post.likes.length.toLocaleString()} likes</ThemedText>
                <TouchableOpacity onPress={() => onComment?.(post)}>
                    <ThemedText style={{ color: lightTextColor, fontSize: typography.sizes.body2 }}>View all {post.comments.length} comments</ThemedText>
                </TouchableOpacity>
            </View>

            <FeedPostOptions
                visible={optionsVisible}
                onClose={() => setOptionsVisible(false)}
                isOwner={isOwner}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onReport={handleReport}
            />

            <EditPostModal
                visible={editModalVisible}
                onClose={() => setEditModalVisible(false)}
                onSave={handleSaveEdit}
                initialData={post}
            />
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    card: {
        padding: spacing.md,
        marginBottom: spacing.sm,
        borderRadius: borderRadius.md,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing.sm,
    },
    userInfo: {
        flex: 1,
    },
    timestamp: {
        fontSize: typography.sizes.tiny,
        color: 'gray',
    },
    content: {
        fontSize: typography.sizes.body1,
        lineHeight: 20,
        marginBottom: spacing.md,
    },
    postMedia: {
        backgroundColor: '#E0E0E0',
        marginBottom: spacing.md,
    },
    actionBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: spacing.sm,
    },
    leftActions: {
        flexDirection: 'row',
        gap: spacing.lg,
    },
    actionBtn: {},
    socialStats: {
        paddingBottom: spacing.md,
    },
});