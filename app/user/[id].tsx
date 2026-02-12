import React, { useEffect, useState, useCallback, useRef } from 'react';
import { StyleSheet, View, Image, ActivityIndicator, TouchableOpacity, Alert, Animated, FlatList, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { userAPI, getImageUrl, chatAPI, postAPI } from '@/utils/api';
import { useThemeColor } from '@/hooks/use-theme-color';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { spacing, borderRadius, typography } from '@/constants/design-tokens';
import { useAuth } from '@/contexts/AuthContext';
import { shadows } from '@/constants/design-tokens';

const { width } = Dimensions.get('window');

interface UserProfile {
  _id: string;
  username: string;
  bio?: string;
  profilePhoto?: string;
  avatar?: string;
  location?: string;
  interests?: string[];
  friends?: any[];
  posts?: any[];
  isPrivate?: boolean;
}

interface Post {
  _id: string;
  content?: string;
  image?: string;
  author: any;
  createdAt: string;
  likes: any[];
  comments: any[];
}

interface AlbumPhoto {
  _id: string;
  image: string;
  createdAt: string;
}

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'self' | 'friend' | 'requested' | 'received' | 'none'>('none');
  const [stats, setStats] = useState({ posts: 0, friends: 0 });
  const loadingOpacity = useRef(new Animated.Value(1)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const [posts, setPosts] = useState<Post[]>([]);
  const [album, setAlbum] = useState<AlbumPhoto[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [postsPage, setPostsPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'posts' | 'album'>('posts');
  const [loadingAlbum, setLoadingAlbum] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const backgroundColor = useThemeColor('background');
  const primaryColor = useThemeColor('primary');
  const textColor = useThemeColor('text');
  const lightTextColor = useThemeColor('lightText');
  const surfaceColor = useThemeColor('surface');
  const borderColor = useThemeColor('border');
  const white = useThemeColor('white');
  const errorColor = useThemeColor('error');

  const fetchProfile = useCallback(async () => {
    if (!id || !currentUser?._id) return;
    setIsLoading(true);
    try {
      const [userRes, myProfileRes] = await Promise.all([
        userAPI.getProfile(id as string),
        userAPI.getProfile(currentUser._id)
      ]);

      setProfile(userRes.data);
      setStats({
        posts: userRes.data.posts?.length || 0,
        friends: userRes.data.friends?.length || 0
      });

      // Determine connection status
      const targetId = userRes.data._id;
      const myData = myProfileRes.data;

      if (targetId === currentUser._id) {
        setConnectionStatus('self');
      } else if (myData.friends.some((f: any) => (typeof f === 'string' ? f : f._id) === targetId)) {
        setConnectionStatus('friend');
      } else if (myData.friendRequests.some((id: any) => (typeof id === 'string' ? id : id._id) === targetId)) {
        setConnectionStatus('requested');
      } else if (myData.incomingRequests?.some((id: any) => (typeof id === 'string' ? id : id._id) === targetId)) {
        setConnectionStatus('received');
      } else {
        setConnectionStatus('none');
      }

    } catch (error) {
      console.error('Error fetching user profile:', error);
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  }, [id, currentUser?._id]);

  const fetchPosts = useCallback(async (page: number = 1) => {
    if (!id) return;
    setLoadingPosts(true);
    try {
      const response = await postAPI.getUserPosts(id as string, page, 20);
      const { posts: newPosts, hasMore } = response.data;
      if (page === 1) {
        setPosts(newPosts);
      } else {
        setPosts(prev => [...prev, ...newPosts]);
      }
      setHasMorePosts(hasMore);
      setPostsPage(page);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoadingPosts(false);
    }
  }, [id]);

  const fetchAlbum = useCallback(async () => {
    if (!id) return;
    setLoadingAlbum(true);
    try {
      const response = await userAPI.getAlbum(id as string);
      setAlbum(response.data || []);
    } catch (error) {
      console.error('Error fetching album:', error);
      setAlbum([]);
    } finally {
      setLoadingAlbum(false);
    }
  }, [id]);

  const loadMorePosts = () => {
    if (!loadingPosts && hasMorePosts) {
      fetchPosts(postsPage + 1);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (profile) {
      fetchPosts(1);
      fetchAlbum();
    }
  }, [profile, fetchPosts, fetchAlbum]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(loadingOpacity, {
        toValue: isLoading ? 1 : 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(contentOpacity, {
        toValue: isLoading ? 0 : 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isLoading, loadingOpacity, contentOpacity]);

  const handleSendRequest = async () => {
    if (!currentUser?._id || !profile) return;
    try {
      await userAPI.sendFriendRequest(currentUser._id, profile._id);
      await fetchProfile();
      Alert.alert('Success', 'Friend request sent');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.msg || 'Failed to send request');
    }
  };

  const handleAcceptRequest = async () => {
    if (!currentUser?._id || !profile) return;
    try {
      await userAPI.acceptFriendRequest(currentUser._id, profile._id);
      await fetchProfile();
      Alert.alert('Success', 'Friend request accepted');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.msg || 'Failed to accept request');
    }
  };

  const handleCancelRequest = async () => {
    if (!currentUser?._id || !profile) return;
    try {
      await userAPI.cancelFriendRequest(currentUser._id, profile._id);
      await fetchProfile();
      Alert.alert('Success', 'Friend request cancelled');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.msg || 'Failed to cancel request');
    }
  };

  const handleMessage = async () => {
    if (!currentUser?._id || !profile) return;
    try {
        const response = await chatAPI.getUserChats(currentUser._id);
        const chats = response.data;
        const existingChat = chats.find((c: any) => 
            !c.isGroupChat && c.participants.some((p: any) => p._id === profile._id)
        );

        if (existingChat) {
            router.push(`/chat/${existingChat._id}`);
        } else {
            const newChatResponse = await chatAPI.createChat({
                participants: [currentUser._id, profile._id],
                isGroupChat: false
            });
            router.push(`/chat/${newChatResponse.data._id}`);
        }
    } catch (error) {
        console.error('Error opening chat:', error);
        Alert.alert('Error', 'Failed to open chat');
    }
  };

  const handleBlock = async () => {
    if (!currentUser?._id || !profile) return;

    Alert.alert(
      'Block User',
      `Are you sure you want to block ${profile.username}? This will remove them from your friends and prevent them from contacting you.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await userAPI.blockUser(currentUser._id, profile._id);
              Alert.alert('Success', `${profile.username} has been blocked`);
              router.back();
            } catch (error) {
              console.error('Error blocking user:', error);
              Alert.alert('Error', 'Failed to block user');
            }
          }
        }
      ]
    );
  };

  const renderPostItem = ({ item }: { item: Post }) => (
    <View style={[styles.postItem, { backgroundColor: surfaceColor, borderColor }]}>
      {item.image && (
        <Image source={{ uri: getImageUrl(item.image) }} style={styles.postImage} />
      )}
      <ThemedText style={styles.postContent}>{item.content || 'No content'}</ThemedText>
      <View style={styles.postStats}>
        <View style={styles.postStat}>
          <IconSymbol name="heart.fill" size={14} color={lightTextColor} />
          <ThemedText style={[styles.postStatText, { color: lightTextColor }]}>{item.likes?.length || 0}</ThemedText>
        </View>
        <View style={styles.postStat}>
          <IconSymbol name="message.fill" size={14} color={lightTextColor} />
          <ThemedText style={[styles.postStatText, { color: lightTextColor }]}>{item.comments?.length || 0}</ThemedText>
        </View>
      </View>
    </View>
  );

  const renderAlbumItem = ({ item }: { item: AlbumPhoto }) => (
    <TouchableOpacity 
      style={styles.albumItem} 
      onPress={() => setSelectedImage(getImageUrl(item.image) || null)}
    >
      <Image source={{ uri: getImageUrl(item.image) }} style={styles.albumImage} />
    </TouchableOpacity>
  );

  const getData = () => {
    if (activeTab === 'posts') {
      return posts.length > 0 ? posts : [{ type: 'empty' }];
    } else {
      return album.length > 0 ? album : [{ type: 'empty' }];
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    if (item.type === 'empty') {
      return (
        <View style={styles.emptyContainer}>
          <IconSymbol 
            name={activeTab === 'posts' ? 'camera' : 'photo'} 
            size={48} 
            color={lightTextColor} 
          />
          <ThemedText style={[styles.emptyText, { color: textColor }]}>
            {activeTab === 'posts' ? 'No posts yet' : 'No photos in album'}
          </ThemedText>
        </View>
      );
    }

    if (activeTab === 'posts') {
      return renderPostItem({ item });
    } else {
      return renderAlbumItem({ item });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Loading View */}
      <Animated.View style={[styles.loadingContainer, { opacity: loadingOpacity, position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 }]}>
        <ActivityIndicator size="large" color={primaryColor} />
      </Animated.View>

      {/* Content View */}
      <Animated.View style={{ flex: 1, opacity: contentOpacity }}>
        <LinearGradient colors={[primaryColor + '20', 'transparent']} style={[styles.headerBackground, { pointerEvents: 'none' }]} />

        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.navHeader}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
              <IconSymbol name="chevron.left" size={28} color={textColor} />
            </TouchableOpacity>
          </View>
  
          {profile && (
            <>
              <View style={[styles.actionButtons, { pointerEvents: 'auto' }]}>
                {connectionStatus === 'none' && (
                  <TouchableOpacity style={[styles.primaryButton, { backgroundColor: primaryColor }]} onPress={handleSendRequest} activeOpacity={0.7}>
                    <ThemedText style={styles.buttonText}>Add Friend</ThemedText>
                  </TouchableOpacity>
                )}
                {connectionStatus === 'requested' && (
                  <TouchableOpacity style={[styles.secondaryButton, { borderColor }]} onPress={handleCancelRequest} activeOpacity={0.7}>
                    <ThemedText style={{ color: lightTextColor }}>Cancel Request</ThemedText>
                  </TouchableOpacity>
                )}
                {connectionStatus === 'received' && (
                  <TouchableOpacity style={[styles.primaryButton, { backgroundColor: primaryColor }]} onPress={handleAcceptRequest} activeOpacity={0.7}>
                    <ThemedText style={styles.buttonText}>Accept Request</ThemedText>
                  </TouchableOpacity>
                )}
                {connectionStatus === 'friend' && (
                  <>
                    <TouchableOpacity style={[styles.secondaryButton, { borderColor }]} onPress={handleMessage} activeOpacity={0.7}>
                      <ThemedText style={{ color: textColor }}>Message</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.blockButton, { borderColor: errorColor }]} onPress={handleBlock} activeOpacity={0.7}>
                      <IconSymbol name="person.slash" size={18} color={errorColor} />
                    </TouchableOpacity>
                  </>
                )}
              </View>

              <View style={{ flex: 1 }}>
                <View style={styles.content}>
                  <View style={styles.profileHeader}>
                    <View style={styles.avatarWrapper}>
                      <Image source={{ uri: getImageUrl(profile.profilePhoto) }} style={[styles.avatar, { borderColor: primaryColor }]} />
                    </View>
                    <View style={styles.nameRow}>
                      <ThemedText type="heading2" style={styles.username}>{profile.username}</ThemedText>
                      {profile.isPrivate && (
                        <IconSymbol name="lock" size={20} color={textColor} />
                      )}
                    </View>
                    {profile.bio && <ThemedText style={styles.bio}>{profile.bio}</ThemedText>}

                    {profile.location && (
                      <View style={styles.locationRow}>
                        <IconSymbol name="location" size={16} color={lightTextColor} />
                        <ThemedText style={{ color: lightTextColor }}>{profile.location}</ThemedText>
                      </View>
                    )}
                  </View>

                  <View style={[styles.statsBar, { backgroundColor: surfaceColor, borderColor }]}>
                    <View style={[styles.statBox, { borderRightColor: borderColor }]}>
                      <ThemedText type="title" style={{ fontFamily: typography.families.bold, color: primaryColor }}>{stats.posts}</ThemedText>
                      <ThemedText style={{ color: lightTextColor }}>Posts</ThemedText>
                    </View>
                    <View style={[styles.statBox, { borderRightColor: borderColor }]}>
                      <ThemedText type="title" style={{ fontFamily: typography.families.bold, color: primaryColor }}>{stats.friends}</ThemedText>
                      <ThemedText style={{ color: lightTextColor }}>Friends</ThemedText>
                    </View>
                    <View style={styles.statBox}>
                      <ThemedText type="title" style={{ fontFamily: typography.families.bold, color: primaryColor }}>{album.length}</ThemedText>
                      <ThemedText style={{ color: lightTextColor }}>Photos</ThemedText>
                    </View>
                  </View>

                  {profile.interests && profile.interests.length > 0 && (
                    <View style={styles.section}>
                      <ThemedText type="heading3" style={styles.sectionTitle}>Interests</ThemedText>
                      <View style={styles.interestsContainer}>
                        {profile.interests.map((interest, index) => (
                          <View key={index} style={[styles.interestChip, { backgroundColor: surfaceColor }]}>
                            <ThemedText>{interest}</ThemedText>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Tabs */}
                  <View style={[styles.tabsContainer, { borderBottomColor: borderColor }]}>
                    <TouchableOpacity
                      style={[styles.tab, activeTab === 'posts' && { borderBottomColor: primaryColor }]}
                      onPress={() => setActiveTab('posts')}
                    >
                      <IconSymbol name="grid" size={20} color={activeTab === 'posts' ? primaryColor : lightTextColor} />
                      <ThemedText style={[styles.tabText, { color: activeTab === 'posts' ? primaryColor : lightTextColor }]}>Posts</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.tab, activeTab === 'album' && { borderBottomColor: primaryColor }]}
                      onPress={() => setActiveTab('album')}
                    >
                      <IconSymbol name="photo.fill" size={20} color={activeTab === 'album' ? primaryColor : lightTextColor} />
                      <ThemedText style={[styles.tabText, { color: activeTab === 'album' ? primaryColor : lightTextColor }]}>Album</ThemedText>
                    </TouchableOpacity>
                  </View>

                  {/* Posts/Album Grid */}
                  <FlatList
                    data={getData()}
                    renderItem={renderItem}
                    keyExtractor={(item, index) => item._id || `empty-${index}`}
                    key={activeTab}
                    numColumns={activeTab === 'album' ? 3 : 1}
                    contentContainerStyle={activeTab === 'album' ? styles.albumGrid : styles.postsList}
                    onEndReached={activeTab === 'posts' ? loadMorePosts : undefined}
                    onEndReachedThreshold={0.5}
                    showsVerticalScrollIndicator={false}
                    ListFooterComponent={activeTab === 'posts' && loadingPosts ? (
                      <ActivityIndicator size="small" color={primaryColor} style={styles.loadingMore} />
                    ) : null}
                  />
                </View>
              </View>
            </>
          )}
      </SafeAreaView>
    </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerBackground: { position: 'absolute', top: 60, left: 0, right: 0, height: 200, zIndex: -1 },
  navHeader: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  backButton: { padding: spacing.xs },
  content: { padding: spacing.lg },
  profileHeader: { alignItems: 'center', marginBottom: spacing.lg },
  avatarWrapper: { marginBottom: spacing.md, ...shadows.lg },
  avatar: { width: 120, height: 120, borderRadius: 60, borderWidth: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs },
  username: { fontWeight: 'bold' },
  bio: { textAlign: 'center', color: '#666', marginBottom: spacing.sm },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statsBar: { flexDirection: 'row', borderRadius: borderRadius.lg, padding: spacing.md, width: '100%', marginBottom: spacing.xl, borderWidth: 1 },
  statBox: { flex: 1, alignItems: 'center' },
  actionButtons: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md, marginBottom: spacing.xl, pointerEvents: 'auto' },
  primaryButton: { paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, borderRadius: borderRadius.md, minWidth: 120, alignItems: 'center' },
  secondaryButton: { paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center', minWidth: 120 },
  blockButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: 'white', fontWeight: 'bold' },
  section: { marginBottom: spacing.lg },
  sectionTitle: { fontWeight: 'bold', marginBottom: spacing.md },
  interestsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  interestChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.round },
  tabsContainer: { flexDirection: 'row', borderBottomWidth: 1, marginBottom: spacing.md },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm, gap: spacing.xs },
  tabText: { fontSize: typography.sizes.body2, fontFamily: typography.families.medium },
  postsList: { paddingBottom: spacing.xl },
  albumGrid: { paddingBottom: spacing.xl },
  postItem: { padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderRadius: borderRadius.md },
  postContent: { marginBottom: spacing.sm },
  postImage: { width: '100%', height: 200, borderRadius: borderRadius.md, marginBottom: spacing.sm },
  postStats: { flexDirection: 'row', gap: spacing.md },
  postStat: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  postStatText: { fontSize: typography.sizes.caption },
  albumItem: { width: (width - spacing.lg * 2 - spacing.sm * 2) / 3, height: (width - spacing.lg * 2 - spacing.sm * 2) / 3, margin: spacing.xs },
  albumImage: { width: '100%', height: '100%', borderRadius: borderRadius.sm },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: spacing.xxl },
  emptyText: { fontSize: typography.sizes.body1, fontFamily: typography.families.medium, marginTop: spacing.md },
  loadingMore: { paddingVertical: spacing.md },
});
