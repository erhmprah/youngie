// app/(tabs)/explore.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, FlatList, TextInput, Dimensions, ActivityIndicator, Alert, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/contexts/AuthContext';
import { postAPI, userAPI, communityAPI, getImageUrl } from '@/utils/api';
import { useThemeColor } from '@/hooks/use-theme-color';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { spacing, borderRadius, typography, shadows } from '@/constants/design-tokens';
import { useDebounce } from '@/hooks/use-debounce';
import { useRouter, useFocusEffect } from 'expo-router';
import { CreateCommunityModal } from './create-community-modal.component';
import { FilterModal, FilterState } from '@/components/FilterModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { showErrorAlert } from '@/utils/error-handler';

const { width } = Dimensions.get('window');

const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

interface Post {
  _id: string;
  author: {
    _id: string;
    username: string;
    avatar?: string;
    profilePhoto?: string;
  };
  content: string;
  images?: string[];
  video?: string; // Keep for now, though posts have either images or video
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

interface Community {
  _id: string;
  name: string;
  description: string;
  image?: string;
  memberCount?: number;
  chat?: { _id: string };
}

export default function ExploreScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [trendingPosts, setTrendingPosts] = useState<Post[]>([]);
  const [discoverUsers, setDiscoverUsers] = useState<User[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [myCommunities, setMyCommunities] = useState<Community[]>([]);
  const [searchResults, setSearchResults] = useState<{ users: User[]; posts: Post[] }>({ users: [], posts: [] });
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [sentRequestIds, setSentRequestIds] = useState<string[]>([]);
  const [showCreateCommunityModal, setShowCreateCommunityModal] = useState(false);
  const [isFilterVisible, setFilterVisible] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    minAge: '',
    maxAge: '',
    gender: [],
    location: ''
  });

  const debouncedSearchQuery = useDebounce(searchQuery, 500); // Debounce search query by 500ms

  const backgroundColor = useThemeColor('background');
  const primaryColor = useThemeColor('primary');
  const textColor = useThemeColor('text');
  const lightTextColor = useThemeColor('lightText');
  const surfaceColor = useThemeColor('surface');
  const borderColor = useThemeColor('border');
  const white = useThemeColor('white');

  useEffect(() => {
    const loadFilters = async () => {
      try {
        const savedFilters = await AsyncStorage.getItem('discovery_filters');
        if (savedFilters) {
          setFilters(JSON.parse(savedFilters));
        }
      } catch (error) {
      }
    };
    loadFilters();
  }, []);

  const fetchExploreData = useCallback(async (currentFilters?: FilterState) => {
    setIsLoading(true);
    try {
      const activeFilters = currentFilters || filters;
      const promises: Promise<any>[] = [
        postAPI.getTrendingPosts(),
        userAPI.getNearbyUsers(activeFilters),
        communityAPI.getAll(),
      ];

      if (user?._id) {
        promises.push(userAPI.getProfile(user._id));
      }

      const results = await Promise.all(promises);
      const trendingResponse = results[0];
      const discoverResponse = results[1];
      const communitiesResponse = results[2];
      const profileResponse = results[3];

      setTrendingPosts(trendingResponse.data);

      let discoverData = discoverResponse.data.users;
      if (activeFilters.minAge) {
        const min = parseInt(activeFilters.minAge);
        if (!isNaN(min)) discoverData = discoverData.filter((p: any) => p.age >= min);
      }
      if (activeFilters.maxAge) {
        const max = parseInt(activeFilters.maxAge);
        if (!isNaN(max)) discoverData = discoverData.filter((p: any) => p.age <= max);
      }
      if (activeFilters.gender && activeFilters.gender.length > 0) {
        discoverData = discoverData.filter((p: any) => activeFilters.gender.includes(p.gender));
      }
      
      if (activeFilters.latitude && activeFilters.longitude && activeFilters.radius) {
        discoverData = discoverData.filter((p: any) => {
            if (!p.latitude || !p.longitude) return false;
            const distance = getDistanceFromLatLonInKm(activeFilters.latitude!, activeFilters.longitude!, p.latitude, p.longitude);
            return distance <= activeFilters.radius!;
        });
      } else if (activeFilters.location) {
        discoverData = discoverData.filter((p: any) => p.location && p.location.toLowerCase().includes(activeFilters.location.toLowerCase()));
      }
      setDiscoverUsers(discoverData.slice(0, 4)); // Limit to 4 for display

      const allCommunities = communitiesResponse.data;

      // 1. My Communities (Member or Creator)
      const myComms = allCommunities.filter((community: any) => {
        const isMember = community.members.some((member: any) => member._id === user?._id);
        const isCreator = community.creator._id === user?._id;
        return isMember || isCreator;
      });
      setMyCommunities(myComms);

      // 2. Discover Communities (Not a member)
      const discoverComms = allCommunities.filter((community: any) => {
        const isMember = community.members.some((member: any) => member._id === user?._id);
        const isCreator = community.creator._id === user?._id;
        return !isMember && !isCreator;
      }).slice(0, 4); // Limit to 4 for display

      setCommunities(discoverComms);

      if (profileResponse?.data?.friends) {
        setFriendIds(profileResponse.data.friends.map((f: any) => typeof f === 'string' ? f : f._id));
      }
      if (profileResponse?.data?.friendRequests) {
        setSentRequestIds(profileResponse.data.friendRequests.map((r: any) => typeof r === 'string' ? r : r._id));
      }
    } catch (error) {
      showErrorAlert(error, () => fetchExploreData());
    } finally {
      setIsLoading(false);
    }
  }, [user?._id, filters]);

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
      showErrorAlert(error);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    performSearch(debouncedSearchQuery);
  }, [debouncedSearchQuery, performSearch]);

  const handleApplyFilters = async (newFilters: FilterState) => {
    setFilters(newFilters);
    fetchExploreData(newFilters);
    try {
      await AsyncStorage.setItem('discovery_filters', JSON.stringify(newFilters));
    } catch (error) {
    }
  };

  const handleSendFriendRequest = async (targetUserId: string, userName: string) => {
    if (!user?._id) return;
    try {
      await userAPI.sendFriendRequest(user._id, targetUserId);
      setSentRequestIds(prev => [...prev, targetUserId]);
      Alert.alert('Success', `Friend request sent to ${userName}`);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.msg || 'Failed to send friend request');
    }
  };

  const handleJoinCommunity = async (communityId: string, communityName: string) => {
    try {
      await communityAPI.join(communityId);
      Alert.alert('Success', `Joined ${communityName}`);
      // Refetch to update the list
      fetchExploreData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.msg || 'Failed to join community');
    }
  };

  const renderUserAction = (targetUser: User) => {
    const isFriend = friendIds.includes(targetUser._id);
    const isRequestSent = sentRequestIds.includes(targetUser._id);
    const isSelf = user?._id === targetUser._id;

    if (isSelf) return null;

    if (isFriend) {
      return (
        <View style={[styles.followButton, { backgroundColor: surfaceColor, borderWidth: 1, borderColor }]}>
          <ThemedText style={[styles.followText, { color: textColor }]}>Friend</ThemedText>
        </View>
      );
    }

    if (isRequestSent) {
      return (
        <View style={[styles.followButton, { backgroundColor: surfaceColor, borderWidth: 1, borderColor }]}>
          <ThemedText style={[styles.followText, { color: textColor }]}>Requested</ThemedText>
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
    <ThemedView style={styles.container} safe>
      {/* Search Header */}
      <ThemedView style={[styles.header, { backgroundColor, borderBottomColor: borderColor }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
          <ThemedText type="heading1" style={{ fontFamily: typography.families.bold, color: primaryColor }}>Explore</ThemedText>
          <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setFilterVisible(true); }}>
            <IconSymbol name="slider.horizontal.3" size={24} color={textColor} />
          </TouchableOpacity>
        </View>
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
                      <TouchableOpacity key={user._id} style={[styles.userRow, { borderBottomColor: borderColor }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/user/${user._id}`); }}>
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
                      <TouchableOpacity key={post._id} style={[styles.postRow, { borderBottomColor: borderColor }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/post/${post._id}`); }}>
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
                      Haptics.selectionAsync();
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
                    <TouchableOpacity key={post._id} style={styles.trendCard} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/post/${post._id}`); }}>
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
                      {post.images && post.images.length > 0 && (
                        <Image source={{ uri: getImageUrl(post.images[0]) }} style={styles.trendImage} />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Popular Users */}
            <View style={styles.section}>
              <ThemedText type="title" style={styles.sectionTitle}>Discover People</ThemedText>
              {discoverUsers.length > 0 ? (
                discoverUsers.map((user) => (
                  <TouchableOpacity key={user._id} style={[styles.userRow, { borderBottomColor: borderColor }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/user/${user._id}`); }}>
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
                ))
              ) : (
                <View style={{ paddingHorizontal: spacing.lg }}>
                  <ThemedText style={{ color: lightTextColor, fontStyle: 'italic' }}>
                    {(filters.minAge || filters.maxAge || filters.gender.length > 0 || filters.location) ? "No users match your filters." : "No users found."}
                  </ThemedText>
                </View>
              )}
            </View>

            {/* My Communities */}
            <View style={styles.section}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingRight: spacing.lg }}>
                <ThemedText type="title" style={styles.sectionTitle}>My Communities</ThemedText>
                <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowCreateCommunityModal(true); }}>
                  <IconSymbol name="plus" size={24} color={primaryColor} />
                </TouchableOpacity>
              </View>
              {myCommunities.length > 0 ? (
                myCommunities.map((community) => (
                  <TouchableOpacity 
                    key={community._id} 
                    style={[styles.userRow, { borderBottomColor: borderColor }]} 
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      const chatId = typeof community.chat === 'object' ? (community.chat as any)?._id : community.chat;
                      if (chatId) {
                        router.push(`/chat/${chatId}`);
                      } else {
                        Alert.alert('Info', 'Chat not available for this community');
                      }
                    }}
                  >
                    <View style={[styles.userAvatar, { backgroundColor: surfaceColor }]}>
                      {community.image ? (
                        <Image source={{ uri: getImageUrl(community.image) }} style={styles.avatarImage} />
                      ) : (
                        <IconSymbol name="person.3.fill" size={24} color={lightTextColor} />
                      )}
                    </View>
                    <View style={styles.userInfo}>
                      <ThemedText type="body1" style={{ fontFamily: typography.families.bold }}>{community.name}</ThemedText>
                      <ThemedText type="caption" style={{ color: lightTextColor }}>{community.description}</ThemedText>
                    </View>
                    <View style={[styles.followButton, { backgroundColor: surfaceColor, borderWidth: 1, borderColor }]}>
                      <ThemedText style={[styles.followText, { color: textColor }]}>Open</ThemedText>
                    </View>
                    <TouchableOpacity style={{ marginLeft: spacing.sm, padding: spacing.sm }} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/community/${community._id}`); }}>
                        <IconSymbol name="info.circle" size={24} color={lightTextColor} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))
              ) : (
                <ThemedText style={{ paddingHorizontal: spacing.lg, color: lightTextColor, fontStyle: 'italic' }}>
                  You haven't joined any communities yet.
                </ThemedText>
              )}
            </View>

            {/* Communities */}
            <View style={styles.section}>
              <ThemedText type="title" style={styles.sectionTitle}>Communities</ThemedText>
              {communities.map((community) => (
                <TouchableOpacity key={community._id} 
                  style={[styles.userRow, { borderBottomColor: borderColor }]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/community/${community._id}`); }}
                >
                  <View style={[styles.userAvatar, { backgroundColor: surfaceColor }]}>
                    {community.image ? (
                      <Image source={{ uri: getImageUrl(community.image) }} style={styles.avatarImage} />
                    ) : (
                      <IconSymbol name="person.3.fill" size={24} color={lightTextColor} />
                    )}
                  </View>
                  <View style={styles.userInfo}>
                    <ThemedText type="body1" style={{ fontFamily: typography.families.bold }}>{community.name}</ThemedText>
                    <ThemedText type="caption" style={{ color: lightTextColor }}>{community.description}</ThemedText>
                  </View>
                  <TouchableOpacity style={[styles.followButton, { backgroundColor: primaryColor }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); handleJoinCommunity(community._id, community.name); }}>
                    <ThemedText style={[styles.followText, { color: white }]}>Join</ThemedText>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <CreateCommunityModal visible={showCreateCommunityModal} onClose={() => setShowCreateCommunityModal(false)} onCreate={fetchExploreData} />
        <FilterModal
          visible={isFilterVisible}
          onClose={() => setFilterVisible(false)}
          onApply={handleApplyFilters}
          initialFilters={filters}
        />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
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