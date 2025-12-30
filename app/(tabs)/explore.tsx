// app/(tabs)/explore.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, FlatList, TextInput, Dimensions, ActivityIndicator, Alert, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/contexts/AuthContext';
import { postAPI, userAPI, getImageUrl } from '@/utils/api';
import { useThemeColor } from '@/hooks/use-theme-color';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { spacing, borderRadius, typography, shadows } from '@/constants/design-tokens';
import { useDebounce } from '@/hooks/use-debounce';
import { useRouter, useFocusEffect } from 'expo-router';

const { width } = Dimensions.get('window');

interface Post {
  _id: string;
  author: {
    _id: string;
    username: string;
    avatar?: string;
    profilePhoto?: string;
  };
  content: string;
  image?: string;
  video?: string;
  createdAt: string;
  likes: string[];
  comments: any[];
}

interface User {
  _id: string;
  username: string;
  avatar?: string;
  profilePhoto?: string;
  bio?: string;
}

export default function ExploreScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [trendingPosts, setTrendingPosts] = useState<Post[]>([]);
  const [discoverUsers, setDiscoverUsers] = useState<User[]>([]);
  const [searchResults, setSearchResults] = useState<{ users: User[]; posts: Post[] }>({ users: [], posts: [] });
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [friendIds, setFriendIds] = useState<string[]>([]);

  const debouncedSearchQuery = useDebounce(searchQuery, 500); // Debounce search query by 500ms

  const backgroundColor = useThemeColor('background');
  const primaryColor = useThemeColor('primary');
  const textColor = useThemeColor('text');
  const lightTextColor = useThemeColor('lightText');
  const surfaceColor = useThemeColor('surface');
  const borderColor = useThemeColor('border');
  const white = useThemeColor('white');

  const fetchExploreData = useCallback(async () => {
    setIsLoading(true);
    try {
      const promises: Promise<any>[] = [
        postAPI.getTrendingPosts(),
        userAPI.getNearbyUsers(),
      ];

      if (user?._id) {
        promises.push(userAPI.getProfile(user._id));
      }

      const results = await Promise.all(promises);
      const trendingResponse = results[0];
      const discoverResponse = results[1];
      const profileResponse = results[2];

      setTrendingPosts(trendingResponse.data);
      setDiscoverUsers(discoverResponse.data.slice(0, 4)); // Limit to 4 for display
      
      if (profileResponse?.data?.friends) {
        setFriendIds(profileResponse.data.friends.map((f: any) => typeof f === 'string' ? f : f._id));
      }
    } catch (error) {
      console.error('Failed to fetch explore data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?._id]);

  useFocusEffect(
    useCallback(() => {
      fetchExploreData();
    }, [fetchExploreData])
  );

  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults({ users: [], posts: [] });
      return;
    }

    setIsSearching(true);
    try {
      const [userResponse, postResponse] = await Promise.all([
        userAPI.searchUsers(query),
        postAPI.searchPosts(query)
      ]);

      setSearchResults({
        users: userResponse.data,
        posts: postResponse.data
      });
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    performSearch(debouncedSearchQuery);
  }, [debouncedSearchQuery, performSearch]);


  const handleSendFriendRequest = async (targetUserId: string, userName: string) => {
    if (!user?._id) return;
    try {
      await userAPI.sendFriendRequest(user._id, targetUserId);
      Alert.alert('Success', `Friend request sent to ${userName}`);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.msg || 'Failed to send friend request');
    }
  };

  const renderUserAction = (targetUser: User) => {
    const isFriend = friendIds.includes(targetUser._id);
    const isSelf = user?._id === targetUser._id;

    if (isSelf) return null;

    if (isFriend) {
      return (
        <View style={[styles.followButton, { backgroundColor: surfaceColor, borderWidth: 1, borderColor }]}>
          <ThemedText style={[styles.followText, { color: textColor }]}>Friend</ThemedText>
        </View>
      );
    }

    return (
      <TouchableOpacity 
        style={[styles.followButton, { backgroundColor: primaryColor }]}
        onPress={() => handleSendFriendRequest(targetUser._id, targetUser.username)}
      >
        <ThemedText style={[styles.followText, { color: white }]}>Add Friend</ThemedText>
      </TouchableOpacity>
    );
  };

  const categories = [
    { id: '1', title: 'Music', icon: 'headphones', color: useThemeColor('primaryDark') },
    { id: '2', title: 'Gaming', icon: 'gamepad', color: useThemeColor('accent') },
    { id: '3', title: 'Sports', icon: 'globe', color: useThemeColor('warning') },
    { id: '4', title: 'Art', icon: 'image', color: useThemeColor('error') },
    { id: '5', title: 'Tech', icon: 'code', color: useThemeColor('primaryLight') },
  ];

  return (
    <ThemedView style={styles.container}>
      {/* Search Header */}
      <ThemedView style={[styles.header, { backgroundColor, borderBottomColor: borderColor }]}>
        <ThemedText type="heading1" style={{ fontFamily: typography.families.bold }}>Explore</ThemedText>
        <View style={[styles.searchWrapper, { backgroundColor: surfaceColor, borderColor }]}>
          <IconSymbol name="magnifyingglass" size={20} color={lightTextColor} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: textColor }]}
            placeholder="Search users and posts..."
            placeholderTextColor={lightTextColor}
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
            }}
          />
        </View>
      </ThemedView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>

        {/* Search Results */}
        {searchQuery.trim() ? (
          <View style={styles.section}>
            {isSearching ? (
              <ActivityIndicator size="large" color={primaryColor} />
            ) : (
              <>
                {searchResults.users.length > 0 && (
                  <View style={styles.section}>
                    <ThemedText type="title" style={styles.sectionTitle}>Users</ThemedText>
                    {searchResults.users.map((user) => (
                      <TouchableOpacity key={user._id} style={[styles.userRow, { borderBottomColor: borderColor }]} onPress={() => router.push(`/user/${user._id}`)}>
                        <View style={[styles.userAvatar, { backgroundColor: surfaceColor }]}>
                          {user.profilePhoto ? (
                            <Image source={{ uri: getImageUrl(user.profilePhoto) }} style={styles.avatarImage} />
                          ) : (
                            <IconSymbol name="person.fill" size={24} color={lightTextColor} />
                          )}
                        </View>
                        <View style={styles.userInfo}>
                          <ThemedText type="body1" style={{ fontFamily: typography.families.bold }}>{user.username}</ThemedText>
                          <ThemedText type="caption" style={{ color: lightTextColor }}>{user.bio || 'No bio'}</ThemedText>
                        </View>
                        {renderUserAction(user)}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {searchResults.posts.length > 0 && (
                  <View style={styles.section}>
                    <ThemedText type="title" style={styles.sectionTitle}>Posts</ThemedText>
                    {searchResults.posts.map((post) => (
                      <TouchableOpacity key={post._id} style={[styles.postRow, { borderBottomColor: borderColor }]} onPress={() => router.push(`/user-posts/${post.author._id}`)}>
                        <View style={styles.postHeader}>
                          {post.author.profilePhoto ? (
                            <Image source={{ uri: getImageUrl(post.author.profilePhoto) }} style={styles.postAvatar} />
                          ) : (
                            <View style={[styles.postAvatar, { backgroundColor: surfaceColor, justifyContent: 'center', alignItems: 'center' }]}>
                                <IconSymbol name="person.fill" size={12} color={lightTextColor} />
                            </View>
                          )}
                          <ThemedText type="caption" style={{ color: lightTextColor }}>
                            by {post.author.username}
                          </ThemedText>
                        </View>
                        <ThemedText type="body1" numberOfLines={2}>
                          {post.content}
                        </ThemedText>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {searchResults.users.length === 0 && searchResults.posts.length === 0 && (
                  <View style={styles.emptyContainer}>
                    <ThemedText type="body1" style={{ color: lightTextColor }}>No results found</ThemedText>
                  </View>
                )}
              </>
            )}
          </View>
        ) : (
          <>
            {/* Horizontal Categories */}
            <View style={styles.section}>
              <ThemedText type="title" style={styles.sectionTitle}>Categories</ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryList}>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.catPill, { backgroundColor: cat.color + '15', borderColor: cat.color + '40' }]}
                    onPress={() => {
                      setSearchQuery(cat.title);
                    }}
                  >
                    <IconSymbol name={cat.icon as any} size={18} color={cat.color} />
                    <ThemedText type="body2" style={[styles.catText, { color: cat.color }]}>{cat.title}</ThemedText>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Trending Posts */}
            <View style={styles.section}>
              <ThemedText type="title" style={styles.sectionTitle}>Trending Posts</ThemedText>
              {isLoading ? (
                <ActivityIndicator size="large" color={primaryColor} />
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trendList}>
                  {trendingPosts.map((post) => (
                    <TouchableOpacity key={post._id} style={styles.trendCard} onPress={() => router.push({ pathname: '/', params: { postId: post._id } })}>
                      <LinearGradient colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.8)']} style={styles.trendGradient}>
                        <View>
                          <ThemedText style={[styles.trendHashtag, { color: white }]} numberOfLines={2}>
                            {post.content}
                          </ThemedText>
                          <ThemedText style={[styles.trendCount, { color: white }]}>
                            by {post.author.username} • {post.likes.length} likes
                          </ThemedText>
                        </View>
                      </LinearGradient>
                      {post.image && (
                        <Image source={{ uri: getImageUrl(post.image) }} style={styles.trendImage} />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Popular Users */}
            <View style={styles.section}>
              <ThemedText type="title" style={styles.sectionTitle}>Discover People</ThemedText>
              {discoverUsers.map((user) => (
                <TouchableOpacity key={user._id} style={[styles.userRow, { borderBottomColor: borderColor }]} onPress={() => router.push(`/user/${user._id}`)}>
                  <View style={[styles.userAvatar, { backgroundColor: surfaceColor }]}>
                    {user.profilePhoto ? (
                      <Image source={{ uri: getImageUrl(user.profilePhoto) }} style={styles.avatarImage} />
                    ) : (
                      <IconSymbol name="person.fill" size={24} color={lightTextColor} />
                    )}
                  </View>
                  <View style={styles.userInfo}>
                    <ThemedText type="body1" style={{ fontFamily: typography.families.bold }}>{user.username}</ThemedText>
                    <ThemedText type="caption" style={{ color: lightTextColor }}>{user.bio || 'No bio'}</ThemedText>
                  </View>
                  {renderUserAction(user)}
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: spacing.xl * 2,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
  },
  sectionTitle: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    height: 50,
    borderWidth: 1,
    ...shadows.sm,
  },
  searchIcon: { marginRight: spacing.sm },
  searchInput: { flex: 1, fontSize: typography.sizes.body1, fontFamily: typography.families.regular },
  scrollBody: { paddingBottom: spacing.xxl },
  section: { marginTop: spacing.xl },
  categoryList: { paddingHorizontal: spacing.lg, gap: spacing.md },
  catPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.xl,
    gap: spacing.sm,
    borderWidth: 1,
  },
  catText: { fontFamily: typography.families.bold, fontSize: typography.sizes.body2 },
  trendList: { paddingHorizontal: spacing.lg, gap: spacing.md },
  trendCard: {
    width: width * 0.7,
    height: 180,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    ...shadows.md,
  },
  trendGradient: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'flex-end',
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  trendHashtag: { fontSize: typography.sizes.title, fontFamily: typography.families.bold },
  trendCount: { fontSize: typography.sizes.caption, marginTop: spacing.xs, opacity: 0.8 },
  trendImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.round,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.round,
  },
  userInfo: {
    flex: 1,
  },
  followButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  followText: {
    fontFamily: typography.families.bold,
    fontSize: typography.sizes.caption,
  },
  postRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  postAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: spacing.sm,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
});