import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, View, ActivityIndicator, RefreshControl, TouchableOpacity, ViewToken } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { Header } from '@/components/header';
import { FeedCard } from '@/app/chat/FeedCard.component';
import { postAPI, communityAPI } from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeColor } from '@/hooks/use-theme-color';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { spacing } from '@/constants/design-tokens';

export default function FavoritesScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [posts, setPosts] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [playingPostId, setPlayingPostId] = useState<string | null>(null);
    const viewabilityConfig = useRef({
        itemVisiblePercentThreshold: 50,
    }).current;

    const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
        if (viewableItems.length > 0) {
            setPlayingPostId(viewableItems[0].item._id);
        }
    }, []);
    const primaryColor = useThemeColor('primary');
    const textColor = useThemeColor('text');

    const fetchFavorites = async (pageNum: number = 1, loadMore: boolean = false) => {
        try {
            const response = await postAPI.getFavoritePosts(pageNum, 20);
            const newPosts = response.data.data;
            setPosts(prev => loadMore ? [...prev, ...newPosts] : newPosts);
            setHasMore(response.data.pagination?.hasNextPage || false);
            setPage(pageNum);
        } catch (error: any) {
        } finally {
            setIsLoading(false);
            setRefreshing(false);
            setLoadingMore(false);
        }
    };

    useEffect(() => {
        fetchFavorites();
    }, []);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchFavorites(1);
    };

    const loadMore = () => {
        if (loadingMore || !hasMore) return;
        setLoadingMore(true);
        fetchFavorites(page + 1, true);
    };

    const handleUnfavorite = async (postId: string, type?: string) => {
        // Optimistically remove from list
        setPosts(prev => prev.filter(p => p._id !== postId));
        try {
            if (type === 'communityFeed') {
                const post = posts.find(p => p._id === postId);
                await communityAPI.unfavoriteFeed(post?.community?._id, postId);
            } else {
                await postAPI.unfavoritePost(postId);
            }
        } catch (error) {
            fetchFavorites(); // Revert on error
        }
    };

    const handleLike = async (postId: string, type?: string, communityId?: string) => {
        // Optimistic update for like
        setPosts(prev => prev.map(p => {
            if (p._id === postId) {
                const isLiked = p.likes.some((l: any) => l._id === user?._id);
                const newLikes = isLiked
                    ? p.likes.filter((l: any) => l._id !== user?._id)
                    : [...p.likes, { _id: user?._id, username: user?.username }];
                return { ...p, likes: newLikes };
            }
            return p;
        }));

        try {
            if (type === 'communityFeed') {
                await communityAPI.likeFeed(communityId || '', postId);
            } else {
                await postAPI.likePost(postId);
            }
        } catch (error) {
            fetchFavorites(); // Revert on error
        }
    };

    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <Header
                    title="Favorites"
                    leftComponent={
                        <TouchableOpacity onPress={() => router.back()} style={{ padding: spacing.sm }}>
                            <IconSymbol name="chevron.left" size={28} color={textColor} />
                        </TouchableOpacity>
                    }
                />
                
                {isLoading ? (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color={primaryColor} />
                    </View>
                ) : (
                    <FlatList
                        data={posts}
                        keyExtractor={(item) => item._id}
                        renderItem={({ item }) => (
                            <FeedCard
                                post={item}
                                currentUserId={user?._id || ''}
                                communityId={item.community?._id}
                                onDelete={() => {}}
                                onReport={() => {}}
                                onUpdate={() => {}}
                                onLike={(postId: string) => handleLike(postId, item.type, item.community?._id)}
                                onComment={() => {}}
                                onFavorite={() => handleUnfavorite(item._id, item.type)}
                                shouldPlay={item._id === playingPostId}
                            />
                        )}
                        contentContainerStyle={styles.listContent}
                        onEndReached={loadMore}
                        onEndReachedThreshold={0.3}
                        onViewableItemsChanged={onViewableItemsChanged}
                        viewabilityConfig={viewabilityConfig}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={primaryColor} />
                        }
                        ListEmptyComponent={
                            <View style={styles.center}>
                                <ThemedText style={{ color: textColor, opacity: 0.7 }}>
                                    No favorite posts yet.
                                </ThemedText>
                            </View>
                        }
                    />
                )}
            </SafeAreaView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    safeArea: {
        flex: 1,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: spacing.md,
        paddingBottom: spacing.xl,
    },
});