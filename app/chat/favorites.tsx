import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, View, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { Header } from '@/components/header';
import { FeedCard } from '@/app/chat/FeedCard.component';
import { postAPI } from '@/utils/api';
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

    const handleUnfavorite = async (postId: string) => {
        // Optimistically remove from list
        setPosts(prev => prev.filter(p => p._id !== postId));
        try {
            await postAPI.unfavoritePost(postId);
        } catch (error) {
            fetchFavorites(); // Revert on error
        }
    };

    const handleLike = async (postId: string) => {
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
            await postAPI.likePost(postId);
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
                                onDelete={() => {}}
                                onReport={() => {}}
                                onUpdate={() => {}}
                                onLike={handleLike}
                                onComment={() => {}}
                                onFavorite={() => handleUnfavorite(item._id)}
                                shouldPlay={false}
                            />
                        )}
                        contentContainerStyle={styles.listContent}
                        onEndReached={loadMore}
                        onEndReachedThreshold={0.3}
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