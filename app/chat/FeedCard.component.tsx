import { FeedPostOptions } from '@/app/chat/FeedPostOptions.component';
import { CommentModal } from '@/components/comment-modal';
import { EditPostModal } from '@/components/edit-post-modal';
import { LikesModal } from '@/components/likes-modal';
import { MediaPreviewModal } from '@/components/media-preview-modal';
import { PollView } from '@/components/poll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { borderRadius, shadows, spacing, typography } from '@/constants/design-tokens';
import { useThemeColor } from '@/hooks/use-theme-color';
import { CustomAlert } from '@/utils/alert';
import { communityAPI, getImageUrl, postAPI, userAPI } from '@/utils/api';
import { getRelativeTime } from '@/utils/helpers';
import { getSocket } from '@/utils/socket';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, FlatList, Image, StyleSheet, TouchableOpacity, View, ViewToken } from 'react-native';

interface FeedPost {
    _id: string;
    author: {
        _id: string;
        id: string;
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
    communityId?: string;
    voteAPI?: (postId: string, optionIndex: number) => Promise<any>;
}

const viewabilityConfig = { itemVisiblePercentThreshold: 50 };

function InlineVideo({ uri, shouldPlay, style }: { uri: string; shouldPlay: boolean; style: any }) {
    const player = useVideoPlayer({ uri }, (p) => {
        p.loop = true;
        p.muted = true;
    });
    useEffect(() => {
        if (shouldPlay) {
            player.replay();
            player.play();
        } else {
            player.pause();
        }
    }, [player, shouldPlay]);
    return (
        <VideoView
            player={player}
            style={style}
            nativeControls={false}
            contentFit="cover"
        />
    );
}

export const FeedCard = React.memo(({ post: initialPost, currentUserId, onDelete, onReport, onUpdate, onLike, onComment, onFavorite, shouldPlay, communityId, voteAPI }: FeedCardProps) => {
    const [post, setPost] = useState(initialPost);
    const [optionsVisible, setOptionsVisible] = useState(false);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [likesModalVisible, setLikesModalVisible] = useState(false);
    const [commentsModalVisible, setCommentsModalVisible] = useState(false);
    const textColor = useThemeColor('text');
    const lightTextColor = useThemeColor('lightText');
    const errorColor = useThemeColor('error');
    const primaryColor = useThemeColor('primary');
    const backgroundColor = useThemeColor('background');
    const surfaceColor = useThemeColor('surface');
    const borderColor = useThemeColor('border');
    const isOwner = post.author._id === currentUserId;
    const isAnonPost = !!post.isAnonymous;
    const isLiked = post.likes.some(l => l._id === currentUserId);
    const [isFavorited, setIsFavorited] = useState(post.isFavorited ?? false);
    const [pulseAnim] = useState(() => new Animated.Value(1));
    const lastTap = useRef<number | null>(null);
    const router = useRouter();
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [previewMedia, setPreviewMedia] = useState<{ attachments: any[]; index: number } | null>(null);
    const mediaTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
        if (viewableItems.length > 0 && viewableItems[0].index !== null) {
            setActiveImageIndex(viewableItems[0].index);
        }
    }, []);

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
    }, [post.author.isOnline, pulseAnim]);

    const normalizeMediaUrl = (rawUrl: string): string => {
        if (!rawUrl) return rawUrl;
        const trimmed = rawUrl.trim().replace(/\\/g, '/');
        if (/^(http|https):\/\//.test(trimmed)) {
            return trimmed;
        }
        if (/^\/\//.test(trimmed)) {
            return `http:${trimmed}`;
        }
        const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
        return getImageUrl(path) || trimmed;
    };

    const getAllMediaItems = (): { uri: string; type: string }[] => {
        const items: { uri: string; type: string }[] = [];
        if (post.media && post.media.length > 0) {
            post.media.forEach((m) => items.push({ uri: normalizeMediaUrl(m.url), type: m.type || 'image' }));
        } else if (post.images && post.images.length > 0) {
            post.images.forEach((img) => items.push({ uri: normalizeMediaUrl(img), type: 'image' }));
        } else if (post.image) {
            items.push({ uri: normalizeMediaUrl(post.image), type: 'image' });
        } else if (post.video) {
            items.push({ uri: normalizeMediaUrl(post.video), type: 'video' });
        }
        return items;
    };

    const handleMediaTap = (url: string, type?: string) => {
        const DOUBLE_PRESS_DELAY = 300;
        const resolvedUrl = normalizeMediaUrl(url);

        if (lastTap.current) {
            if (mediaTapTimer.current) {
                clearTimeout(mediaTapTimer.current);
                mediaTapTimer.current = null;
            }
            if (!isLiked) {
                onLike?.(post._id);
            }
            lastTap.current = null;
        } else {
            lastTap.current = 1;
            mediaTapTimer.current = setTimeout(() => {
                const items = getAllMediaItems();
                const index = items.findIndex((item) => item.uri === resolvedUrl);
                setPreviewMedia({ attachments: items.length > 0 ? items : [{ uri: resolvedUrl, type: type || 'image' }], index: index >= 0 ? index : 0 });
                lastTap.current = null;
                mediaTapTimer.current = null;
            }, DOUBLE_PRESS_DELAY);
        }
    };

    const handleLikePress = () => {
        onLike?.(post._id);
    };

    const handleFavoritePress = async () => {
        setIsFavorited(prev => !prev);
        if (onFavorite) {
            onFavorite(post._id);
        } else if (communityId) {
            try {
                if (!isFavorited) {
                    await communityAPI.favoriteFeed(communityId, post._id);
                } else {
                    await communityAPI.unfavoriteFeed(communityId, post._id);
                }
            } catch {
                setIsFavorited(prev => !prev);
            }
        } else {
            try {
                if (!isFavorited) {
                    await postAPI.favoritePost(post._id);
                } else {
                    await postAPI.unfavoritePost(post._id);
                }
            } catch {
                setIsFavorited(prev => !prev);
            }
        }
    };
    const { width: screenWidth } = Dimensions.get('window');
    const [cardWidth, setCardWidth] = useState(screenWidth);
    const contentWidth = cardWidth - (spacing.lg * 2);
    const resolvedVoteAPI = voteAPI ?? (communityId ? ((postId: string, optionIndex: number) => communityAPI.voteFeedPoll(communityId, postId, optionIndex)) : undefined);

    const handleEdit = () => {
        setOptionsVisible(false);
        setEditModalVisible(true);
    };

    const handleDelete = () => {
        setOptionsVisible(false);
        CustomAlert.show({
            type: 'confirm',
            title: 'Delete Post',
            message: 'Are you sure you want to delete this post?',
            buttons: [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => onDelete?.(post._id)
                }
            ],
            dismissable: true
        });
    };

    const handleReport = () => {
        setOptionsVisible(false);
        CustomAlert.show({
            type: 'confirm',
            title: 'Report Post',
            message: 'Are you sure you want to report this post?',
            buttons: [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Report',
                    onPress: async () => {
                        try {
                            await onReport?.(post._id);
                            CustomAlert.success('Reported', 'Thanks for letting us know. We will review this post.');
                        } catch {
                            CustomAlert.error('Error', 'Failed to report post');
                        }
                    }
                }
            ],
            dismissable: true
        });
    };

    const handleMute = async () => {
        setOptionsVisible(false);
        if (isAnonPost) {
            CustomAlert.info('Anonymous Post', 'You cannot mute the author of an anonymous post.');
            return;
        }
        CustomAlert.show({
            type: 'confirm',
            title: 'Mute User',
            message: `Are you sure you want to mute ${post.author.username}? You won't see their posts in your feed anymore.`,
            buttons: [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Mute',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await userAPI.muteUser(post.author._id);
                            CustomAlert.success('Muted', `You have muted ${post.author.username}.`);
                        } catch {
                            CustomAlert.error('Error', 'Something went wrong. Please try again.');
                        }
                    }
                }
            ],
            dismissable: true
        });
    };

    const handleSaveEdit = async (content: string, media?: { uri: string; type: 'image' | 'video' }) => {
        try {
            if (communityId) {
                const updateData: { content: string; images?: string[] } = { content };
                if (media && media.type === 'image') {
                    updateData.images = [media.uri];
                }
                const response = await communityAPI.updateFeed(communityId, post._id, updateData);
                onUpdate?.(response.data);
                CustomAlert.success('Success', 'Post updated successfully');
                return;
            }

            const updateData: {
                content: string;
                images?: string[];
                video?: string;
            } = {
                content,
            };

            if (media) {
                if (media.type === 'image') {
                    updateData.images = [media.uri];
                } else if (media.type === 'video') {
                    updateData.video = media.uri;
                }
            }

            const response = await postAPI.updatePost(post._id, updateData);
            onUpdate?.(response.data);
            CustomAlert.success('Success', 'Post updated successfully');
        } catch {
            CustomAlert.error('Error', 'Something went wrong. Please try again.');
        }
    };

    const handleShare = async () => {
        if (communityId) {
            return;
        }
        if (post.isAnonymous) {
            CustomAlert.warning('Cannot Share', 'Sharing anonymous posts is not allowed.');
            return;
        }

        CustomAlert.show({
            type: 'confirm',
            title: 'Share Post',
            message: 'Are you sure you want to share this post to your feed?',
            buttons: [
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
                                newPostData.images = post.media.map(m => m.url);
                            } else if (post.image) {
                                newPostData.images = [post.image];
                            }
                            if (post.video) {
                                newPostData.video = post.video;
                            }

                            await postAPI.createPost(newPostData);
                            CustomAlert.success('Success', 'Post reposted to your feed');
                        } catch {
                            CustomAlert.error('Error', 'Failed to repost post');
                        }
                    }
                }
            ],
            dismissable: true
        });
    };

    return (
        <ThemedView style={[styles.card, { backgroundColor: surfaceColor, borderColor }]} onLayout={(e) => setCardWidth(e.nativeEvent.layout.width)}>
            <View style={styles.header}>
                <View style={styles.userInfo}>
                    <TouchableOpacity 
                        style={styles.authorRow}
                        disabled={isAnonPost}
                        onPress={() => {
                            if (!isAnonPost && post.author._id !== currentUserId) {
                                router.push(`/user/${post.author._id}`);
                            }
                        }}
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
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xxs }}>
                                    <ThemedText type="default" style={styles.username}>{post.author.username}</ThemedText>
                                    {isAnonPost && <Ionicons name="glasses" size={14} color={lightTextColor} style={styles.anonymousIndicator} />}
                                </View>
                                {post.tags && post.tags.length > 0 && (
                                    <ThemedText style={{ fontSize: typography.sizes.body2, color: lightTextColor }}>
                                        with {post.tags.map(tag => tag.username || '').join(', ')}
                                    </ThemedText>
                                )}
                            </View>
                            <ThemedText style={styles.timestamp}>
                                {getRelativeTime(post.createdAt)}
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
                    voteAPI={resolvedVoteAPI}
                    onVote={(updatedOptions) => {
                        const updatedPost = { ...post, pollOptions: updatedOptions };
                        onUpdate?.(updatedPost);
                    }}
                />
            )}

            <View>
                {post.media && post.media.length > 0 ? (
                <View style={[styles.postMedia, { width: contentWidth, height: contentWidth }]}>
                    <FlatList
                        data={post.media}
                        renderItem={({ item, index }) => (
                            <View style={{ width: contentWidth, height: contentWidth }}>
                                {item.type === 'image' ? (
                                    <TouchableOpacity activeOpacity={0.8} onPress={() => handleMediaTap(item.url, item.type)}>
                                        <Image
 source={{ uri: getImageUrl(item.url) || '' }}
                                            style={styles.mediaFrame}
                                            resizeMode="cover"
                                            fadeDuration={0}
                                            progressiveRenderingEnabled={true}
                                        />

                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity activeOpacity={0.8} onPress={() => handleMediaTap(item.url, item.type)}>
                                        <InlineVideo
                                            uri={getImageUrl(item.url) || ''}
                                            shouldPlay={shouldPlay && activeImageIndex === index}
                                            style={styles.mediaFrame}
                                        />
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}
                        keyExtractor={(item, index) => `${post._id}-media-${index}`}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        onViewableItemsChanged={onViewableItemsChanged}
                        viewabilityConfig={viewabilityConfig}
                        style={{ width: contentWidth }}
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
                    <View style={[styles.postMedia, { width: contentWidth, height: contentWidth }]}>
                        <FlatList
                            data={post.images}
                            renderItem={({ item }) => (
                                <View style={{ width: contentWidth, height: contentWidth }}>
                                    <TouchableOpacity activeOpacity={0.8} onPress={() => handleMediaTap(item, 'image')}>
                                        <Image
source={{ uri: getImageUrl(item) }}
                                            style={styles.mediaFrame}
                                            resizeMode="cover"
                                            fadeDuration={0}
                                            progressiveRenderingEnabled={true}
                                        />

                                    </TouchableOpacity>
                                </View>
                            )}
                            keyExtractor={(item, index) => `${post._id}-img-${index}`}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            onViewableItemsChanged={onViewableItemsChanged}
                            viewabilityConfig={viewabilityConfig}
                        style={{ width: contentWidth }}
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
                    <TouchableOpacity activeOpacity={0.8} onPress={() => handleMediaTap(post.image || '', 'image')} style={{ width: contentWidth, height: contentWidth, borderRadius: borderRadius.lg, overflow: 'hidden' }}>
                        <Image
                            source={{ uri: getImageUrl(post.image || '') }}
                            style={styles.mediaFrame}
                            resizeMode="cover"
                            fadeDuration={0}
                            progressiveRenderingEnabled={true}
                        />
                    </TouchableOpacity>
                )                 : post.video ? (
                    <TouchableOpacity activeOpacity={0.8} onPress={() => handleMediaTap(post.video || '', 'video')} style={{ width: contentWidth, height: contentWidth, borderRadius: borderRadius.lg, overflow: 'hidden' }}>
                        <InlineVideo
                            uri={getImageUrl(post.video) || ''}
                            shouldPlay={shouldPlay}
                            style={styles.mediaFrame}
                        />
                    </TouchableOpacity>
                ) : null}
            </View>

            <View style={styles.actionBar}>
                <View style={styles.leftActions}>
                    <View style={styles.actionWithCount}>
                        <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={handleLikePress}
                        >
                            <IconSymbol name="heart.fill" size={24} color={isLiked ? errorColor : textColor} />
                        </TouchableOpacity>
                        {post.likes.length > 0 && (
                            <TouchableOpacity onPress={() => setLikesModalVisible(true)}>
                                <ThemedText style={[styles.actionCount, { color: textColor }]}>
                                    {post.likes.length.toLocaleString()}
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
                    {!communityId && (
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
                    )}
                </View>
                <TouchableOpacity style={styles.actionBtn} onPress={handleFavoritePress}>
                    <IconSymbol name={isFavorited ? "bookmark.fill" : "bookmark"} size={24} color={isFavorited ? primaryColor : textColor} />
                </TouchableOpacity>
            </View>

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
            />
            
            <CommentModal
                visible={commentsModalVisible}
                onClose={() => setCommentsModalVisible(false)}
                post={post}
                communityContext={communityId ? { communityId } : undefined}
            />

            <MediaPreviewModal
                visible={!!previewMedia}
                onClose={() => setPreviewMedia(null)}
                attachments={previewMedia?.attachments}
                initialIndex={previewMedia?.index ?? 0}
            />

        </ThemedView>
    );
});

FeedCard.displayName = 'FeedCard';
export default FeedCard;

const styles = StyleSheet.create({
    card: {
        padding: spacing.lg,
        marginBottom: spacing.md,
        borderRadius: borderRadius.xl,
        ...shadows.md,
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
    anonymousIndicator: {
        marginTop: 2,
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
        borderRadius: borderRadius.lg,
        overflow: 'hidden',
    },
    mediaFrame: {
        width: '100%',
        height: '100%',
        borderRadius: borderRadius.lg,
        backgroundColor: '#E0E0E0',
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
