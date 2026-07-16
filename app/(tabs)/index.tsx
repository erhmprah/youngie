import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { StyleSheet, View, FlatList, RefreshControl, TouchableOpacity, ActivityIndicator, Image, Alert, ViewToken, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { FeedCard } from '@/app/chat/FeedCard.component';
import { CreatePostModal } from '@/components/create-post-modal';
import { CreateStoryModal } from '@/components/create-story-modal';
import { StoryViewer } from '@/components/story-viewer';
import { CommentModal } from '@/components/comment-modal';
import { NotificationBell } from '@/components/notification-bell';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/contexts/AuthContext';
import { postAPI, storyAPI, communityAPI, getImageUrl } from '@/utils/api';
import { cachedPostAPI, cachedStoryAPI } from '@/utils/cachedApi';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SkeletonCard } from '@/components/ui/skeleton';
import { spacing, borderRadius, typography, shadows } from '@/constants/design-tokens';
import { getSocket, onPostUpdated, offPostUpdated, onPostCreated, offPostCreated } from '@/utils/socket';
import { getRelativeTime } from '@/utils/helpers';

interface User {
    _id: string;
    id: string;
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
    isFavorited?: boolean;
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

interface CommunityFeedPost {
    _id: string;
    community: { _id: string; name: string; image?: string; isAnonymous?: boolean };
    author: { _id: string; username: string; avatar?: string; profilePhoto?: string };
    content?: string;
    images?: string[];
    likes: Array<{ _id: string }>;
    comments?: Array<{ _id: string; author?: { _id: string; username: string }; content?: string; createdAt?: string }>;
    isFavorited?: boolean;
    createdAt: string;
}

export default function FeedScreen() {
    const { user, isSignedIn, logout, isLoading: authLoading } = useAuth();
    const router = useRouter();
    const { postId, focus } = useLocalSearchParams();
    
    const [posts, setPosts] = useState<Post[]>([]);
    const [stories, setStories] = useState<StoryGroup[]>([]);
    const [communityPosts, setCommunityPosts] = useState<CommunityFeedPost[]>([]);
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
    const [showCommunityCommentModal, setShowCommunityCommentModal] = useState(false);
    const [selectedCommunityPostForComments, setSelectedCommunityPostForComments] = useState<CommunityFeedPost | null>(null);
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

    const fetchData = useCallback(async (page: number = 1, forceRefresh: boolean = false) => {
        setError(null);
        const isLoadingMore = page > 1;
        if (isLoadingMore) {
            setLoadingMore(true);
        }
        try {
            const [postsResponse, storiesResponse, communityFeedResponse] = await Promise.all([
                cachedPostAPI.getPosts(isIncognito, page, 20, forceRefresh),
                page === 1 ? cachedStoryAPI.getStories(user?._id, forceRefresh) : Promise.resolve({ data: [] }),
                page === 1 ? communityAPI.getJoinedFeed(1, 20) : Promise.resolve({ data: { data: [] } }),
            ]);
            const postsData = postsResponse.data.posts || postsResponse.data;
            const newPosts = (Array.isArray(postsData) ? postsData : []).filter((p: any) => p && p._id);
            if (page === 1) {
                setPosts(newPosts);
                // Calculate allViewed for each story group
                const storiesWithAllViewed = storiesResponse.data
                    .filter((s: any) => s && s.user && s.user._id)
                    .map((group: any) => ({
                        ...group,
                        allViewed: group.stories.every((story: any) => {
                            if (story.author._id === user?._id) return true;
                            return story.viewers?.some((viewer: any) => viewer.user?._id === user?._id);
                        })
                    }));
                setStories(storiesWithAllViewed);

                // Recent feed posts from communities the user has joined
                const communityFeedData: CommunityFeedPost[] =
                    communityFeedResponse.data?.data || communityFeedResponse.data || [];
                const filteredCommunityPosts = (Array.isArray(communityFeedData) ? communityFeedData : []).filter(
                    (p: any) => p && p._id && p.community
                );
                if (isIncognito) {
                    const masked = filteredCommunityPosts
                        .filter((p: any) => p.community && p.community.isAnonymous)
                        .map((p: CommunityFeedPost) => {
                            const maskedPost: CommunityFeedPost = {
                                ...p,
                                author: { _id: 'anonymous', username: 'Anonymous', avatar: undefined, profilePhoto: undefined },
                                likes: (p.likes || []).map(() => ({ _id: 'anonymous' })),
                                comments: (p.comments || []).map((c: any) => ({
                                    ...c,
                                    author: { _id: 'anonymous', username: 'Anonymous' },
                                })),
                            };
                            return maskedPost;
                        });
                    setCommunityPosts(masked);
                } else {
                    setCommunityPosts(filteredCommunityPosts);
                }
            } else {
                setPosts(prev => [...prev, ...newPosts]);
            }
            setHasMorePosts(postsResponse.data.hasMore || (Array.isArray(postsData) && postsData.length === 20));
            setPostsPage(page);
        } catch (err: any) {
            if (err.response?.status === 401) {
                try {
                    await logout();
                } catch (logoutErr) {
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

    const fetchFeedIfLoggedIn = useCallback(async (forceRefresh: boolean = false) => {
        console.log('fetchFeedIfLoggedIn called:', { authLoading, isSignedIn, userId: user?._id });
        // Wait for auth to finish loading before fetching
        if (authLoading) {
            console.log('Auth loading, skipping fetch');
            return;
        }
        if (isSignedIn) {
            console.log('User signed in, fetching data');
            await fetchData(1, forceRefresh);
        } else {
            console.log('User not signed in, clearing data');
            // Clear data when not logged in
            setPosts([]);
            setStories([]);
            setCommunityPosts([]);
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [isSignedIn, fetchData, authLoading, user]);

    useEffect(() => {
        console.log('Feed useEffect triggered', { isSignedIn, authLoading });
        fetchFeedIfLoggedIn();
    }, [fetchFeedIfLoggedIn, authLoading, isSignedIn]);

    // Listen for post updates via socket (likes, comments, reactions, edits)
    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;

        const handlePostUpdated = (updatedPost: any) => {
            if (!updatedPost || !updatedPost._id) return;
            setPosts(prevPosts => {
                const exists = prevPosts.some(p => p._id === updatedPost._id);
                if (!exists) return prevPosts;
                return prevPosts.map(p =>
                    p._id === updatedPost._id
                        ? { ...updatedPost, isFavorited: p.isFavorited }
                        : p
                );
            });
        };

        const handlePostCreated = (newPost: any) => {
            if (!newPost || !newPost._id || !user) return;
            setPosts(prevPosts => {
                if (prevPosts.some(p => p._id === newPost._id)) return prevPosts;
                const isSelf = newPost.author?._id === user._id;
                const isKnownAuthor = prevPosts.some(p => p.author?._id === newPost.author?._id);
                // Only inject posts that belong in this user's feed (self or an author they already follow)
                if (!isSelf && !isKnownAuthor) return prevPosts;
                return [newPost, ...prevPosts];
            });
        };

        onPostUpdated(handlePostUpdated);
        onPostCreated(handlePostCreated);

        return () => {
            offPostUpdated();
            offPostCreated();
        };
    }, [user?._id]);

    // Listen for story updates via socket
    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;

        const handleStoryUpdate = (updatedStory: Story) => {
            setStories(prevStories => {
                const existingGroupIndex = prevStories.findIndex(group => 
                    group.stories.some(s => s._id === updatedStory._id)
                );
                
                if (existingGroupIndex !== -1) {
                    const updatedStories = prevStories[existingGroupIndex].stories.map(s => 
                        s._id === updatedStory._id ? updatedStory : s
                    );
                    const allViewed = updatedStories.every((story: any) => {
                        const isAuthor = story.author._id === user?._id;
                        if (isAuthor) return true;
                        return story.viewers?.some((viewer: any) => viewer.user?._id === user?._id);
                    });
                    const newGroups = [...prevStories];
                    newGroups[existingGroupIndex] = {
                        ...prevStories[existingGroupIndex],
                        stories: updatedStories,
                        allViewed
                    };
                    return newGroups;
                }
                
                return prevStories;
            });
        };

        socket.on('story:updated', handleStoryUpdate);

        return () => {
            socket.off('story:updated', handleStoryUpdate);
        };
    }, [user?._id]);

    useEffect(() => {
        if (postId && posts.length > 0 && flatListRef.current) {
            const id = Array.isArray(postId) ? postId[0] : postId;
            const focusValue = Array.isArray(focus) ? focus[0] : focus;
            const index = posts.findIndex(post => post._id === id);
            if (index !== -1) {
                setTimeout(() => {
                    flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0 });
                    // Open the comments section when arriving from a comment notification
                    if (focusValue === 'comments') {
                        setSelectedPostForComments(posts[index]);
                        setShowCommentModal(true);
                    }
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
        fetchFeedIfLoggedIn(true);
    };

    const handleLikePost = async (postId: string) => {
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            const response = await postAPI.likePost(postId);
            const updatedPost = response?.data?.post ?? response?.data;
            setPosts(posts.map(p => (p._id === postId ? updatedPost : p)));
        } catch (error: any) {
        }
    };

    const handleDeletePost = async (postId: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        try {
            await postAPI.deletePost(postId);
            setPosts(posts.filter(p => p._id !== postId));
        } catch (error: any) {
            Alert.alert('Error', 'Failed to delete post');
        }
    };

    const handleReportPost = async (postId: string) => {
        try {
            await postAPI.reportPost(postId);
        } catch (error) {
            Alert.alert('Error', 'Failed to report post');
            throw error;
        }
    };

    const handleUpdatePost = (updatedPost: Post) => {
        setPosts(posts.map(p => (p._id === updatedPost._id ? updatedPost : p)));
    };

    const handleStoryPress = (userId: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const actualIndex = stories.findIndex(s => s.user._id === userId);
        setSelectedStoryGroupIndex(actualIndex >= 0 ? actualIndex : 0);
        setShowStoryViewer(true);
    };

    const handleStoryViewed = (storyId: string) => {
        setStories(prevStories =>
            prevStories.map(group => {
                const storyIndex = group.stories.findIndex(s => s._id === storyId);
                if (storyIndex !== -1) {
                    const updatedStories = [...group.stories];
                    const story = updatedStories[storyIndex];
                    
                    // Check if current user is the author - don't count author's view
                    const isAuthor = story.author?._id === user?._id || story.author?._id === user?.id;
                    
                    // Only update the story to mark it as viewed if not the author
                    if (user && !isAuthor) {
                        const isAlreadyViewed = story.viewers?.some(v => v.user?._id === user?._id);
                        if (!isAlreadyViewed) {
                            updatedStories[storyIndex] = {
                                ...story,
                                viewers: [
                                    ...(story.viewers || []),
                                    { 
                                        user: { 
                                            _id: user._id, 
                                            id: user.id || user._id,
                                            username: user.username, 
                                            profilePhoto: user.profilePhoto,
                                            avatar: user.avatar 
                                        }, 
                                        viewedAt: new Date().toISOString() 
                                    }
                                ]
                            };
                        }
                    }

                    // Recalculate allViewed for the entire group
                    const allViewed = updatedStories.every(s => {
                        const storyAuthorId = s.author?._id || s.author?._id;
                        if (storyAuthorId === user?._id || storyAuthorId === user?.id) return true;
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
            const visibleItem = viewableItems[0].item;
            if (visibleItem.kind === 'post') {
                setPlayingPostId(visibleItem.data._id);
            }
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
                user: user ? { _id: user._id, id: user.id || user._id, username: 'Your Story', profilePhoto: user.profilePhoto } : { _id: '', id: '', username: 'Your Story' },
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
            <View style={[styles.storiesContainer, { backgroundColor: surfaceColor, borderColor }]}>
                <FlatList
                    data={allStories}
                    renderItem={({ item, index }) => {
                        if (item.isYourStory) {
                            if (item.stories.length > 0) {
                                // Render user's stories with add button
                                return (
                                    <View style={styles.storyItem}>
                                        <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); handleStoryPress(item.user._id); }}>
                                            <View style={[styles.storyRing, { borderColor: item.allViewed ? lightTextColor : primaryColor }]}>
                                                {renderAvatar(item.user)}
                                            </View>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={[styles.addStoryBadge, { backgroundColor: primaryColor, borderColor: backgroundColor }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowCreateStoryModal(true); }}>
                                            <IconSymbol name="plus" size={10} color={white} />
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
                                                <IconSymbol name="plus" size={10} color={white} />
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
                                <TouchableOpacity style={styles.storyItem} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); handleStoryPress(item.user._id); }}>
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

    const CommunityPostCard = ({ item }: { item: CommunityFeedPost }) => {
        const [liked, setLiked] = useState(
            (item.likes || []).some((l: any) => String(l?._id || l) === String(user?._id))
        );
        const [likeCount, setLikeCount] = useState((item.likes || []).length);
        const [favorited, setFavorited] = useState(!!item.isFavorited);

        const handleCommunityLike = async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            const optimisticLiked = !liked;
            setLiked(optimisticLiked);
            setLikeCount((c) => c + (optimisticLiked ? 1 : -1));
            try {
                await communityAPI.likeFeed(item.community._id, item._id);
            } catch (error) {
                setLiked(!optimisticLiked);
                setLikeCount((c) => c + (optimisticLiked ? -1 : 1));
            }
        };

        const handleCommunityFavorite = async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            const optimisticFav = !favorited;
            setFavorited(optimisticFav);
            try {
                if (optimisticFav) {
                    await communityAPI.favoriteFeed(item.community._id, item._id);
                } else {
                    await communityAPI.unfavoriteFeed(item.community._id, item._id);
                }
            } catch (error) {
                setFavorited(!optimisticFav);
            }
        };

        const openComments = () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setSelectedCommunityPostForComments(item);
            setShowCommunityCommentModal(true);
        };

        return (
            <View style={[styles.communityPostCard, { backgroundColor: surfaceColor, borderColor }]}>
                <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/community/${item.community._id}`); }}
                >
                    <View style={styles.communityPostBadge}>
                        {item.community.image ? (
                            <Image source={{ uri: getImageUrl(item.community.image) }} style={styles.communityPostBadgeImage} />
                        ) : (
                            <View style={[styles.communityPostBadgeImage, styles.communityImagePlaceholder, { backgroundColor: primaryColor + '20' }]}>
                                <IconSymbol name="person.3.fill" size={14} color={primaryColor} />
                            </View>
                        )}
                        <ThemedText style={[styles.communityPostBadgeText, { color: primaryColor }]} numberOfLines={1}>
                            {item.community.name}
                        </ThemedText>
                        <IconSymbol name="chevron.right" size={14} color={primaryColor} style={{ marginLeft: 'auto' }} />
                    </View>

                    <View style={styles.communityPostHeader}>
                        {item.author.profilePhoto || item.author.avatar ? (
                            <Image source={{ uri: getImageUrl(item.author.profilePhoto || item.author.avatar) }} style={styles.communityPostAvatar} />
                        ) : (
                            <View style={[styles.communityPostAvatar, styles.communityImagePlaceholder, { backgroundColor: surfaceColor }]}>
                                <IconSymbol name="person.fill" size={14} color={lightTextColor} />
                            </View>
                        )}
                        <View style={{ flex: 1 }}>
                            <ThemedText style={styles.communityPostAuthor} numberOfLines={1}>{item.author.username}</ThemedText>
                            <ThemedText style={[styles.communityPostTime, { color: lightTextColor }]}>{getRelativeTime(item.createdAt)}</ThemedText>
                        </View>
                    </View>

                    {item.content ? (
                        <ThemedText style={[styles.communityPostContent, { color: textColor }]}>
                            {item.content}
                        </ThemedText>
                    ) : null}

                    {item.images && item.images.length > 0 && (
                        <Image source={{ uri: getImageUrl(item.images[0]) }} style={styles.communityPostImage} />
                    )}
                </TouchableOpacity>

                <View style={styles.communityPostActionBar}>
                    <View style={styles.communityPostLeftActions}>
                        <TouchableOpacity style={styles.communityPostAction} onPress={handleCommunityLike}>
                            <IconSymbol name="heart.fill" size={22} color={liked ? '#FF3B30' : lightTextColor} />
                            <ThemedText style={[styles.communityPostActionText, { color: liked ? '#FF3B30' : lightTextColor }]}>
                                {likeCount}
                            </ThemedText>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.communityPostAction} onPress={openComments}>
                            <IconSymbol name="message.fill" size={22} color={lightTextColor} />
                            <ThemedText style={[styles.communityPostActionText, { color: lightTextColor }]}>
                                {item.comments?.length || 0}
                            </ThemedText>
                        </TouchableOpacity>
                    </View>
                    <TouchableOpacity style={styles.communityPostAction} onPress={handleCommunityFavorite}>
                        <IconSymbol name={favorited ? "bookmark.fill" : "bookmark"} size={22} color={favorited ? primaryColor : lightTextColor} />
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    const renderHeaderContent = () => (
        <>
            {renderHeader()}
        </>
    );

    // Merge personal posts and community feed posts into a single chronological feed.
    // Community posts only come from page 1, so when loading more we keep them at the top.
    const feedItems = useMemo(() => {
        const merged: Array<{ kind: 'post'; data: Post } | { kind: 'community'; data: CommunityFeedPost }> = [];
        communityPosts.forEach((p) => merged.push({ kind: 'community', data: p }));
        posts.forEach((p) => merged.push({ kind: 'post', data: p }));
        merged.sort((a, b) => {
            const ta = new Date(a.kind === 'post' ? a.data.createdAt : a.data.createdAt).getTime();
            const tb = new Date(b.kind === 'post' ? b.data.createdAt : b.data.createdAt).getTime();
            return tb - ta;
        });
        return merged;
    }, [posts, communityPosts]);

    const renderFeedItem = useCallback(({ item }: { item: { kind: 'post'; data: Post } | { kind: 'community'; data: CommunityFeedPost } }) => {
        if (item.kind === 'community') {
            return <CommunityPostCard item={item.data} />;
        }
        const fullProfilePhoto = getImageUrl(item.data.author.profilePhoto);
        const postWithAvatar = {
            ...item.data,
            author: {
                ...item.data.author,
                profilePhoto: fullProfilePhoto,
                avatar: fullProfilePhoto || getImageUrl(item.data.author.avatar)
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
                shouldPlay={item.data._id === playingPostId}
            />
        );
    }, [user?._id, handleDeletePost, handleReportPost, handleUpdatePost, handleLikePost, playingPostId]);

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor }}>
            <ThemedView style={styles.container}>
                <View style={[styles.appBar, { backgroundColor, borderBottomColor: borderColor, shadowColor: backgroundColor }, shadows.sm]}>
                    <View style={styles.logoWrap}>
                        <LinearGradient
                            colors={[primaryColor, '#d62976', '#fa7e1e']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.logoMark}
                        />
                        <ThemedText style={[styles.logo, { color: textColor }]}>Youngie</ThemedText>
                    </View>
                    <View style={styles.appBarIcons}>
                        <TouchableOpacity style={[styles.iconCircle, isIncognito && { backgroundColor: primaryColor }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setIsIncognito(!isIncognito); }}>
                            <Ionicons name="glasses" size={20} color={isIncognito ? white : textColor} />
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.iconCircle, { backgroundColor: surfaceColor }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/explore'); }}>
                            <IconSymbol name="magnifyingglass" size={20} color={textColor} />
                        </TouchableOpacity>
                        <View style={[styles.iconCircle, { backgroundColor: surfaceColor }]}>
                            <NotificationBell />
                        </View>
                    </View>
                </View>

                <FlatList
                    ref={flatListRef}
                    data={feedItems}
                    renderItem={renderFeedItem}
                    keyExtractor={(item) => item.kind === 'post' ? item.data._id : 'c_' + item.data._id}
                    ListHeaderComponent={renderHeaderContent}
                    refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={primaryColor} />}
                    contentContainerStyle={{ paddingBottom: 80, paddingHorizontal: spacing.lg }}
                    initialNumToRender={3}
                    maxToRenderPerBatch={2}
                    windowSize={31}
                    updateCellsBatchingPeriod={50}
                    onScrollToIndexFailed={(info) => {
                        const wait = new Promise(resolve => setTimeout(resolve, 500));
                        wait.then(() => {
                            flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
                        });
                    }}
                    onEndReached={loadMorePosts}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={
                        isLoading ? (
                            <View style={{ paddingVertical: 20 }}>
                                <SkeletonCard />
                                <SkeletonCard />
                            </View>
                        ) : loadingMore ? (
                            <ActivityIndicator size="small" color={primaryColor} style={{ marginVertical: 20 }} />
                        ) : null
                    }
                    onViewableItemsChanged={onViewableItemsChanged}
                    viewabilityConfig={viewabilityConfig}
                    ListEmptyComponent={
                        isLoading ? (
                            <View style={{ paddingHorizontal: spacing.lg, paddingTop: 20 }}>
                                <SkeletonCard />
                                <SkeletonCard />
                                <SkeletonCard />
                            </View>
                        ) : null
                    }
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
                <StoryViewer 
                    visible={showStoryViewer} 
                    onClose={() => setShowStoryViewer(false)} 
                    storyGroups={stories} 
                    initialGroupIndex={selectedStoryGroupIndex} 
                    onStoryDeleted={() => {
                        // Remove the deleted story from local state immediately
                        setStories(prevStories => {
                            return prevStories.map(group => {
                                // Filter out any stories that might have been deleted locally
                                // The fetchFeedIfLoggedIn will refresh from backend
                                return group;
                            });
                        });
                        fetchFeedIfLoggedIn(true);
                    }} 
                    onStoryViewed={handleStoryViewed} 
                />
                <CommentModal visible={showCommentModal} onClose={() => setShowCommentModal(false)} post={selectedPostForComments} initialAnonymous={isIncognito} />
                <CommentModal
                    visible={showCommunityCommentModal}
                    onClose={() => setShowCommunityCommentModal(false)}
                    post={selectedCommunityPostForComments as any}
                    communityContext={selectedCommunityPostForComments ? { communityId: selectedCommunityPostForComments.community._id } : undefined}
                />
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
        zIndex: 10,
    },
    logoWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    logoMark: {
        width: 26,
        height: 26,
        borderRadius: 9,
    },
    logo: {
        fontSize: typography.sizes.title + 4,
        fontFamily: typography.families.bold,
        letterSpacing: 0.3,
    },
    appBarIcons: {
        flexDirection: 'row',
        gap: spacing.sm,
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
        marginVertical: spacing.sm,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        ...shadows.sm,
    },
    storyItem: {
        alignItems: 'center',
        marginRight: spacing.sm,
        width: 64,
    },
    storyRing: {
        width: 56,
        height: 56,
        borderRadius: 28,
        borderWidth: 2,
        padding: 2,
        marginBottom: 4,
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
        fontSize: 9,
        textAlign: 'center',
    },
    addStoryBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1,
    },
    communityImagePlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    communityPostCard: {
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        padding: spacing.md,
        marginBottom: spacing.md,
        ...shadows.sm,
    },
    communityPostBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.sm,
        gap: spacing.xs,
    },
    communityPostBadgeImage: {
        width: 20,
        height: 20,
        borderRadius: borderRadius.sm,
    },
    communityPostBadgeText: {
        flex: 1,
        fontSize: typography.sizes.caption,
        fontFamily: typography.families.bold,
    },
    communityPostHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.sm,
        gap: spacing.sm,
    },
    communityPostAvatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
    },
    communityPostAuthor: {
        fontSize: typography.sizes.body2,
        fontFamily: typography.families.bold,
    },
    communityPostTime: {
        fontSize: typography.sizes.caption,
    },
    communityPostContent: {
        fontSize: typography.sizes.body2,
        marginBottom: spacing.sm,
    },
    communityPostImage: {
        width: '100%',
        height: 120,
        borderRadius: borderRadius.md,
        marginBottom: spacing.sm,
    },
    communityPostActionBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: spacing.sm,
        marginTop: spacing.xs,
        borderTopWidth: 1,
        borderTopColor: '#E0E0E0',
    },
    communityPostLeftActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xl,
    },
    communityPostAction: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    communityPostActionText: {
        fontSize: typography.sizes.body2,
        fontFamily: typography.families.medium,
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
