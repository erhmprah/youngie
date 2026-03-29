import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, TouchableOpacity, View, Alert, Image, Dimensions, Animated, TouchableWithoutFeedback, FlatList, ViewToken } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { spacing, borderRadius, typography } from '@/constants/design-tokens';
import { FeedPostOptions } from '@/app/chat/FeedPostOptions.component';
import { EditPostModal } from '@/components/edit-post-modal';
import { PollView } from '@/components/poll-view';
import { ReactionPicker, ReactionType } from '@/components/reaction-picker';
import { ReactionModal } from '@/components/reaction-modal';
import { LikesModal } from '@/components/likes-modal';
import { CommentModal } from '@/components/comment-modal';
import { postAPI, userAPI, getImageUrl } from '@/utils/api';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/AuthContext';
import { getSocket } from '@/utils/socket';
import { useRouter } from 'expo-router';

const REACTION_ICONS: Record<ReactionType, keyof typeof Ionicons.glyphMap> = {
    like: 'thumbs-up',
    heart: 'heart',
    laugh: 'happy',
    wow: 'star',
    sad: 'sad',
    fire: 'flame',
};

const REACTION_COLORS: Record<ReactionType, string> = {
    like: '#4A90E2',
    heart: '#E0245E',
    laugh: '#F7B500',
    wow: '#9013FE',
    sad: '#F5A623',
    fire: '#FF5722',
};

interface FeedPost {
    _id: string;
    author: {
        _id: string;
        username: string;
        profilePhoto?: string;
        isOnline?: boolean;
    };
    content?: string;
    image?: string;
    images?: string[];
    video?: string;
    media?: { url: string; type: 'image' | 'video' }[];
    createdAt: string;
    updatedAt: string;
    likes: { _id: string; username: string; profilePhoto?: string }[];
    reactions?: { user: { _id: string; username: string }; type: ReactionType; createdAt: string }[];
    isFavorited?: boolean;
    comments: any[];
    tags?: { _id: string; username: string }[];
    isAnonymous?: boolean;
    shares?: number;
    pollOptions?: { text: string; votes: string[] }[];
    category?: string;
}

interface FeedCardProps {
    post: FeedPost;
    currentUserId: string;
    onDelete?: (postId: string) => void;
    onReport?: (postId: string) => void;
    onUpdate?: (updatedPost: any) => void;
    onLike?: (postId: string) => void;
    onComment?: (post: FeedPost) => void;
    onFavorite?: (postId: string) => void;
    shouldPlay?: boolean;
}

export const FeedCard = React.memo(({ post: initialPost, currentUserId, onDelete, onReport, onUpdate, onLike, onComment, onFavorite, shouldPlay }: FeedCardProps) => {
    const { user } = useAuth();
    const [post, setPost] = useState(initialPost);
    const [optionsVisible, setOptionsVisible] = useState(false);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [reactionPickerVisible, setReactionPickerVisible] = useState(false);
    const [reactionModalVisible, setReactionModalVisible] = useState(false);
    const [likesModalVisible, setLikesModalVisible] = useState(false);
    const [commentsModalVisible, setCommentsModalVisible] = useState(false);
    const textColor = useThemeColor('text');
    const lightTextColor = useThemeColor('lightText');
    const errorColor = useThemeColor('error');
    const primaryColor = useThemeColor('primary');
    const backgroundColor = useThemeColor('background');
    const isOwner = post.author._id === currentUserId;
    const isLiked = post.likes.some(l => l._id === currentUserId);
    const userReaction = post.reactions?.find(r => r.user._id === currentUserId);
    const [isFavorited, setIsFavorited] = useState(post.isFavorited ?? false);
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const lastTap = useRef<number | null>(null);
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const videoRef = useRef<Video>(null);
    const router = useRouter();
    const [activeImageIndex, setActiveImageIndex] = useState(0);

    const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
        if (viewableItems.length > 0 && viewableItems[0].index !== null) {
            setActiveImageIndex(viewableItems[0].index);
        }
    }).current;
    const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

    useEffect(() => {
        setPost(initialPost);
        setActiveImageIndex(0);
    }, [initialPost]);

    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;

        const handlePostUpdate = (updatedPost: any) => {
            if (updatedPost._id === post._id) {
                setPost(updatedPost);
                onUpdate?.(updatedPost);
            }
        };

        socket.on('post:updated', handlePostUpdate);
        return () => {
            socket.off('post:updated', handlePostUpdate);
        };
    }, [post._id, onUpdate]);

    useEffect(() => {
        setIsFavorited(post.isFavorited ?? false);
    }, [post.isFavorited]);

    useEffect(() => {
        if (post.author.isOnline) {
            const anim = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.2,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                ])
            );
            anim.start();
            return () => anim.stop();
        }
    }, [post.author.isOnline]);

    useEffect(() => {
        if (!shouldPlay && videoRef.current) {
            videoRef.current.pauseAsync().catch(() => {});
        }
        return () => {
            if (longPressTimer.current) {
                clearTimeout(longPressTimer.current);
            }
        };
    }, [shouldPlay]);

    const handleDoubleTap = () => {
        const now = Date.now();
        const DOUBLE_PRESS_DELAY = 300;
        if (lastTap.current && (now - lastTap.current) < DOUBLE_PRESS_DELAY) {
            if (!isLiked) {
                onLike?.(post._id);
            }
            lastTap.current = null;
        } else {
            lastTap.current = now;
        }
    };

    const handleLikePressIn = () => {
        longPressTimer.current = setTimeout(() => {
            setReactionPickerVisible(true);
        }, 500);
    };

    const handleLikePressOut = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    const handleLikePress = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
            return;
        }
        // Tap: toggle like
        if (userReaction) {
            // Remove reaction if already reacted
            handleReactionSelect(userReaction.type);
        } else {
            onLike?.(post._id);
        }
    };

    const handleFavoritePress = async () => {
        setIsFavorited(prev => !prev);
        if (onFavorite) {
            onFavorite(post._id);
        } else {
            try {
                if (!isFavorited) {
                    await postAPI.favoritePost(post._id);
                } else {
                    await postAPI.unfavoritePost(post._id);
                }
            } catch (error) {
                setIsFavorited(prev => !prev);
            }
        }
    };
    const { width: screenWidth } = Dimensions.get('window');
    const availableWidth = screenWidth - (spacing.lg * 2); // 16px padding on each side

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

    const handleMute = async () => {
        setOptionsVisible(false);
        Alert.alert(
            "Mute User",
            `Are you sure you want to mute ${post.author.username}? You won't see their posts in your feed anymore.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Mute",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await userAPI.muteUser(post.author._id);
                            Alert.alert("Muted", `You have muted ${post.author.username}.`);
                        } catch (error: any) {
                            Alert.alert("Error", "Something went wrong. Please try again.");
                        }
                    }
                }
            ]
        );
    };

    const handleSaveEdit = async (content: string, media?: { uri: string; type: 'image' | 'video' }) => {
        try {
            const updateData: {
                content: string;
                media?: { url: string; type: 'image' | 'video' }[];
            } = {
                content,
            };

            if (media) {
                updateData.media = [{ url: media.uri, type: media.type }];
            }

            const response = await postAPI.updatePost(post._id, updateData);
            onUpdate?.(response.data);
            Alert.alert("Success", "Post updated successfully");
        } catch (error: any) {
            Alert.alert("Error", "Something went wrong. Please try again.");
        }
    };

    const handleShare = async () => {
        if (post.isAnonymous) {
            Alert.alert('Cannot Share', 'Sharing anonymous posts is not allowed.');
            return;
        }

        Alert.alert(
            'Share Post',
            'Are you sure you want to share this post to your feed?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Share',
                    onPress: async () => {
                        try {
                            await postAPI.sharePost(post._id);

                            const repostContent = post.content ? `Shared: ${post.content}` : 'Shared post';
                            
                            const newPostData: any = {
                                content: repostContent,
                                isPublic: true,
                                isAnonymous: false,
                                commentsDisabled: false,
                                tags: [],
                            };

                            if (post.media && post.media.length > 0) {
                                newPostData.media = post.media;
                            } else {
                                newPostData.image = post.image;
                                newPostData.video = post.video;
                            }

                            await postAPI.createPost(newPostData);
                            Alert.alert('Success', 'Post reposted to your feed');
                        } catch (_error: any) {
                            Alert.alert('Error', 'Failed to repost post');
                        }
                    }
                }
            ]
        );
    };

    const handleReactionSelect = async (reaction: ReactionType) => {
        try {
            // Check if user already has this reaction
            const hasSameReaction = post.reactions?.some(r => r.user._id === currentUserId && r.type === reaction);
            
            if (hasSameReaction) {
                // Remove reaction if user is clicking the same reaction type again
                await postAPI.reactPost(post._id, { reactionType: 'remove' });
                const updatedPost = {
                    ...post,
                    reactions: (post.reactions || []).filter(r => r.user._id !== currentUserId)
                };
                onUpdate?.(updatedPost);
            } else {
                // Add new reaction (and remove any existing reaction)
                await postAPI.reactPost(post._id, { reactionType: reaction });
                const updatedPost = {
                    ...post,
                    reactions: [
                        ...(post.reactions || []).filter(r => r.user._id !== currentUserId),
                        { user: { _id: currentUserId, username: user?.username || '' }, type: reaction, createdAt: new Date().toISOString() }
                    ]
                };
                onUpdate?.(updatedPost);
            }
        } catch (error) {
            console.error('Reaction failed:', error);
        }
        setReactionPickerVisible(false);
    };

    return (
        <ThemedView style={styles.card}>
            <View style={styles.header}>
                <View style={styles.userInfo}>
                    <TouchableOpacity 
                        style={styles.authorRow}
                        onPress={() => router.push(`/user/${post.author._id}`)}
                    >
                        <View style={styles.avatarContainer}>
                            {post.author.profilePhoto ? (
                                <Image source={{ uri: getImageUrl(post.author.profilePhoto) }} style={styles.profilePhoto} />
                            ) : (
                                <View style={[styles.profilePhotoPlaceholder, { backgroundColor: primaryColor }]}>
                                    <IconSymbol name="person.fill" size={16} color="white" />
                                </View>
                            )}
                            {post.author.isOnline && <Animated.View style={[styles.onlineIndicator, { borderColor: backgroundColor, transform: [{ scale: pulseAnim }] }]} />}
                        </View>
                        <View style={styles.authorDetails}>
                            <View style={{ flexDirection: 'column' }}>
                                <ThemedText type="default" style={styles.username}>{post.author.username}</ThemedText>
                                {post.tags && post.tags.length > 0 && (
                                    <ThemedText style={{ fontSize: typography.sizes.body2, color: lightTextColor }}>
                                        with {post.tags.map(tag => tag.username || '').join(', ')}
                                    </ThemedText>
                                )}
                            </View>
                            <ThemedText style={styles.timestamp}>
                                {new Date(post.createdAt).toLocaleDateString()}
                            </ThemedText>
                        </View>
                    </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => setOptionsVisible(true)} hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }} style={{ zIndex: 10 }}>
                    <Ionicons name="ellipsis-horizontal" size={20} color={textColor} />
                </TouchableOpacity>
            </View>

            {post.content && <ThemedText style={styles.content}>{String(post.content)}</ThemedText>}

            {post.category && (
                <View style={styles.categoryBadge}>
                    <ThemedText style={styles.categoryText}>{post.category}</ThemedText>
                </View>
            )}

            {post.pollOptions && post.pollOptions.length > 0 && (
                <PollView
                    postId={post._id}
                    options={post.pollOptions}
                    onVote={(updatedOptions) => {
                        const updatedPost = { ...post, pollOptions: updatedOptions };
                        onUpdate?.(updatedPost);
                    }}
                />
            )}

            <View>
                {post.media && post.media.length > 0 ? (
                <View style={[styles.postMedia, { height: availableWidth }]}>
                    <FlatList
                        data={post.media}
                        renderItem={({ item }) => (
                            <View style={{ width: availableWidth, height: availableWidth }}>
                                {item.type === 'image' ? (
                                    <TouchableWithoutFeedback onPress={handleDoubleTap}>
                                        <Image
                                            source={{ uri: getImageUrl(item.url) || '' }}
                                            style={{ width: availableWidth, height: availableWidth, backgroundColor: '#E0E0E0' }}
                                            resizeMode="cover"
                                        />
                                    </TouchableWithoutFeedback>
                                ) : (
                                    <TouchableWithoutFeedback onPress={handleDoubleTap}>
                                        <Video
                                            ref={videoRef}
                                            source={{ uri: getImageUrl(item.url) || '' }}
                                            style={{ width: availableWidth, height: availableWidth }}
                                            resizeMode={ResizeMode.COVER}
                                            shouldPlay={shouldPlay}
                                            isLooping={true}
                                        />
                                    </TouchableWithoutFeedback>
                                )}
                            </View>
                        )}
                        keyExtractor={(item, index) => `${post._id}-media-${index}`}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        onViewableItemsChanged={onViewableItemsChanged}
                        viewabilityConfig={viewabilityConfig}
                        style={{ width: availableWidth }}
                    />
                    {(post.media?.length || 0) > 1 && (
                        <>
                            <View style={styles.imageCounter}>
                                <ThemedText style={styles.imageCounterText}>{activeImageIndex + 1}/{post.media?.length || 0}</ThemedText>
                            </View>
                        </>
                    )}
                </View>
                ) : post.images && post.images.length > 0 ? (
                    <View style={[styles.postMedia, { height: availableWidth }]}>
                        <FlatList
                            data={post.images}
                            renderItem={({ item }) => (
                                <View style={{ width: availableWidth, height: availableWidth }}>
                                    <TouchableWithoutFeedback onPress={handleDoubleTap}>
                                        <Image
                                            source={{ uri: getImageUrl(item) }}
                                            style={{ width: availableWidth, height: availableWidth, backgroundColor: '#E0E0E0' }}
                                            resizeMode="cover"
                                        />
                                    </TouchableWithoutFeedback>
                                </View>
                            )}
                            keyExtractor={(item, index) => `${post._id}-img-${index}`}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            onViewableItemsChanged={onViewableItemsChanged}
                            viewabilityConfig={viewabilityConfig}
                            style={{ width: availableWidth }}
                        />
                        {post.images.length > 1 && (
                            <>
                                <View style={styles.imageCounter}>
                                    <ThemedText style={styles.imageCounterText}>{activeImageIndex + 1}/{post.images.length}</ThemedText>
                                </View>
                            </>
                        )}
                    </View>
                ) : post.image ? (
                    <TouchableWithoutFeedback onPress={handleDoubleTap}>
                        <Image source={{ uri: getImageUrl(post.image) }} style={[styles.postMedia, { width: availableWidth, height: availableWidth }]} resizeMode="cover" />
                    </TouchableWithoutFeedback>
                ) : post.video ? (
                    <TouchableWithoutFeedback onPress={handleDoubleTap}>
                        <Video
                            ref={videoRef}
                            source={{ uri: getImageUrl(post.video) || '' }}
                            style={[styles.postMedia, { width: availableWidth, height: availableWidth }]}
                            resizeMode={ResizeMode.COVER}
                            shouldPlay={shouldPlay}
                            isLooping={true}
                        />
                    </TouchableWithoutFeedback>
                ) : null}
            </View>

            <View style={styles.actionBar}>
                <View style={styles.leftActions}>
                    <View style={styles.actionWithCount}>
                        <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={handleLikePress}
                            onPressIn={handleLikePressIn}
                            onPressOut={handleLikePressOut}
                        >
                            {userReaction ? (
                                <Ionicons 
                                    name={REACTION_ICONS[userReaction.type]} 
                                    size={24} 
                                    color={REACTION_COLORS[userReaction.type]} 
                                />
                            ) : (
                                <IconSymbol name="heart.fill" size={24} color={isLiked ? errorColor : textColor} />
                            )}
                        </TouchableOpacity>
                        {(post.likes.length > 0 || (post.reactions && post.reactions.length > 0)) && (
                            <TouchableOpacity onPress={() => setLikesModalVisible(true)}>
                                <ThemedText style={[styles.actionCount, { color: textColor }]}>
                                    {(post.likes.length + (post.reactions?.length || 0)).toLocaleString()}
                                </ThemedText>
                            </TouchableOpacity>
                        )}
                    </View>
                    <View style={styles.actionWithCount}>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => setCommentsModalVisible(true)}>
                            <IconSymbol name="message.fill" size={24} color={textColor} />
                        </TouchableOpacity>
                        {post.comments.length > 0 && (
                            <TouchableOpacity onPress={() => setCommentsModalVisible(true)}>
                                <ThemedText style={[styles.actionCount, { color: textColor }]}>
                                    {post.comments.length.toLocaleString()}
                                </ThemedText>
                            </TouchableOpacity>
                        )}
                    </View>
                    <View style={styles.actionWithCount}>
                        <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
                            <IconSymbol name="paperplane.fill" size={24} color={textColor} />
                        </TouchableOpacity>
                        {(post.shares || 0) > 0 && (
                            <TouchableOpacity onPress={handleShare}>
                                <ThemedText style={[styles.actionCount, { color: textColor }]}>
                                    {(post.shares || 0).toLocaleString()}
                                </ThemedText>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
                <TouchableOpacity style={styles.actionBtn} onPress={handleFavoritePress}>
                    <IconSymbol name={isFavorited ? "bookmark.fill" : "bookmark"} size={24} color={isFavorited ? primaryColor : textColor} />
                </TouchableOpacity>
            </View>

            {reactionPickerVisible && (
                <View style={styles.reactionPickerContainer}>
                    <ReactionPicker
                        onSelect={handleReactionSelect}
                        onClose={() => setReactionPickerVisible(false)}
                    />
                </View>
            )}

            <View style={styles.socialStats}>
                {typeof post.shares === 'number' && post.shares > 0 && (
                    <ThemedText style={{ color: lightTextColor, fontSize: typography.sizes.body2 }}>
                        {post.shares.toLocaleString()} shares
                    </ThemedText>
                )}
            </View>

            <FeedPostOptions
                visible={optionsVisible}
                onClose={() => setOptionsVisible(false)}
                isOwner={isOwner}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onReport={handleReport}
                onMute={handleMute}
            />

            <EditPostModal
                visible={editModalVisible}
                onClose={() => setEditModalVisible(false)}
                onSave={handleSaveEdit}
                initialData={post}
            />

            <LikesModal
                visible={likesModalVisible}
                onClose={() => setLikesModalVisible(false)}
                likes={post.likes}
                reactions={post.reactions}
            />
            
            <CommentModal
                visible={commentsModalVisible}
                onClose={() => setCommentsModalVisible(false)}
                post={post}
            />
            <ReactionModal
                visible={reactionModalVisible}
                onClose={() => setReactionModalVisible(false)}
                reactions={post.reactions || []}
            />

        </ThemedView>
    );
});

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
    authorRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatarContainer: {
        marginRight: spacing.sm,
    },
    profilePhoto: {
        width: 32,
        height: 32,
        borderRadius: 16,
    },
    profilePhotoPlaceholder: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    authorDetails: {
        flex: 1,
    },
    username: {
        fontFamily: typography.families.bold,
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
    categoryBadge: {
        alignSelf: 'flex-start',
        backgroundColor: '#007AFF',
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: borderRadius.sm,
        marginBottom: spacing.md,
    },
    categoryText: {
        color: 'white',
        fontSize: typography.sizes.caption,
        fontFamily: typography.families.bold,
    },
    postMedia: {
        backgroundColor: '#E0E0E0',
        marginBottom: spacing.md,
        alignItems: 'center',
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
    actionWithCount: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    actionCount: {
        fontSize: typography.sizes.body2,
        fontFamily: typography.families.medium,
    },
    socialStats: {
        paddingBottom: spacing.md,
    },
    onlineIndicator: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#4CAF50',
        borderWidth: 2,
    },
    reactionPickerContainer: {
        position: 'absolute',
        top: -60,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 1000,
    },
    imageCounter: {
        position: 'absolute',
        top: spacing.sm,
        right: spacing.sm,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: borderRadius.round,
    },
    imageCounterText: {
        color: 'white',
        fontSize: typography.sizes.caption,
        fontFamily: typography.families.medium,
    },
    swipeIndicator: {
        position: 'absolute',
        bottom: spacing.sm,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing.xs,
    },
    swipeDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
});
