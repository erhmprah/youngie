import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, View, FlatList, RefreshControl, TouchableOpacity, ActivityIndicator, Image, Alert, ViewToken } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { FeedCard } from '@/app/chat/FeedCard';
import { CreatePostModal } from '@/components/create-post-modal';
import { CreateStoryModal } from '@/components/create-story-modal';
import { StoryViewer } from '@/components/story-viewer';
import { CommentModal } from '@/components/comment-modal';
import { NotificationBell } from '@/components/notification-bell';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/contexts/AuthContext';
import { postAPI, storyAPI, getImageUrl } from '@/utils/api';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { spacing, borderRadius, typography, shadows } from '@/constants/design-tokens';
import { getSocket } from '@/utils/socket';

interface User {
    _id: string;
    username: string;
    avatar?: string;
    profilePhoto?: string;
}

interface Comment {
    _id: string;
    author: User;
    content: string;
    createdAt: string;
}

interface Post {
    _id: string;
    author: User;
    content?: string;
    images?: string[];
    video?: string;
    likes: { _id: string; username: string }[];
    comments: Comment[];
    createdAt: string;
    updatedAt: string;
    isAnonymous?: boolean;
    commentsDisabled?: boolean;
    pollOptions?: { text: string; votes: string[] }[];
}

interface Story {
    _id: string;
    author: User;
    content?: string;
    image?: string;
    video?: string;
    viewers: Array<{ user: User; viewedAt: string }>;
    createdAt: string;
    expiresAt: string;
    pollOptions?: { text: string; votes: string[] }[];
    reactions?: Array<{ user: User; type: string }>;
}

interface StoryGroup {
    user: User;
    stories: Story[];
    allViewed: boolean;
    isYourStory?: boolean;
}

export default function FeedScreen() {
    const { user, isSignedIn, logout } = useAuth();
    const router = useRouter();
    const { postId } = useLocalSearchParams();
    
    const [posts, setPosts] = useState<Post[]>([]);
    const [stories, setStories] = useState<StoryGroup[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [postsPage, setPostsPage] = useState(1);
    const [hasMorePosts, setHasMorePosts] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showCreateStoryModal, setShowCreateStoryModal] = useState(false);
    const [showStoryViewer, setShowStoryViewer] = useState(false);
    const [selectedStoryGroupIndex, setSelectedStoryGroupIndex] = useState(0);
    const [showCommentModal, setShowCommentModal] = useState(false);
    const [selectedPostForComments, setSelectedPostForComments] = useState<Post | null>(null);
    const [isIncognito, setIsIncognito] = useState(false);
    const [visiblePostId, setVisiblePostId] = useState<string | null>(null);
    const [playingPostId, setPlayingPostId] = useState<string | null>(null);
    
    const flatListRef = useRef<FlatList>(null);

    // Theme colors
    const backgroundColor = useThemeColor('background');
    const textColor = useThemeColor('text');
    const lightTextColor = useThemeColor('lightText');
    const primaryColor = useThemeColor('primary');
    const borderColor = useThemeColor('border');
    const white = useThemeColor('white');
    const surfaceColor = useThemeColor('surface');

    const fetchData = useCallback(async (page: number = 1) => {
        setError(null);
        const isLoadingMore = page > 1;
        if (isLoadingMore) {
            setLoadingMore(true);
        }
        try {
            const [postsResponse, storiesResponse] = await Promise.all([
                postAPI.getPosts(isIncognito, page, 20),
                page === 1 ? storyAPI.getStories() : Promise.resolve({ data: [] }),
            ]);
            const postsData = postsResponse.data.posts || postsResponse.data;
            const newPosts = (Array.isArray(postsData) ? postsData : []).filter((p: any) => p && p._id);
            if (page === 1) {
                setPosts(newPosts);
                setStories(storiesResponse.data.filter((s: any) => s && s.user && s.user._id));
            } else {
                setPosts(prev => [...prev, ...newPosts]);
            }
            setHasMorePosts(postsResponse.data.hasMore || (Array.isArray(postsData) && postsData.length === 20));
            setPostsPage(page);
        } catch (err: any) {
            console.error('Error fetching feed:', err);
            if (err.response?.status === 401) {
                try {
                    await logout();
                } catch (logoutErr) {
                    console.error('Error during logout:', logoutErr);
                }
                setError(null);
            } else {
                setError('Failed to load feed');
            }
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
            if (isLoadingMore) {
                setLoadingMore(false);
            }
        }
    }, [isIncognito]);

    const loadMorePosts = useCallback(() => {
        if (!loadingMore && hasMorePosts && isSignedIn) {
            fetchData(postsPage + 1);
        }
    }, [loadingMore, hasMorePosts, isSignedIn, fetchData, postsPage]);

    const fetchFeedIfLoggedIn = useCallback(async () => {
        if (isSignedIn) {
            await fetchData(1);
        } else {
            // Clear data when not logged in
            setPosts([]);
            setStories([]);
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [isSignedIn, fetchData]);

    useEffect(() => {
        fetchFeedIfLoggedIn();
    }, [fetchFeedIfLoggedIn]);

    // Listen for story updates via socket
    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;

        const handleStoryUpdate = (updatedStory: Story) => {
            setStories(prevStories =>
                prevStories.map(group => {
                    if (group.stories.some(s => s._id === updatedStory._id)) {
                        const updatedStories = group.stories.map(s => s._id === updatedStory._id ? updatedStory : s);
                        // Recalculate allViewed
                        const allViewed = updatedStories.every(story => {
                            const isAuthor = story.author._id === user?._id;
                            if (isAuthor) return true;
                            return story.viewers.some(viewer => viewer.user._id === user?._id);
                        });
                        return {
                            ...group,
                            stories: updatedStories,
                            allViewed
                        };
                    }
                    return group;
                })
            );
        };

        socket.on('story:updated', handleStoryUpdate);

        return () => {
            socket.off('story:updated', handleStoryUpdate);
        };
    }, [user?._id]);

    useEffect(() => {
        if (postId && posts.length > 0 && flatListRef.current) {
            const id = Array.isArray(postId) ? postId[0] : postId;
            const index = posts.findIndex(post => post._id === id);
            if (index !== -1) {
                setTimeout(() => {
                    flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0 });
                }, 500);
            }
        }
    }, [postId, posts]);

    useFocusEffect(
        useCallback(() => {
            return () => {
                setPlayingPostId(null);
            };
        }, [])
    );

    const onRefresh = () => {
        setIsRefreshing(true);
        fetchFeedIfLoggedIn();
    };

    const handleLikePost = async (postId: string) => {
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            const response = await postAPI.likePost(postId);
            const updatedPost = response?.data?.post ?? response?.data;
            setPosts(posts.map(p => (p._id === postId ? updatedPost : p)));
        } catch (error: any) {
            console.error('Error liking post:', error);
        }
    };

    const handleDeletePost = async (postId: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        try {
            await postAPI.deletePost(postId);
            setPosts(posts.filter(p => p._id !== postId));
        } catch (error: any) {
            console.error('Error deleting post:', error);
            Alert.alert('Error', 'Failed to delete post');
        }
    };

    const handleReportPost = async (postId: string) => {
        Alert.alert('Reported', 'Thank you for reporting this post.');
    };

    const handleUpdatePost = (updatedPost: Post) => {
        setPosts(posts.map(p => (p._id === updatedPost._id ? updatedPost : p)));
    };

    const handleStoryPress = (index: number) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelectedStoryGroupIndex(index);
        setShowStoryViewer(true);
    };

    const handleStoryViewed = (storyId: string) => {
        setStories(prevStories =>
            prevStories.map(group => {
                const storyIndex = group.stories.findIndex(s => s._id === storyId);
                if (storyIndex !== -1) {
                    const updatedStories = [...group.stories];
                    const story = updatedStories[storyIndex];
                    
                    const isAlreadyViewed = story.viewers?.some(v => v.user?._id === user?._id);

                    if (user && !isAlreadyViewed) {
                         updatedStories[storyIndex] = {
                            ...story,
                            viewers: [
                                ...(story.viewers || []),
                                { 
                                    user: { 
                                        _id: user._id, 
                                        username: user.username, 
                                        profilePhoto: user.profilePhoto,
                                        avatar: user.avatar 
                                    }, 
                                    viewedAt: new Date().toISOString() 
                                }
                            ]
                        };
                    }

                    const allViewed = updatedStories.every(s => {
                        if (s.author._id === user?._id) return true;
                        return s.viewers?.some(v => v.user?._id === user?._id);
                    });

                    return {
                        ...group,
                        stories: updatedStories,
                        allViewed
                    };
                }
                return group;
            })
        );
    };

    const viewabilityConfig = useRef({
        itemVisiblePercentThreshold: 50,
    }).current;

    const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
        if (viewableItems.length > 0) {
            setPlayingPostId(viewableItems[0].item._id);
        }
    }, []);

    const renderHeader = () => {
        let allStories = [...stories];
        const userGroupIndex = allStories.findIndex(group => group.user._id === user?._id);
        if (userGroupIndex !== -1) {
            allStories[userGroupIndex].isYourStory = true;
            allStories[userGroupIndex].user.username = 'Your Story';
        } else {
            const yourStoryItem: StoryGroup = {
                user: user ? { _id: user._id, username: 'Your Story', profilePhoto: user.profilePhoto } : { _id: '', username: 'Your Story' },
                stories: [],
                allViewed: true,
                isYourStory: true,
            };
            allStories.unshift(yourStoryItem);
        }

        const renderAvatar = (user: User) => (
            <View style={[styles.storyAvatarContainer, { backgroundColor: surfaceColor }]}>
                {user.profilePhoto ? (
                    <Image source={{ uri: getImageUrl(user.profilePhoto) }} style={styles.storyAvatar} />
                ) : (
                    <View style={[styles.storyAvatar, { backgroundColor: surfaceColor, justifyContent: 'center', alignItems: 'center' }]}>
                        <IconSymbol name="person.fill" size={30} color={lightTextColor} />
                    </View>
                )}
            </View>
        );

        return (
            <View style={[styles.storiesContainer, { borderBottomColor: borderColor }]}>
                <FlatList
                    data={allStories}
                    renderItem={({ item, index }) => {
                        if (item.isYourStory) {
                            if (item.stories.length > 0) {
                                // Render user's stories with add button
                                return (
                                    <View style={styles.storyItem}>
                                        <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); handleStoryPress(index); }}>
                                            <View style={[styles.storyRing, { borderColor: item.allViewed ? lightTextColor : primaryColor }]}>
                                                {renderAvatar(item.user)}
                                            </View>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={[styles.addStoryBadge, { backgroundColor: primaryColor, borderColor: backgroundColor }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowCreateStoryModal(true); }}>
                                            <IconSymbol name="plus" size={12} color={white} />
                                        </TouchableOpacity>
                                        <ThemedText style={styles.storyUsername} numberOfLines={1}>{item.user.username}</ThemedText>
                                    </View>
                                );
                            } else {
                                // Render create story button
                                return (
                                    <TouchableOpacity style={styles.storyItem} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowCreateStoryModal(true); }}>
                                        <View style={[styles.storyRing, { borderColor: 'transparent' }]}>
                                            {renderAvatar(item.user)}
                                            <View style={[styles.addStoryBadge, { backgroundColor: primaryColor, borderColor: backgroundColor }]}>
                                                <IconSymbol name="plus" size={12} color={white} />
                                            </View>
                                        </View>
                                        <ThemedText style={styles.storyUsername}>{item.user.username}</ThemedText>
                                    </TouchableOpacity>
                                );
                            }
                        } else {
                            // Render other users' stories
                            const isUnviewed = !item.allViewed;
                            return (
                                <TouchableOpacity style={styles.storyItem} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); handleStoryPress(index); }}>
                                    {isUnviewed ? (
                                        <LinearGradient
                                            colors={[primaryColor, '#d62976', '#fa7e1e']}
                                            start={{ x: 0, y: 1 }}
                                            end={{ x: 1, y: 0 }}
                                            style={[styles.storyRing, { borderWidth: 0, padding: 2.5 }]}
                                        >
                                            <View style={[styles.storyAvatarGap, { backgroundColor }]}>
                                                {renderAvatar(item.user)}
                                            </View>
                                        </LinearGradient>
                                    ) : (
                                        <View style={[styles.storyRing, { borderColor: lightTextColor }]}>
                                            {renderAvatar(item.user)}
                                        </View>
                                    )}
                                    <ThemedText style={styles.storyUsername} numberOfLines={1}>{item.user.username}</ThemedText>
                                </TouchableOpacity>
                            );
                        }
                    }}
                    keyExtractor={(item) => item.isYourStory ? 'your-story' : item.user._id}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                />
            </View>
        );
    };

    const renderPost = useCallback(({ item }: { item: Post }) => {
        const fullProfilePhoto = getImageUrl(item.author.profilePhoto);
        const postWithAvatar = {
            ...item,
            author: {
                ...item.author,
                profilePhoto: fullProfilePhoto,
                avatar: fullProfilePhoto || getImageUrl(item.author.avatar)
            }
        };
        return (
            <FeedCard
                post={postWithAvatar}
                currentUserId={user?._id || ''}
                onDelete={handleDeletePost}
                onReport={handleReportPost}
                onUpdate={handleUpdatePost}
                onLike={handleLikePost}
                onComment={(post) => { setSelectedPostForComments(post); setShowCommentModal(true); }}
                shouldPlay={item._id === playingPostId}
            />
        );
    }, [user?._id, handleDeletePost, handleReportPost, handleUpdatePost, handleLikePost, playingPostId]);

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor }}>
            <ThemedView style={styles.container}>
                <View style={[styles.appBar, { backgroundColor, borderBottomColor: borderColor }]}>
                    <ThemedText style={[styles.logo, { color: primaryColor }]}>Youngie</ThemedText>
                    <View style={styles.appBarIcons}>
                        <TouchableOpacity style={[styles.iconCircle, isIncognito && { backgroundColor: primaryColor }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setIsIncognito(!isIncognito); }}>
                            <Ionicons name="glasses" size={22} color={isIncognito ? white : textColor} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.iconCircle} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/explore'); }}>
                            <IconSymbol name="magnifyingglass" size={22} color={textColor} />
                        </TouchableOpacity>
                        <NotificationBell />
                    </View>
                </View>

                <FlatList
                    ref={flatListRef}
                    data={posts}
                    renderItem={renderPost}
                    keyExtractor={(item) => item._id}
                    ListHeaderComponent={renderHeader}
                    refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={primaryColor} />}
                    contentContainerStyle={{ paddingBottom: 80 }}
                    onScrollToIndexFailed={(info) => {
                        const wait = new Promise(resolve => setTimeout(resolve, 500));
                        wait.then(() => {
                            flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
                        });
                    }}
                    onEndReached={loadMorePosts}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color={primaryColor} style={{ marginVertical: 20 }} /> : null}
                    onViewableItemsChanged={onViewableItemsChanged}
                    viewabilityConfig={viewabilityConfig}
                />

                <TouchableOpacity
                    style={[styles.fab, { backgroundColor: primaryColor, shadowColor: primaryColor }]}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowCreateModal(true); }}
                >
                    <LinearGradient
                        colors={[primaryColor, useThemeColor('primaryDark')]}
                        style={styles.fabGradient}
                    >
                        <IconSymbol name="plus" size={32} color={white} />
                    </LinearGradient>
                </TouchableOpacity>
                
                <CreatePostModal visible={showCreateModal} onClose={() => setShowCreateModal(false)} onPost={fetchFeedIfLoggedIn} initialAnonymous={isIncognito} />
                <CreateStoryModal visible={showCreateStoryModal} onClose={() => setShowCreateStoryModal(false)} onCreate={fetchFeedIfLoggedIn} />
                <StoryViewer visible={showStoryViewer} onClose={() => setShowStoryViewer(false)} storyGroups={stories} initialGroupIndex={selectedStoryGroupIndex} onStoryDeleted={fetchFeedIfLoggedIn} onStoryViewed={handleStoryViewed} />
                <CommentModal visible={showCommentModal} onClose={() => setShowCommentModal(false)} post={selectedPostForComments} initialAnonymous={isIncognito} />
            </ThemedView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    appBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
    },
    logo: {
        fontSize: typography.sizes.heading1,
        fontFamily: typography.families.bold,
    },
    appBarIcons: {
        flexDirection: 'row',
        gap: spacing.md,
        alignItems: 'center',
    },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: borderRadius.round,
        justifyContent: 'center',
        alignItems: 'center',
    },
    storiesContainer: {
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        borderBottomWidth: 1,
        marginBottom: spacing.sm,
    },
    storyItem: {
        alignItems: 'center',
        marginRight: spacing.lg,
        width: 70,
    },
    storyRing: {
        width: 68,
        height: 68,
        borderRadius: 34,
        borderWidth: 2,
        padding: 2,
        marginBottom: spacing.xs,
        justifyContent: 'center',
        alignItems: 'center',
    },
    storyAvatarGap: {
        flex: 1,
        width: '100%',
        borderRadius: 32,
        padding: 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    storyAvatarContainer: {
        width: '100%',
        height: '100%',
        borderRadius: 30,
        overflow: 'hidden',
    },
    storyAvatar: {
        width: '100%',
        height: '100%',
    },
    storyUsername: {
        fontSize: typography.sizes.caption,
        textAlign: 'center',
    },
    addStoryBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1,
    },
    fab: {
        position: 'absolute',
        bottom: spacing.xl,
        right: spacing.xl,
        width: 56,
        height: 56,
        borderRadius: 28,
        ...shadows.lg,
    },
    fabGradient: {
        width: '100%',
        height: '100%',
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
