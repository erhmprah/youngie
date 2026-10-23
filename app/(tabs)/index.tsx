import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { StyleSheet, View, FlatList, RefreshControl, TouchableOpacity, ActivityIndicator, Image, Alert, ViewToken } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { VideoView, useVideoPlayer, type VideoTrack } from 'expo-video';

import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { FeedCard } from '@/app/chat/FeedCard.component';
import { CreatePostModal } from '@/components/create-post-modal';
import { CreateStoryModal } from '@/components/create-story-modal';
import { StoryViewer } from '@/components/story-viewer';
import { CommentModal } from '@/components/comment-modal';
import { NotificationBell } from '@/components/notification-bell';
import AdBanner from '@/components/ads/AdBanner';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/contexts/AuthContext';
import { useIncognito } from '@/contexts/IncognitoContext';
import { postAPI, communityAPI, getImageUrl } from '@/utils/api';
import { serverText } from '@/utils/error-messages';
import { cachedPostAPI, cachedStoryAPI } from '@/utils/cachedApi';
import { cacheService } from '@/utils/cache';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SkeletonCard } from '@/components/ui/skeleton';
import { spacing, borderRadius, typography, shadows, sizes } from '@/constants/design-tokens';
import { getSocket, onPostUpdated, offPostUpdated, onPostCreated, offPostCreated, onPostDeleted, offPostDeleted } from '@/utils/socket';
import { getRelativeTime } from '@/utils/helpers';

// Feed ad cadence. The first ad appears after AD_FIRST_INDEX posts, then every
// AD_INTERVAL items. AdMob counts every banner impression against your
// account, so keep this conservative rather than aggressive.
const AD_FIRST_INDEX = 4;
const AD_INTERVAL = 6;

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
    videoWidth?: number;
    videoHeight?: number;
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
    viewers: { user: User; viewedAt: string }[];
    createdAt: string;
    expiresAt: string;
    pollOptions?: { text: string; votes: string[] }[];
    reactions?: { user: User; type: string }[];
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
    video?: string;
    videoWidth?: number;
    videoHeight?: number;
    likes: { _id: string }[];
    comments?: { _id: string; author?: { _id: string; username: string }; content?: string; createdAt?: string }[];
    isFavorited?: boolean;
    isMember?: boolean;
    isAdmin?: boolean;
    createdAt: string;
}

function getCommunityMediaAspectRatio(width: number, height: number) {
    if (!width || !height) return 1;
    return width / height;
}

function CommunityFeedImage({ uri }: { uri: string | undefined }) {
    const [aspectRatio, setAspectRatio] = useState(1);

    const handleImageLoad = useCallback((event: { nativeEvent: { source: { width: number; height: number } } }) => {
        const { width: imageWidth, height: imageHeight } = event.nativeEvent.source;
        if (!imageWidth || !imageHeight) return;

        setAspectRatio(getCommunityMediaAspectRatio(imageWidth, imageHeight));
    }, []);

    return (
        <View style={[styles.communityPostImageFrame, { aspectRatio }]}>
            <Image
                source={{ uri: uri || '' }}
                style={styles.communityPostImage}
                resizeMode="cover"
                onLoad={handleImageLoad}
            />
        </View>
    );
}

function CommunityFeedVideo({ uri, shouldPlay, videoWidth, videoHeight }: { uri: string | undefined; shouldPlay: boolean; videoWidth?: number; videoHeight?: number }) {
    const player = useVideoPlayer(uri ? { uri } : null, (videoPlayer) => {
        videoPlayer.loop = true;
        videoPlayer.muted = true;
    });
    const [aspectRatio, setAspectRatio] = useState(() => videoWidth && videoHeight
        ? getCommunityMediaAspectRatio(videoWidth, videoHeight)
        : getCommunityMediaAspectRatio(player.videoTrack?.size.width || 0, player.videoTrack?.size.height || 0));

    const reportTrackSize = useCallback((track: VideoTrack | null) => {
        if (!track?.size.width || !track.size.height) return;
        setAspectRatio(getCommunityMediaAspectRatio(track.size.width, track.size.height));
    }, [videoWidth, videoHeight]);

    useEffect(() => {
        const subscription = player.addListener('videoTrackChange', ({ videoTrack }) => {
            reportTrackSize(videoTrack);
        });
        const sourceSubscription = player.addListener('sourceLoad', ({ availableVideoTracks }) => {
            reportTrackSize(player.videoTrack ?? availableVideoTracks[0] ?? null);
        });
        const initialTrackFrame = requestAnimationFrame(() => {
            reportTrackSize(player.videoTrack ?? player.availableVideoTracks[0] ?? null);
        });
        return () => {
            cancelAnimationFrame(initialTrackFrame);
            subscription.remove();
            sourceSubscription.remove();
        };
    }, [player, reportTrackSize]);

    useEffect(() => {
        if (shouldPlay) {
            player.replay();
            player.play();
        } else {
            player.pause();
        }
    }, [player, shouldPlay]);

    if (!uri) return null;

    return (
        <View style={[styles.communityPostImageFrame, { aspectRatio }]}>
            <VideoView
                player={player}
                style={styles.communityPostImage}
                contentFit="contain"
                nativeControls={false}
                pointerEvents="none"
            />
        </View>
    );
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
    const [, setError] = useState<string | null>(null);
    const [recommendedPosts, setRecommendedPosts] = useState<Post[]>([]);
    const [loadingRecommended, setLoadingRecommended] = useState(false);
    
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showCreateStoryModal, setShowCreateStoryModal] = useState(false);
    const [showStoryViewer, setShowStoryViewer] = useState(false);
    const [selectedStoryGroupIndex, setSelectedStoryGroupIndex] = useState(0);
    // The user whose stories were tapped. Preferred over the index because the
    // tray re-sorts seen users to the back, which would invalidate an index.
    const [selectedStoryUserId, setSelectedStoryUserId] = useState<string | null>(null);
    const [showCommentModal, setShowCommentModal] = useState(false);
    const [selectedPostForComments, setSelectedPostForComments] = useState<Post | null>(null);
    const [showCommunityCommentModal, setShowCommunityCommentModal] = useState(false);
    const [selectedCommunityPostForComments, setSelectedCommunityPostForComments] = useState<CommunityFeedPost | null>(null);
    const { isIncognito, toggleIncognito, setIncognito } = useIncognito();
    const [playingPostId, setPlayingPostId] = useState<string | null>(null);
    
    const flatListRef = useRef<FlatList>(null);
    const feedRequestVersionRef = useRef(0);
    const feedRequestIdRef = useRef(0);
    const activeLoadMoreRequestRef = useRef(0);
    const loadingMoreRef = useRef(false);
    const firstPageLoadingRef = useRef(false);
    const refreshingRef = useRef(false);
    const postsPageRef = useRef(1);

    // Theme colors
    const backgroundColor = useThemeColor('background');
    const textColor = useThemeColor('text');
    const lightTextColor = useThemeColor('lightText');
    const primaryColor = useThemeColor('primary');
    const borderColor = useThemeColor('border');
    const white = useThemeColor('white');
    const surfaceColor = useThemeColor('surface');

    const fetchData = useCallback(async (page: number = 1, forceRefresh: boolean = false) => {
        const isLoadingMore = page > 1;
        if (isLoadingMore && (loadingMoreRef.current || firstPageLoadingRef.current || refreshingRef.current)) {
            return;
        }

        if (isLoadingMore) {
            loadingMoreRef.current = true;
            setLoadingMore(true);
        } else {
            // A fresh page-one request supersedes any outstanding pagination
            // response so old data cannot append into the refreshed feed.
            feedRequestVersionRef.current += 1;
            loadingMoreRef.current = false;
            activeLoadMoreRequestRef.current = 0;
            firstPageLoadingRef.current = true;
            refreshingRef.current = forceRefresh;
            postsPageRef.current = 1;
            setLoadingMore(false);
        }
        const requestVersion = feedRequestVersionRef.current;
        const requestId = ++feedRequestIdRef.current;
        if (isLoadingMore) activeLoadMoreRequestRef.current = requestId;

        setError(null);
        try {
            const [feedResponse, storiesResponse] = await Promise.all([
                page > 1
                    ? cachedPostAPI.getCandidateFeed(page, false, isIncognito, user?._id)
                    : cachedPostAPI.getCandidateFeed(1, forceRefresh, isIncognito, user?._id),
                page === 1 ? cachedStoryAPI.getStories(user?._id, forceRefresh) : Promise.resolve({ data: [] }),
            ]);

            if (requestVersion !== feedRequestVersionRef.current) return;

            const candidateItems = (feedResponse.data || []).filter((p: any) => p && p._id);

            const newPosts: Post[] = [];
            const newCommunityPosts: CommunityFeedPost[] = [];

            for (const item of candidateItems) {
                // Personal posts have no `community` field, so its presence is a
                // reliable fallback when the server-side source marker is absent
                // (e.g. an older cached candidate-feed payload).
                if (item._candidateSource === 'community' || item._isCommunityFeed || item.community) {
                    const communityPost: CommunityFeedPost = {
                        _id: item._id,
                        community: item.community || { _id: '', name: '', image: undefined, isAnonymous: false },
                        author: {
                            _id: item.author?._id || '',
                            username: item.author?.username || 'Unknown',
                            avatar: item.author?.avatar || item.author?.profilePhoto,
                            profilePhoto: item.author?.profilePhoto || item.author?.avatar,
                        },
                        content: item.content,
                        images: item.images,
                        video: item.video,
                        videoWidth: item.videoWidth,
                        videoHeight: item.videoHeight,
                        likes: item.likes || [],
                        comments: item.comments || [],
                        isFavorited: item.isFavorited,
                        isMember: item.isCommunityMember !== false,
                        isAdmin: !!item.isCommunityAdmin,
                        createdAt: item.createdAt,
                    };
                    newCommunityPosts.push(communityPost);
                } else {
                    const post: Post = {
                        ...item,
                        author: {
                            _id: item.author?._id || '',
                            username: item.author?.username || 'Unknown',
                            avatar: item.author?.avatar || item.author?.profilePhoto,
                            profilePhoto: item.author?.profilePhoto || item.author?.avatar,
                        },
                    };
                    newPosts.push(post);
                }
            }

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

                const filteredCommunityPosts = newCommunityPosts;
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

                if (newPosts.length === 0 && newCommunityPosts.length === 0 && !isIncognito) {
                    setLoadingRecommended(true);
                    try {
                        const trendingResponse = await postAPI.getTrendingPosts();
                        const trendingPosts = trendingResponse.data.data || [];
                        setRecommendedPosts(trendingPosts);
                    } catch {
                        try {
                            const suggestedResponse = await cachedPostAPI.getSuggestedRandomPosts();
                            const suggestedPosts = suggestedResponse.data || [];
                            setRecommendedPosts(suggestedPosts);
                        } catch {
                            setRecommendedPosts([]);
                        }
                    } finally {
                        setLoadingRecommended(false);
                    }
                } else {
                    setRecommendedPosts([]);
                }
            } else {
                setPosts(prev => [...prev, ...newPosts]);
                setCommunityPosts(prev => [...prev, ...newCommunityPosts]);
            }
            setHasMorePosts(feedResponse.pagination?.hasNextPage ?? candidateItems.length === 20);
            setPostsPage(page);
            postsPageRef.current = page;
        } catch (err: any) {
            if (requestVersion !== feedRequestVersionRef.current) return;
            if (err.response?.status === 401) {
                try {
                    await logout();
                } catch {
                }
                setError(null);
            } else {
                setError('Failed to load feed');
            }
        } finally {
            if (requestVersion === feedRequestVersionRef.current) {
                setIsLoading(false);
                setIsRefreshing(false);
                firstPageLoadingRef.current = false;
                refreshingRef.current = false;
                if (!isLoadingMore) loadingMoreRef.current = false;
            }
            if (isLoadingMore && activeLoadMoreRequestRef.current === requestId) {
                activeLoadMoreRequestRef.current = 0;
                loadingMoreRef.current = false;
                setLoadingMore(false);
            }
        }
    }, [isIncognito, user, logout]);

    const loadMorePosts = useCallback(() => {
        if (!loadingMore && !loadingMoreRef.current && !firstPageLoadingRef.current && !refreshingRef.current && hasMorePosts && isSignedIn) {
            fetchData(postsPageRef.current + 1);
        }
    }, [loadingMore, hasMorePosts, isSignedIn, fetchData]);

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
            feedRequestVersionRef.current += 1;
            loadingMoreRef.current = false;
            firstPageLoadingRef.current = false;
            refreshingRef.current = false;
            activeLoadMoreRequestRef.current = 0;
            postsPageRef.current = 1;
            // Clear data when not logged in
            setPosts([]);
            setStories([]);
            setCommunityPosts([]);
            setRecommendedPosts([]);
            setHasMorePosts(false);
            setPostsPage(1);
            setLoadingMore(false);
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [isSignedIn, fetchData, authLoading, user]);

    useEffect(() => {
        console.log('Feed useEffect triggered', { isSignedIn, authLoading });
        // Feed refresh intentionally synchronizes with authentication state.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchFeedIfLoggedIn();
    }, [fetchFeedIfLoggedIn, authLoading, isSignedIn]);

    // Listen for post updates via socket (likes, comments, reactions, edits)
    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;

        const handlePostUpdated = (updatedPost: any) => {
            if (!updatedPost || !updatedPost._id) return;
            cacheService.invalidateByPrefix('candidate_feed_');
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
            if (isIncognito && !newPost.isAnonymous) return;
            const isSelf = newPost.author?._id === user._id;
            // Other users' real-time posts are eligible for injection only if
            // public. Private feed membership is resolved by the API, not by
            // whether the author happens to have another visible post.
            if (!isSelf && newPost.isPublic !== true) return;
            cacheService.invalidateByPrefix('candidate_feed_');
            setPosts(prevPosts => {
                if (prevPosts.some(p => p._id === newPost._id)) return prevPosts;
                return [newPost, ...prevPosts];
            });
        };

        const handlePostDeleted = (postId: string) => {
            if (!postId) return;
            cacheService.invalidateByPrefix('candidate_feed_');
            setPosts(prevPosts => prevPosts.filter(p => p._id !== postId));
        };

        onPostUpdated(handlePostUpdated);
        onPostCreated(handlePostCreated);
        onPostDeleted(handlePostDeleted);

        return () => {
            offPostUpdated();
            offPostCreated();
            offPostDeleted();
        };
    }, [user?._id, user, isIncognito]);

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
        if (posts.length > 0) {
            // Recommendations are intentionally cleared once feed posts arrive.
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setRecommendedPosts([]);
        }
    }, [posts.length]);

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
    }, [postId, focus, posts]);

    useFocusEffect(
        useCallback(() => {
            setIncognito(false);
        }, [setIncognito])
    );

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
        } catch {
        }
    };

    const handleDeletePost = async (postId: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        try {
            const target = posts.find(p => p._id === postId);
            // Route through the cached API so feed, profile grid and post count
            // caches are dropped together with the delete.
            await cachedPostAPI.deletePost(postId, target?.author?._id || target?.author?.id);
            setPosts(posts.filter(p => p._id !== postId));
        } catch {
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
        const actualIndex = stories.findIndex(s => s.user?._id === userId);
        setSelectedStoryGroupIndex(actualIndex >= 0 ? actualIndex : 0);
        setSelectedStoryUserId(userId);
        setShowStoryViewer(true);
    };

    const handleStoryViewed = (storyId: string) => {
        setStories(prevStories => {
            const groupIndex = prevStories.findIndex(group =>
                group.stories.some(s => s._id === storyId)
            );
            if (groupIndex === -1) return prevStories;

            const group = prevStories[groupIndex];
            const updatedStories = [...group.stories];
            const story = updatedStories[group.stories.findIndex(s => s._id === storyId)];

            // Check if current user is the author - don't count author's view
            const isAuthor = story.author?._id === user?._id || story.author?._id === user?.id;

            // Only update the story to mark it as viewed if not the author
            if (user && !isAuthor) {
                const isAlreadyViewed = story.viewers?.some(v => v.user?._id === user?._id);
                if (!isAlreadyViewed) {
                    updatedStories[group.stories.findIndex(s => s._id === storyId)] = {
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
                const storyAuthorId = s.author?._id;
                if (storyAuthorId === user?._id || storyAuthorId === user?.id) return true;
                return s.viewers?.some(v => v.user?._id === user?._id);
            });

            const updatedGroup = { ...group, stories: updatedStories, allViewed };

            const next = [...prevStories];
            next[groupIndex] = updatedGroup;

            // Once every story from a user has been seen, that user's ring moves
            // to the end of the tray. The current user's own group is exempt:
            // its stories always count as viewed, so it would otherwise be
            // shuffled to the back on every single view.
            const isOwnGroup = group.user?._id === user?._id || group.user?._id === user?.id;
            if (allViewed && !isOwnGroup && !group.allViewed && groupIndex < next.length - 1) {
                next.splice(groupIndex, 1);
                next.push(updatedGroup);
            }

            return next;
        });
    };

    const viewabilityConfig = {
        itemVisiblePercentThreshold: 50,
    };

    const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
        const visibleVideoItem = viewableItems.find(({ item }) =>
            item.kind === 'community'
                ? !!item.data.video
                : item.kind === 'post' && !!item.data.video
        )?.item;

        if (!visibleVideoItem) {
            setPlayingPostId(null);
            return;
        }

        const prefix = visibleVideoItem.kind === 'community' ? 'community' : 'post';
        setPlayingPostId(`${prefix}:${visibleVideoItem.data._id}`);
    }, []);

    const renderHeader = () => {
        // Copy each group before relabelling it: mutating the state objects here
        // would also rewrite the username the viewer renders for that user.
        let allStories = stories.map(group => ({
            ...group,
            user: { ...group.user },
        }));
        const userGroupIndex = allStories.findIndex(group => group.user?._id === user?._id);
        if (userGroupIndex !== -1) {
            const [yourGroup] = allStories.splice(userGroupIndex, 1);
            yourGroup.isYourStory = true;
            yourGroup.user.username = 'Your Story';
            // Your own story always leads the tray, whatever order the API
            // returned it in and wherever the seen-story re-sort moved it.
            allStories.unshift(yourGroup);
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
                                    <View style={styles.storyAvatarWrap}>
                                        <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); handleStoryPress(item.user?._id || ''); }}>
                                            <View style={[styles.storyRing, { borderColor: item.allViewed ? lightTextColor : primaryColor }]}>
                                                {renderAvatar(item.user || { _id: '', id: '', username: 'Your Story' })}
                                            </View>
                                        </TouchableOpacity>
                                            <View style={[styles.addStoryBadge, { backgroundColor: primaryColor, borderColor: backgroundColor }]}>
                                                <TouchableOpacity
                                                    style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}
                                                    hitSlop={4}
                                                    onPress={(e) => {
                                                        e.stopPropagation();
                                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                        setShowCreateStoryModal(true);
                                                    }}
                                                >
                                                    <IconSymbol name="plus" size={sizes.iconSmall} color={white} />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                        <ThemedText style={styles.storyUsername} numberOfLines={1}>{item.user?.username || 'Your Story'}</ThemedText>
                                    </View>
                                );
                            } else {
                                // Render create story button
                                return (
                                    <TouchableOpacity style={styles.storyItem} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowCreateStoryModal(true); }}>
                                        <View style={styles.storyAvatarWrap}>
                                            <View style={[styles.storyRing, { borderColor: 'transparent' }]}>
                                                {renderAvatar(item.user || { _id: '', id: '', username: 'Your Story' })}
                                            </View>
                                            <View style={[styles.addStoryBadge, { backgroundColor: primaryColor, borderColor: backgroundColor }]}>
                                                <TouchableOpacity
                                                    style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}
                                                    hitSlop={4}
                                                    onPress={(e) => {
                                                        e.stopPropagation();
                                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                        setShowCreateStoryModal(true);
                                                    }}
                                                >
                                                    <IconSymbol name="plus" size={sizes.iconSmall} color={white} />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                        <ThemedText style={styles.storyUsername}>{item.user?.username || 'Your Story'}</ThemedText>
                                    </TouchableOpacity>
                                );
                            }
                        } else {
                            // Render other users' stories
                            const isUnviewed = !item.allViewed;
                            return (
                                <TouchableOpacity style={styles.storyItem} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); handleStoryPress(item.user?._id || ''); }}>
                                    {isUnviewed ? (
                                        <LinearGradient
                                            colors={[primaryColor, '#d62976', '#fa7e1e']}
                                            start={{ x: 0, y: 1 }}
                                            end={{ x: 1, y: 0 }}
                                            style={[styles.storyRing, { borderWidth: 0, padding: spacing.xxs }]}
                                        >
                                            <View style={[styles.storyAvatarGap, { backgroundColor }]}>
                                                {renderAvatar(item.user || { _id: '', id: '', username: 'User' })}
                                            </View>
                                        </LinearGradient>
                                    ) : (
                                        <View style={[styles.storyRing, { borderColor: lightTextColor }]}>
                                            {renderAvatar(item.user || { _id: '', id: '', username: 'User' })}
                                        </View>
                                    )}
                                    <ThemedText style={styles.storyUsername} numberOfLines={1}>{item.user?.username || 'User'}</ThemedText>
                                </TouchableOpacity>
                            );
                        }
                    }}
                    keyExtractor={(item) => item.isYourStory ? 'your-story' : (item.user?._id || Math.random().toString())}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                />
            </View>
        );
    };

    const joinCommunity = async (communityId: string, communityName: string) => {
        const name = communityName || 'this community';
        try {
            const response = await communityAPI.join(communityId);
            const message = response?.data?.msg || '';
            if (message.toLowerCase().includes('approval') || message.toLowerCase().includes('pending')) {
                Alert.alert('Request sent', `Your request to join ${name} is awaiting approval.`);
                return;
            }
            setCommunityPosts(prev => prev.map(p => (
                p.community?._id === communityId ? { ...p, isMember: true } : p
            )));
            // Membership changed, so the cached candidate feed is stale.
            cacheService.invalidateByPrefix('candidate_feed');
            Alert.alert('Joined', `You joined ${name}. You can now like, comment and save its posts.`);
        } catch (err: any) {
            Alert.alert('Could not join', serverText(err?.response?.data, `Failed to join ${name}.`));
        }
    };

    const promptToJoin = (communityId: string, communityName: string) => {
        const name = communityName || 'this community';
        Alert.alert(
            'Members only',
            `Join ${name} to like, comment on and save its posts.`,
            [
                { text: 'Not now', style: 'cancel' },
                { text: 'View community', onPress: () => router.push(`/community/${communityId}`) },
                { text: 'Join', onPress: () => joinCommunity(communityId, name) },
            ]
        );
    };

    const CommunityPostCard = ({ item }: { item: CommunityFeedPost }) => {
        const isMember = item.isMember !== false;
        const liked = (item.likes || []).some((l: any) => String(l?._id || l) === String(user?._id));
        const likeCount = (item.likes || []).length;
        const favorited = !!item.isFavorited;
        const commentCount = item.comments?.length || 0;
        const communityId = item.community._id;
        const communityName = item.community.name;

        const patchCommunityPost = (postId: string, patch: Partial<CommunityFeedPost>) => {
            setCommunityPosts(prev => prev.map(p => (p._id === postId ? { ...p, ...patch } : p)));
        };

        const handleCommunityLike = async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            if (!isMember) {
                promptToJoin(communityId, communityName);
                return;
            }
            const previousLikes = item.likes || [];
            const optimisticLiked = !liked;
            patchCommunityPost(item._id, {
                likes: optimisticLiked
                    ? [...previousLikes, { _id: String(user?._id || 'me') }]
                    : previousLikes.filter((l: any) => String(l?._id || l) !== String(user?._id)),
            });
            try {
                await communityAPI.likeFeed(communityId, item._id);
            } catch (err: any) {
                patchCommunityPost(item._id, { likes: previousLikes });
                if (err?.response?.status === 403) {
                    patchCommunityPost(item._id, { isMember: false });
                    promptToJoin(communityId, communityName);
                } else {
                    Alert.alert('Error', serverText(err?.response?.data, 'Failed to like this post. Please try again.'));
                }
            }
        };

        const handleCommunityFavorite = async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            if (!isMember) {
                promptToJoin(communityId, communityName);
                return;
            }
            const optimisticFav = !favorited;
            patchCommunityPost(item._id, { isFavorited: optimisticFav });
            try {
                if (optimisticFav) {
                    await communityAPI.favoriteFeed(communityId, item._id);
                } else {
                    await communityAPI.unfavoriteFeed(communityId, item._id);
                }
            } catch (err: any) {
                patchCommunityPost(item._id, { isFavorited: !optimisticFav });
                if (err?.response?.status === 403) {
                    patchCommunityPost(item._id, { isMember: false });
                    promptToJoin(communityId, communityName);
                } else {
                    Alert.alert('Error', serverText(err?.response?.data, 'Failed to save this post. Please try again.'));
                }
            }
        };

        const openComments = () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setSelectedCommunityPostForComments(item);
            setShowCommunityCommentModal(true);
        };

        return (
            <View style={[styles.communityPostFeed, { borderBottomColor: borderColor }]}>
                <TouchableOpacity
                    activeOpacity={0.9}
                    style={styles.communityPostHeader}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/community/${item.community._id}`); }}
                >
                    {item.community.image ? (
                        <Image source={{ uri: getImageUrl(item.community.image) }} style={styles.communityPostAvatar} />
                    ) : (
                        <View style={[styles.communityPostAvatar, styles.communityImagePlaceholder, { backgroundColor: primaryColor + '20' }]}>
                            <IconSymbol name="person.3.fill" size={16} color={primaryColor} />
                        </View>
                    )}
                    <View style={styles.communityPostHeaderText}>
                        <ThemedText style={[styles.communityPostName, { color: textColor }]} numberOfLines={1}>
                            {item.community.name || 'Community'}
                        </ThemedText>
                        <View style={styles.communityPostAuthorRow}>
                            {item.author.profilePhoto || item.author.avatar ? (
                                <Image source={{ uri: getImageUrl(item.author.profilePhoto || item.author.avatar) }} style={styles.communityPostAuthorAvatar} />
                            ) : (
                                <View style={[styles.communityPostAuthorAvatar, styles.communityImagePlaceholder, { backgroundColor: surfaceColor }]}>
                                    <IconSymbol name="person.fill" size={9} color={lightTextColor} />
                                </View>
                            )}
                            <ThemedText style={[styles.communityPostAuthor, { color: lightTextColor }]} numberOfLines={1}>
                                Posted by {item.author.username} · {getRelativeTime(item.createdAt)}
                            </ThemedText>
                        </View>
                    </View>
                    <IconSymbol name="chevron.right" size={16} color={lightTextColor} />
                </TouchableOpacity>

                <TouchableOpacity
                    activeOpacity={0.9}
                    style={styles.communityPostBody}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/community/${item.community._id}`); }}
                >
                    {item.content ? (
                        <ThemedText style={[styles.communityPostContent, { color: textColor }]}>
                            {item.content}
                        </ThemedText>
                    ) : null}

                    {item.images && item.images.length > 0 && (
                        <CommunityFeedImage uri={getImageUrl(item.images[0])} />
                    )}
                    {item.video && (
                        <CommunityFeedVideo
                            uri={getImageUrl(item.video)}
                            shouldPlay={playingPostId === `community:${item._id}`}
                            videoWidth={item.videoWidth}
                            videoHeight={item.videoHeight}
                        />
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
                                {commentCount}
                            </ThemedText>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.communityPostRightActions}>
                        {!isMember && (
                            <TouchableOpacity
                                style={[styles.communityJoinPill, { backgroundColor: primaryColor }]}
                                onPress={() => joinCommunity(communityId, communityName)}
                            >
                                <IconSymbol name="person.badge.plus" size={14} color={white} />
                                <ThemedText style={styles.communityJoinPillText}>Join</ThemedText>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity style={styles.communityPostAction} onPress={handleCommunityFavorite}>
                            <IconSymbol name={favorited ? "bookmark.fill" : "bookmark"} size={22} color={favorited ? primaryColor : lightTextColor} />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    };

    const renderHeaderContent = () => (
        <>
            {isIncognito && (
                <View style={[styles.anonBanner, { backgroundColor: primaryColor }]}>
                    <Ionicons name="glasses" size={16} color={white} />
                    <ThemedText style={[styles.anonBannerText, { color: white }]}>Anonymous Feed</ThemedText>
                </View>
            )}
            {renderHeader()}
        </>
    );

    // Merge personal posts and community feed posts into a single chronological feed.
    // Community posts only come from page 1, so when loading more we keep them at the top.
    const feedItems = useMemo(() => {
        const hasPersonalPosts = posts.length > 0;
        const merged: any[] = [];
        
        communityPosts.forEach((p) => merged.push({ kind: 'community', data: p }));
        posts.forEach((p) => merged.push({ kind: 'post', data: p }));
        
        if (merged.length > 0) {
            merged.sort((a, b) => {
                const ta = new Date(a.kind === 'post' ? a.data.createdAt : a.data.createdAt).getTime();
                const tb = new Date(b.kind === 'post' ? b.data.createdAt : b.data.createdAt).getTime();
                return tb - ta;
            });
        }

        // Interleave banner ads into the feed rather than stacking them at the
        // bottom. A single trailing banner is easy to scroll past forever;
        // spacing them through the feed is the pattern that actually gets
        // viewed. Ads are only injected into the user's own feed — never into
        // the "recommended" fallback, where an unlabeled ad between strangers'
        // posts reads as user-generated content.
        if (merged.length > 0) {
            const withAds: any[] = [];
            merged.forEach((item, index) => {
                withAds.push(item);
                const isAdSlot = index >= AD_FIRST_INDEX && (index - AD_FIRST_INDEX) % AD_INTERVAL === AD_INTERVAL - 1;
                if (isAdSlot) withAds.push({ kind: 'ad', slot: index });
            });
            merged.splice(0, merged.length, ...withAds);
        }
        
        if (!hasPersonalPosts && recommendedPosts.length > 0) {
            merged.push({ kind: 'recommended-header' });
            recommendedPosts.forEach((p) => merged.push({ kind: 'post', data: p, isRecommended: true }));
        }
        
        return merged;
    }, [posts, communityPosts, recommendedPosts]);

    const renderFeedItem = ({ item }: { item: any }) => {
        if (item.kind === 'ad') {
            return <AdBanner style={styles.adSlot} />;
        }

        if (item.kind === 'recommended-header') {
            return (
                <View style={[styles.recommendedCard, { backgroundColor: surfaceColor, borderColor, shadowColor: backgroundColor }, shadows.sm]}>
                    <View style={styles.recommendedIconWrap}>
                        <LinearGradient
                            colors={[primaryColor, '#fa7e1e']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.recommendedIconBadge}
                        >
                            <Ionicons name="flame" size={18} color={white} />
                        </LinearGradient>
                    </View>
                    <View style={{ flex: 1 }}>
                        <ThemedText style={[styles.recommendedTitle, { color: textColor }]}>
                            Recommended for you
                        </ThemedText>
                        <ThemedText style={[styles.recommendedSubtitle, { color: lightTextColor }]}>
                            Popular posts you might like
                        </ThemedText>
                    </View>
                    <View style={[styles.recommendedPill, { backgroundColor: primaryColor + '18', borderColor: primaryColor + '40' }]}>
                        <Ionicons name="trending-up" size={14} color={primaryColor} />
                        <ThemedText style={[styles.recommendedPillText, { color: primaryColor }]}>Trending</ThemedText>
                    </View>
                </View>
            );
        }
        if (item.kind === 'community') {
            return <CommunityPostCard item={item.data} />;
        }
        const fullProfilePhoto = getImageUrl(item.data.author?.profilePhoto);
        const postWithAvatar = {
            ...item.data,
            author: {
                ...(item.data.author || {}),
                _id: item.data.author?._id || '',
                username: item.data.author?.username || 'Unknown',
                profilePhoto: fullProfilePhoto,
                avatar: fullProfilePhoto || getImageUrl(item.data.author?.avatar)
            }
        };
        return (
            <FeedCard
                post={postWithAvatar}
                presentation="feed"
                currentUserId={user?._id || ''}
                onDelete={handleDeletePost}
                onReport={handleReportPost}
                onUpdate={handleUpdatePost}
                onLike={handleLikePost}
                onComment={(post) => { setSelectedPostForComments(post); setShowCommentModal(true); }}
                shouldPlay={playingPostId === `post:${item.data._id}`}
            />
        );
    };

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
                        <TouchableOpacity style={[styles.iconCircle, isIncognito && { backgroundColor: primaryColor }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); toggleIncognito(); }}>
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
                    keyExtractor={(item, index) => item.kind === 'post' ? item.data._id : item.kind === 'community' ? 'c_' + item.data._id : item.kind === 'ad' ? 'ad_' + index : 'recommended-header'}
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
                        ) : loadingMore || loadingRecommended ? (
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
                    initialUserId={selectedStoryUserId} 
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
                    initialAnonymous={isIncognito}
                    canInteract={selectedCommunityPostForComments?.isMember !== false}
                    onJoinPress={() => {
                        const target = selectedCommunityPostForComments;
                        if (target) joinCommunity(target.community._id, target.community.name);
                    }}
                    onMembershipLost={() => {
                        const target = selectedCommunityPostForComments;
                        if (target) {
                            setCommunityPosts(prev => prev.map(p => (
                                p.community?._id === target.community._id ? { ...p, isMember: false } : p
                            )));
                        }
                    }}
                    onCommentsChange={(updatedComments) => {
                        if (!selectedCommunityPostForComments) return;
                        const targetId = selectedCommunityPostForComments._id;
                        setCommunityPosts(prev => prev.map(p => (
                            p._id === targetId
                                ? { ...p, comments: updatedComments as any }
                                : p
                        )));
                    }}
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
        width: sizes.iconSmall,
        height: sizes.iconSmall,
        borderRadius: sizes.borderRadiusSm,
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
        width: sizes.iconLarge,
        height: sizes.iconLarge,
        borderRadius: borderRadius.round,
        justifyContent: 'center',
        alignItems: 'center',
    },
    storiesContainer: {
        marginVertical: spacing.sm,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.xl,
        borderWidth: sizes.dividerWidth,
        ...shadows.sm,
    },
    storyItem: {
        alignItems: 'center',
        marginRight: spacing.sm,
        width: sizes.storyRing,
    },
    storyAvatarWrap: {
        position: 'relative',
        width: sizes.storyRing,
        height: sizes.storyRing,
        marginBottom: spacing.xs,
        alignItems: 'center',
        justifyContent: 'center',
    },
    storyRing: {
        width: sizes.storyRing,
        height: sizes.storyRing,
        borderRadius: sizes.storyRing / 2,
        borderWidth: sizes.borderWidth,
        padding: spacing.xxs,
        marginBottom: spacing.xs,
        justifyContent: 'center',
        alignItems: 'center',
    },
    storyAvatarGap: {
        flex: 1,
        width: '100%',
        borderRadius: sizes.storyRing / 2 - 4,
        padding: spacing.xxs,
        justifyContent: 'center',
        alignItems: 'center',
    },
    storyAvatarContainer: {
        width: '100%',
        height: '100%',
        borderRadius: sizes.storyRing / 2 - 5,
        overflow: 'hidden',
    },
    storyAvatar: {
        width: '100%',
        height: '100%',
    },
    storyUsername: {
        fontSize: typography.sizes.tiny,
        textAlign: 'center',
    },
    addStoryBadge: {
        position: 'absolute',
        bottom: spacing.xxs,
        right: spacing.xxs,
        width: sizes.storyBadge,
        height: sizes.storyBadge,
        borderRadius: sizes.storyBadge / 2,
        borderWidth: sizes.borderWidth,
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
        borderWidth: sizes.dividerWidth,
        padding: spacing.md,
        marginBottom: spacing.md,
        ...shadows.sm,
    },
    communityPostFeed: {
        width: '100%',
        paddingVertical: spacing.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    communityPostHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.sm,
        gap: spacing.sm,
    },
    communityPostBody: {
        width: '100%',
    },
    communityPostHeaderText: {
        flex: 1,
    },
    communityPostName: {
        fontSize: typography.sizes.body2,
        fontFamily: typography.families.bold,
    },
    communityPostAuthorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xxs,
        marginTop: 2,
    },
    communityPostAvatar: {
        width: sizes.iconSmall + 4,
        height: sizes.iconSmall + 4,
        borderRadius: (sizes.iconSmall + 4) / 2,
    },
    communityPostAuthorAvatar: {
        width: sizes.iconSmall - 4,
        height: sizes.iconSmall - 4,
        borderRadius: (sizes.iconSmall - 4) / 2,
    },
    communityPostAuthor: {
        flexShrink: 1,
        fontSize: typography.sizes.caption,
    },
    communityPostTime: {
        fontSize: typography.sizes.caption,
    },
    communityPostContent: {
        fontSize: typography.sizes.body2,
        marginBottom: spacing.sm,
    },
    communityPostImageFrame: {
        width: '100%',
        marginBottom: spacing.sm,
        overflow: 'hidden',
    },
    communityPostImage: {
        width: '100%',
        height: '100%',
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
    communityPostRightActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    communityJoinPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xxs,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xxs,
        borderRadius: borderRadius.full,
    },
    communityJoinPillText: {
        fontSize: typography.sizes.caption,
        fontFamily: typography.families.bold,
        color: '#FFFFFF',
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
    adSlot: {
        marginVertical: spacing.md,
    },
    recommendedCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        marginTop: spacing.md,
        marginBottom: spacing.sm,
        borderRadius: borderRadius.xl,
        borderWidth: sizes.dividerWidth,
    },
    recommendedIconWrap: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    recommendedIconBadge: {
        width: sizes.iconLarge,
        height: sizes.iconLarge,
        borderRadius: borderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
    },
    recommendedTitle: {
        fontSize: typography.sizes.title,
        fontFamily: typography.families.bold,
        letterSpacing: 0.2,
    },
    recommendedSubtitle: {
        fontSize: typography.sizes.caption,
        marginTop: spacing.xxs,
    },
    recommendedPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xxs,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xxs,
        borderRadius: borderRadius.lg,
        borderWidth: sizes.dividerWidth,
    },
    recommendedPillText: {
        fontSize: typography.sizes.tiny,
        fontFamily: typography.families.bold,
        letterSpacing: 0.3,
    },
    fab: {
        position: 'absolute',
        bottom: spacing.xl,
        right: spacing.xl,
        width: sizes.iconLarge + 16,
        height: sizes.iconLarge + 16,
        borderRadius: (sizes.iconLarge + 16) / 2,
        ...shadows.lg,
    },
    fabGradient: {
        width: '100%',
        height: '100%',
        borderRadius: (sizes.iconLarge + 16) / 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    anonBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.lg,
        marginBottom: spacing.sm,
    },
    anonBannerText: {
        fontSize: typography.sizes.caption,
        fontFamily: typography.families.bold,
        letterSpacing: 0.3,
    },
});
