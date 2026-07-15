import { FeedCard } from '@/app/chat/FeedCard.component';
import { ImageViewerModal } from '@/components/image-viewer-modal';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { borderRadius, shadows, spacing, typography } from '@/constants/design-tokens';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeColor } from '@/hooks/use-theme-color';
import { CustomAlert } from '@/utils/alert';
import { chatAPI, getImageUrl, postAPI, userAPI } from '@/utils/api';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';



interface UserProfile {
  _id: string;
  username: string;
  bio?: string;
  profilePhoto?: string;
  coverPhoto?: string;
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
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const isOwnProfile = currentUser?._id === id;

  const backgroundColor = useThemeColor('background');
  const primaryColor = useThemeColor('primary');
  const textColor = useThemeColor('text');
  const lightTextColor = useThemeColor('lightText');
  const surfaceColor = useThemeColor('surface');
  const borderColor = useThemeColor('border');
  const white = useThemeColor('white');
  const errorColor = useThemeColor('error');
  const cardBackgroundColor = useThemeColor('surface');

  const fetchProfile = useCallback(async () => {
    if (!id || !currentUser?._id) return;

    if (id === 'anonymous') {
      setIsLoading(false);
      Alert.alert('Anonymous User', 'This profile is anonymous and cannot be viewed.', [
        { text: 'OK', onPress: () => router.back() }
      ]);
      return;
    }

    setIsLoading(true);
    try {
      const [userRes, myProfileRes] = await Promise.all([
        userAPI.getProfile(id as string),
        userAPI.getProfile(currentUser._id)
      ]);

      const targetData = userRes.data;
      if (!targetData) {
        setProfile(null);
        setIsLoading(false);
        Alert.alert('Profile Not Found', 'This profile is no longer available.', [
          { text: 'OK', onPress: () => router.back() }
        ]);
        return;
      }

      setProfile(targetData);
      setStats({
        posts: targetData.posts?.length || 0,
        friends: targetData.friends?.length || 0
      });

      // Determine connection status
      const targetId = targetData._id;
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
      console.log('Fetching posts for user:', id, 'page:', page);
      const response = await postAPI.getUserPosts(id as string, page, 20);
      console.log('Posts response:', response.data);
      const { posts: newPosts, hasMore } = response.data;
      console.log('New posts:', newPosts);
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
      const response = await userAPI.getAlbum(id as string, 1, 30);
      setAlbum(response.data.data || []);
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
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  };

  const handleAcceptRequest = async () => {
    if (!currentUser?._id || !profile) return;
    try {
      await userAPI.acceptFriendRequest(currentUser._id, profile._id);
      await fetchProfile();
      Alert.alert('Success', 'Friend request accepted');
    } catch (error: any) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  };

  const handleCancelRequest = async () => {
    if (!currentUser?._id || !profile) return;
    try {
      await userAPI.cancelFriendRequest(currentUser._id, profile._id);
      await fetchProfile();
      Alert.alert('Success', 'Friend request cancelled');
    } catch (error: any) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  };

  const handleUnfriend = async () => {
    if (!currentUser?._id || !profile) return;

    Alert.alert(
      'Unfriend User',
      `Are you sure you want to unfriend ${profile.username}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unfriend',
          style: 'destructive',
          onPress: async () => {
            try {
              await userAPI.unfriend(currentUser._id, profile._id);
              await fetchProfile();
              Alert.alert('Success', `${profile.username} has been unfriended`);
            } catch (error: any) {
              Alert.alert('Error', 'Something went wrong. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleMessage = async () => {
    if (!currentUser?._id || !profile) return;
    try {
        const response = await chatAPI.getUserChats(currentUser._id, 1, 50);
        const chats = response.data.data || [];
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

    CustomAlert.show({
      type: 'confirm',
      title: 'Block User',
      message: `Are you sure you want to block ${profile.username}? This will remove them from your friends and prevent them from contacting you.`,
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await userAPI.blockUser(currentUser._id, profile._id);
              CustomAlert.success('Success', `${profile.username} has been blocked`);
              router.back();
            } catch (error) {
              console.error('Error blocking user:', error);
              CustomAlert.error('Error', 'Failed to block user');
            }
          }
        }
      ]
    });
  };

  const renderPostItem = ({ item }: { item: Post }) => {
    // Ensure post has author information (since it's a user's profile, author is the profile user)
    const postWithAuthor = {
      ...item,
      author: {
        _id: profile?._id || '',
        username: profile?.username || '',
        profilePhoto: profile?.profilePhoto,
        avatar: profile?.profilePhoto
      },
      updatedAt: item.createdAt || new Date().toISOString()
    };

    return (
      <FeedCard
        key={item._id}
        post={postWithAuthor as any}
        currentUserId={currentUser?._id || ''}
      />
    );
  };

  const getPostsData = () => posts.length > 0 ? posts : null;
  const getAlbumData = () => album.length > 0 ? album : null;

  const handleDeleteAlbumPhoto = async (photoId: string) => {
    if (!currentUser?._id) return;
    CustomAlert.confirm(
      'Delete Photo',
      'Are you sure you want to delete this photo?',
      async () => {
        try {
          CustomAlert.loading('Deleting photo...', 'Please wait');
          await userAPI.deleteAlbumPhoto(currentUser._id, photoId);
          setAlbum(prev => prev.filter(p => p._id !== photoId));
          setSelectedImage(null);
          setSelectedPhotoId(null);
          CustomAlert.success('Deleted', 'Photo has been deleted');
        } catch (error) {
          CustomAlert.error('Error', 'Failed to delete photo');
        }
      }
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor }}>
      <Stack.Screen options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />

      {/* Loading View */}
      <Animated.View style={[
        styles.loadingContainer, 
        { 
          opacity: loadingOpacity, 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          zIndex: 1,
          pointerEvents: isLoading ? 'auto' : 'none'
        }
      ]}>
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
            <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {/* Cover Photo */}
              <View style={styles.coverPhotoContainer}>
                {profile.coverPhoto ? (
                  <Image source={{ uri: getImageUrl(profile.coverPhoto) }} style={styles.coverPhoto} />
                ) : (
                  <LinearGradient colors={[primaryColor + '20', primaryColor + '10']} style={styles.coverPhotoPlaceholder} />
                )}
              </View>
              
              <View style={styles.content}>
                <View style={styles.profileHeader}>
                  <View style={styles.avatarWrapper}>
                    <TouchableOpacity 
                        onPress={() => setSelectedImage(getImageUrl(profile.profilePhoto) || null)}
                        activeOpacity={0.8}
                    >
                        {profile.profilePhoto ? (
                            <Image source={{ uri: getImageUrl(profile.profilePhoto) }} style={[styles.avatar, { borderColor: primaryColor }]} />
                        ) : (
                            <View style={[styles.avatarPlaceholder, { borderColor: primaryColor, backgroundColor: cardBackgroundColor }]}>
                                <IconSymbol name="person.fill" size={50} color={lightTextColor} />
                            </View>
                        )}
                    </TouchableOpacity>
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
                      <TouchableOpacity style={[styles.secondaryButton, { borderColor }]} onPress={() => handleUnfriend()} activeOpacity={0.7}>
                        <ThemedText style={{ color: errorColor }}>Unfriend</ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.blockButton, { borderColor: errorColor }]} onPress={handleBlock} activeOpacity={0.7}>
                        <IconSymbol name="person.slash" size={18} color={errorColor} />
                      </TouchableOpacity>
                    </>
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
              </View>

              {/* Posts/Album Grid */}
              {activeTab === 'posts' && (
                <View style={styles.postsList}>
                  {posts.length > 0 ? (
                    posts.map((p) => renderPostItem({ item: p }))
                  ) : (
                    <View style={styles.emptyContainer}>
                      <IconSymbol name="camera" size={48} color={lightTextColor} />
                      <ThemedText style={[styles.emptyText, { color: textColor }]}>No posts yet</ThemedText>
                    </View>
                  )}
                </View>
              )}

              {activeTab !== 'posts' && (
                <View />
              )}

              {/* Album empty/loading state handled in album section below */
              /* (removed erroneous extra wrapper that broke JSX structure) */}
              {activeTab === 'album' && (
                <View style={styles.albumGrid}>
                  {getAlbumData() ? (
                    album.map((photo) => (
                      <TouchableOpacity
                        key={photo._id}
                        style={styles.albumItem}
                        onPress={() => { setSelectedImage(getImageUrl(photo.image) || null); setSelectedPhotoId(photo._id); }}
                        activeOpacity={0.8}
                      >
                        <Image source={{ uri: getImageUrl(photo.image) }} style={styles.albumImage} resizeMode="cover" />
                      </TouchableOpacity>
                    ))
                  ) : (
                    <View style={styles.emptyContainer}>
                      <IconSymbol name="photo" size={48} color={lightTextColor} />
                      <ThemedText style={[styles.emptyText, { color: textColor }]}>No photos in album</ThemedText>
                    </View>
                  )}
                </View>
              )}

              {/* Image Modal */}
              <ImageViewerModal 
                visible={!!selectedImage} 
                onClose={() => { setSelectedImage(null); setSelectedPhotoId(null); }} 
                imageUrl={selectedImage} 
                onDelete={isOwnProfile && selectedPhotoId ? () => handleDeleteAlbumPhoto(selectedPhotoId) : null} 
              />
            </ScrollView>
          )}
      </SafeAreaView>
    </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  coverPhotoContainer: { width: '100%', height: 180, position: 'relative' },
  coverPhoto: { width: '100%', height: '100%', resizeMode: 'cover' },
  coverPhotoPlaceholder: { width: '100%', height: '100%' },
  headerBackground: { position: 'absolute', top: 60, left: 0, right: 0, height: 200, zIndex: -1 },
  navHeader: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  backButton: { padding: spacing.xs },
  scrollContent: { flex: 1 },
  content: { flex: 1, paddingHorizontal: spacing.lg },
  profileHeader: { alignItems: 'center', marginTop: -60, paddingBottom: spacing.lg },
  avatarWrapper: { marginBottom: spacing.md, ...shadows.lg },
  avatar: { width: 120, height: 120, borderRadius: 60, borderWidth: 4 },
  avatarPlaceholder: { width: 120, height: 120, borderRadius: 60, borderWidth: 4, justifyContent: 'center', alignItems: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs, flexWrap: 'wrap', justifyContent: 'center' },
  username: { fontWeight: 'bold', textAlign: 'center' },
  bio: { textAlign: 'center', color: '#666', marginBottom: spacing.sm, paddingHorizontal: spacing.sm },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statsBar: { 
    flexDirection: 'row', 
    borderRadius: borderRadius.lg, 
    padding: spacing.xl, 
    width: '100%', 
    marginBottom: spacing.xxl, 
    borderWidth: 1
  },
  statBox: { flex: 1, alignItems: 'center' },
  actionButtons: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    gap: spacing.md, 
    marginBottom: spacing.xxl, 
    pointerEvents: 'auto', 
    flexWrap: 'wrap', 
    paddingHorizontal: spacing.sm 
  },
  primaryButton: { 
    paddingHorizontal: spacing.xl, 
    paddingVertical: spacing.md, 
    borderRadius: borderRadius.md, 
    alignItems: 'center', 
    minWidth: 120
  },
  secondaryButton: { 
    paddingHorizontal: spacing.xl, 
    paddingVertical: spacing.md, 
    borderRadius: borderRadius.md, 
    borderWidth: 1, 
    alignItems: 'center', 
    justifyContent: 'center', 
    minWidth: 120
  },
  blockButton: { 
    paddingHorizontal: spacing.md, 
    paddingVertical: spacing.md, 
    borderRadius: borderRadius.md, 
    borderWidth: 1, 
    alignItems: 'center', 
    justifyContent: 'center'
  },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: typography.sizes.body1 },
  section: { marginBottom: spacing.xxl },
  sectionTitle: { fontWeight: 'bold', marginBottom: spacing.md },
  interestsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  interestChip: { 
    paddingHorizontal: spacing.md, 
    paddingVertical: spacing.sm, 
    borderRadius: borderRadius.round
  },
  tabsContainer: { flexDirection: 'row', borderBottomWidth: 1, marginBottom: spacing.md },
  tab: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: spacing.md, 
    gap: spacing.sm 
  },
  tabText: { fontSize: typography.sizes.body1, fontFamily: typography.families.medium },
  postsList: { paddingBottom: spacing.xxl, paddingHorizontal: spacing.sm },
  albumGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingBottom: spacing.xxl, paddingHorizontal: spacing.xs },
  postItem: { 
    padding: spacing.xl, 
    marginBottom: spacing.md, 
    borderWidth: 1, 
    borderRadius: borderRadius.lg
  },
  postContent: { marginBottom: spacing.sm },
  postImage: { width: '100%', height: 220, borderRadius: borderRadius.lg, marginBottom: spacing.md },
  postStats: { flexDirection: 'row', gap: spacing.md },
  postStat: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  postStatText: { fontSize: typography.sizes.caption },
  albumItem: { width: '33%', aspectRatio: 1, padding: 4 },
  albumImage: { 
    width: '100%', 
    height: '100%', 
    borderRadius: borderRadius.md
  },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: spacing.xxl },
  emptyText: { fontSize: typography.sizes.body1, fontFamily: typography.families.medium, marginTop: spacing.md },
  loadingMore: { paddingVertical: spacing.md },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContainer: {
    width: '90%',
    height: '80%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.lg,
  },
  closeButton: {
    position: 'absolute',
    top: -40,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
