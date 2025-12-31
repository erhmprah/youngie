import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, View, FlatList, RefreshControl, TouchableOpacity, ActivityIndicator, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

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
    image?: string;
    video?: string;
    likes: { _id: string; username: string }[];
    comments: Comment[];
    createdAt: string;
    updatedAt: string;
    isAnonymous?: boolean;
    commentsDisabled?: boolean;
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
}

interface StoryGroup {
    user: User;
    stories: Story[];
    allViewed: boolean;
}

export default function FeedScreen() {
    const { user } = useAuth();
    const router = useRouter();
    const { postId } = useLocalSearchParams();
    
    const [posts, setPosts] = useState<Post[]>([]);
    const [stories, setStories] = useState<StoryGroup[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showCreateStoryModal, setShowCreateStoryModal] = useState(false);
    const [showStoryViewer, setShowStoryViewer] = useState(false);
    const [selectedStoryGroupIndex, setSelectedStoryGroupIndex] = useState(0);
    const [showCommentModal, setShowCommentModal] = useState(false);
    const [selectedPostForComments, setSelectedPostForComments] = useState<Post | null>(null);
    const [isIncognito, setIsIncognito] = useState(false);
    
    const flatListRef = useRef<FlatList>(null);

    // Theme colors
    const backgroundColor = useThemeColor('background');
    const textColor = useThemeColor('text');
    const lightTextColor = useThemeColor('lightText');
    const primaryColor = useThemeColor('primary');
    const borderColor = useThemeColor('border');
    const white = useThemeColor('white');
    const surfaceColor = useThemeColor('surface');

    const fetchData = useCallback(async () => {
        setError(null);
        try {
            const [postsResponse, storiesResponse] = await Promise.all([
                postAPI.getPosts(isIncognito),
                storyAPI.getStories(),
            ]);
            setPosts(postsResponse.data.filter((p: any) => p && p._id));
            setStories(storiesResponse.data.filter((s: any) => s && s.user && s.user._id));
        } catch (err) {
            console.error('Error fetching feed:', err);
            setError('Failed to load feed');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [isIncognito]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

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

    const onRefresh = () => {
        setIsRefreshing(true);
        fetchData();
    };

    const handleLikePost = async (postId: string) => {
        try {
            const response = await postAPI.likePost(postId);
            const updatedPost = response?.data?.post ?? response?.data;
            setPosts(posts.map(p => (p._id === postId ? updatedPost : p)));
        } catch (error: any) {
            console.error('Error liking post:', error);
        }
    };

    const handleDeletePost = async (postId: string) => {
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
        setSelectedStoryGroupIndex(index);
        setShowStoryViewer(true);
    };

    const renderStoryItem = ({ item, index }: { item: StoryGroup; index: number }) => (
        <TouchableOpacity style={styles.storyItem} onPress={() => handleStoryPress(index)}>
            <View style={[styles.storyRing, { borderColor: item.allViewed ? lightTextColor : primaryColor }]}>
                {item.user.profilePhoto ? (
                    <Image source={{ uri: getImageUrl(item.user.profilePhoto) }} style={styles.storyAvatar} />
                ) : (
                    <View style={[styles.storyAvatar, { backgroundColor: surfaceColor, justifyContent: 'center', alignItems: 'center' }]}>
                        <IconSymbol name="person.fill" size={30} color={lightTextColor} />
                    </View>
                )}
            </View>
            <ThemedText style={styles.storyUsername} numberOfLines={1}>{item.user.username}</ThemedText>
        </TouchableOpacity>
    );

    const renderHeader = () => (
        <View style={[styles.storiesContainer, { borderBottomColor: borderColor }]}>
            <TouchableOpacity style={styles.storyItem} onPress={() => setShowCreateStoryModal(true)}>
                <View style={[styles.storyRing, { borderColor: 'transparent' }]}>
                    {user?.profilePhoto ? (
                        <Image source={{ uri: getImageUrl(user.profilePhoto) }} style={styles.storyAvatar} />
                    ) : (
                        <View style={[styles.storyAvatar, { backgroundColor: surfaceColor, justifyContent: 'center', alignItems: 'center' }]}>
                            <IconSymbol name="person.fill" size={30} color={lightTextColor} />
                        </View>
                    )}
                    <View style={[styles.addStoryBadge, { backgroundColor: primaryColor, borderColor: backgroundColor }]}>
                        <IconSymbol name="plus" size={12} color={white} />
                    </View>
                </View>
                <ThemedText style={styles.storyUsername}>Your Story</ThemedText>
            </TouchableOpacity>
            <FlatList
                data={stories}
                renderItem={renderStoryItem}
                keyExtractor={(item) => item.user._id}
                horizontal
                showsHorizontalScrollIndicator={false}
            />
        </View>
    );

    const renderPost = ({ item }: { item: Post }) => {
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
            />
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor }}>
            <ThemedView style={styles.container}>
                <View style={[styles.appBar, { backgroundColor, borderBottomColor: borderColor }]}>
                    <ThemedText style={[styles.logo, { color: primaryColor }]}>Youngie</ThemedText>
                    <View style={styles.appBarIcons}>
                        <TouchableOpacity style={[styles.iconCircle, isIncognito && { backgroundColor: primaryColor }]} onPress={() => setIsIncognito(!isIncognito)}>
                            <Ionicons name="glasses" size={22} color={isIncognito ? white : textColor} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.iconCircle} onPress={() => router.push('/explore')}>
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
                />

                <TouchableOpacity
                    style={[styles.fab, { backgroundColor: primaryColor, shadowColor: primaryColor }]}
                    onPress={() => setShowCreateModal(true)}
                >
                    <LinearGradient
                        colors={[primaryColor, useThemeColor('primaryDark')]}
                        style={styles.fabGradient}
                    >
                        <IconSymbol name="plus" size={32} color={white} />
                    </LinearGradient>
                </TouchableOpacity>
                
                <CreatePostModal visible={showCreateModal} onClose={() => setShowCreateModal(false)} onPost={fetchData} initialAnonymous={isIncognito} />
                <CreateStoryModal visible={showCreateStoryModal} onClose={() => setShowCreateStoryModal(false)} onCreate={fetchData} />
                <StoryViewer visible={showStoryViewer} onClose={() => setShowStoryViewer(false)} storyGroups={stories} initialGroupIndex={selectedStoryGroupIndex} onStoryDeleted={fetchData} />
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
        width: 64,
        height: 64,
        borderRadius: 32,
        borderWidth: 2,
        padding: 2,
        marginBottom: spacing.xs,
    },
    storyAvatar: {
        width: '100%',
        height: '100%',
        borderRadius: 30,
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
