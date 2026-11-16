import { FeedCard } from '@/app/chat/FeedCard.component';
import { ImageViewerModal } from '@/components/image-viewer-modal';
import { ReportUserModal } from '@/components/report-user-modal';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { OptimizedStorageImage } from '@/components/optimized-storage-image';
import { borderRadius, shadows, spacing, typography } from '@/constants/design-tokens';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeColor } from '@/hooks/use-theme-color';
import { CustomAlert } from '@/utils/alert';
import { chatAPI, getImageUrl, postAPI, userAPI } from '@/utils/api';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Modal, ScrollView, StyleSheet, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';



interface UserProfile {
  _id: string;
  username: string;
  bio?: string;
  profilePhoto?: string;
  coverPhoto?: string;
  avatar?: string;
  location?: string;
  school?: string;
  educationLevel?: string;
  interests?: string[];
  friendsCount: number;
  photosCount: number;
  connectionStatus: 'self' | 'friend' | 'requested' | 'received' | 'none';
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
  const { user: currentUser, isLoading: isAuthLoading } = useAuth();
  const profileId = Array.isArray(id) ? id[0] : id;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'self' | 'friend' | 'requested' | 'received' | 'none'>('none');
  const [stats, setStats] = useState({ posts: 0, friends: 0 });
  const loadingOpacity = useRef(new Animated.Value(1)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadedPostMediaIds, setLoadedPostMediaIds] = useState<Set<string>>(() => new Set());
  const [album, setAlbum] = useState<AlbumPhoto[]>([]);
  const [albumTotal, setAlbumTotal] = useState(0);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [postsPage, setPostsPage] = useState(1);
  const postsLoadingRef = useRef(false);
  const postsRequestId = useRef(0);
  const postsLoadedForProfile = useRef<string | null>(null);
  const postsListLayout = useRef({ y: 0, height: 0 });
  const [activeTab, setActiveTab] = useState<'posts' | 'album'>('posts');
  const [loadingAlbum, setLoadingAlbum] = useState(false);
  const [albumError, setAlbumError] = useState<string | null>(null);
  const [albumPage, setAlbumPage] = useState(1);
  const [hasMoreAlbum, setHasMoreAlbum] = useState(true);
  const [albumLoadedForProfile, setAlbumLoadedForProfile] = useState<string | null>(null);
  const albumLoadingRef = useRef(false);
  const albumRequestId = useRef(0);
  const albumGridLayout = useRef({ y: 0, height: 0 });
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [playingPostId, setPlayingPostId] = useState<string | null>(null);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [hasOpenedReportModal, setHasOpenedReportModal] = useState(false);
  const postPositions = useRef<Map<string, { y: number; height: number }>>(new Map());
  const profileRequestId = useRef(0);
  const isOwnProfile = currentUser?._id === profileId;

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
    const requestId = ++profileRequestId.current;
    if (!profileId) {
      setIsLoading(false);
      return;
    }
    if (!currentUser?._id) {
      if (!isAuthLoading) setIsLoading(false);
      return;
    }

    if (profileId === 'anonymous') {
      setIsLoading(false);
      Alert.alert('Anonymous User', 'This profile is anonymous and cannot be viewed.', [
        { text: 'OK', onPress: () => router.back() }
      ]);
      return;
    }

    setIsLoading(true);
    setProfile(null);
    setProfileError(null);
    setConnectionStatus('none');
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      const userRes = await Promise.race([
        userAPI.getProfileSummary(profileId, true),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('Profile request timed out')), 15000);
        }),
      ]);
      if (requestId !== profileRequestId.current) return;
      const targetData = userRes.data;
      if (!targetData) {
        setProfile(null);
        setProfileError('This profile is no longer available.');
        return;
      }

      setProfile(targetData);
      setStats({
        posts: 0,
        friends: targetData.friendsCount || 0
      });
      setAlbumTotal(targetData.photosCount || 0);
      setConnectionStatus(targetData.connectionStatus || 'none');
    } catch (error) {
      if (requestId !== profileRequestId.current) return;
      console.error('Error fetching user profile:', error);
      setProfileError('Could not load this profile. Check your connection and try again.');
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      if (requestId === profileRequestId.current) setIsLoading(false);
    }
  }, [profileId, currentUser?._id, isAuthLoading, router]);

  const fetchPosts = useCallback(async (page: number = 1) => {
    const profileId = Array.isArray(id) ? id[0] : id;
    if (!profileId) return;
    const requestId = page === 1 ? ++postsRequestId.current : postsRequestId.current;
    if (page === 1) {
      setPosts([]);
      setLoadedPostMediaIds(new Set());
      setPostsPage(1);
      setHasMorePosts(true);
      setPostsError(null);
      postPositions.current.clear();
    } else {
      setPostsError(null);
    }
    postsLoadingRef.current = true;
    setLoadingPosts(true);
    try {
      const response = await postAPI.getUserPosts(profileId, page, 10, true, true);
      if (requestId !== postsRequestId.current) return;
      const data = response.data || {};
      const newPosts = Array.isArray(data.posts) ? data.posts : Array.isArray(data) ? data : [];
      const hasMore = typeof data.hasMore === 'boolean' ? data.hasMore : false;
      const total = data.total;
      if (page === 1) {
        setPosts(newPosts);
        setLoadedPostMediaIds(new Set(newPosts.slice(0, 1).map((post: Post) => post._id)));
        postsLoadedForProfile.current = profileId;
        // Count comes from the posts collection (soft-delete aware) so the stat
        // always matches what the grid can actually load.
        if (typeof total === 'number') {
          setStats(prev => ({ ...prev, posts: total }));
        }
      } else {
        setPosts(prev => [...prev, ...newPosts]);
      }
      setHasMorePosts(hasMore);
      setPostsPage(page);
    } catch (error) {
      if (requestId !== postsRequestId.current) return;
      console.error('Error fetching posts:', error);
      setPostsError("Couldn't load posts. Check your connection and try again.");
    } finally {
      if (requestId === postsRequestId.current) {
        postsLoadingRef.current = false;
        setLoadingPosts(false);
      }
    }
  }, [id]);

  const fetchAlbum = useCallback(async (page: number = 1) => {
    const profileId = Array.isArray(id) ? id[0] : id;
    if (!profileId || albumLoadingRef.current) return;
    const requestId = page === 1 ? ++albumRequestId.current : albumRequestId.current;
    if (page === 1) {
      setAlbum([]);
      setAlbumTotal(0);
      setAlbumPage(1);
      setHasMoreAlbum(true);
      setAlbumLoadedForProfile(null);
    }
    setAlbumError(null);
    albumLoadingRef.current = true;
    setLoadingAlbum(true);
    try {
      const response = await userAPI.getAlbum(profileId, page, 12, true);
      if (requestId !== albumRequestId.current) return;
      const newPhotos = Array.isArray(response.data?.data) ? response.data.data : [];
      setAlbum(prev => page === 1 ? newPhotos : [...prev, ...newPhotos]);
      if (typeof response.data?.pagination?.totalItems === 'number') {
        setAlbumTotal(response.data.pagination.totalItems);
      }
      setAlbumPage(page);
      setHasMoreAlbum(response.data?.pagination?.hasNextPage === true);
      setAlbumLoadedForProfile(profileId);
    } catch (error) {
      if (requestId !== albumRequestId.current) return;
      console.error('Error fetching album:', error);
      setAlbumError("Couldn't load photos. Check your connection and try again.");
      if (page === 1) setAlbum([]);
    } finally {
      if (requestId === albumRequestId.current) {
        albumLoadingRef.current = false;
        setLoadingAlbum(false);
      }
    }
  }, [id]);

  const loadMorePosts = useCallback(() => {
    if (!postsLoadingRef.current && hasMorePosts) {
      void fetchPosts(postsPage + 1);
    }
  }, [fetchPosts, hasMorePosts, postsPage]);

  const loadMoreAlbum = useCallback(() => {
    if (!albumLoadingRef.current && hasMoreAlbum) {
      void fetchAlbum(albumPage + 1);
    }
  }, [albumPage, fetchAlbum, hasMoreAlbum]);

  useEffect(() => {
    void fetchProfile();
    return () => {
      profileRequestId.current += 1;
      postsRequestId.current += 1;
      albumRequestId.current += 1;
      postsLoadingRef.current = false;
      albumLoadingRef.current = false;
    };
  }, [fetchProfile]);

  useEffect(() => {
    if (profileId && profile?._id === profileId && postsLoadedForProfile.current !== profileId) {
      fetchPosts(1);
    }
  }, [profile?._id, profileId, fetchPosts]);

  useEffect(() => {
    if (profile && activeTab === 'album' && albumLoadedForProfile !== profile._id) {
      void fetchAlbum(1);
    }
  }, [activeTab, albumLoadedForProfile, fetchAlbum, profile]);

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
      CustomAlert.success('Success', 'Friend request sent');
    } catch (error: any) {
      CustomAlert.error('Error', 'Something went wrong. Please try again.');
    }
  };

  const handleAcceptRequest = async () => {
    if (!currentUser?._id || !profile) return;
    try {
      await userAPI.acceptFriendRequest(currentUser._id, profile._id);
      await fetchProfile();
      CustomAlert.success('Success', 'Friend request accepted');
    } catch (error: any) {
      CustomAlert.error('Error', 'Something went wrong. Please try again.');
    }
  };

  const handleCancelRequest = async () => {
    if (!currentUser?._id || !profile) return;
    try {
      await userAPI.cancelFriendRequest(currentUser._id, profile._id);
      await fetchProfile();
      CustomAlert.success('Success', 'Friend request cancelled');
    } catch (error: any) {
      CustomAlert.error('Error', 'Something went wrong. Please try again.');
    }
  };

  const handleUnfriend = async () => {
    if (!currentUser?._id || !profile) return;

    CustomAlert.show({
      type: 'confirm',
      title: 'Unfriend',
      message: `Are you sure you want to remove ${profile.username} as a friend?`,
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unfriend',
          style: 'destructive',
          onPress: async () => {
            try {
              await userAPI.unfriend(currentUser._id, profile._id);
              await fetchProfile();
              CustomAlert.success('Success', `${profile.username} has been unfriended`);
            } catch (error: any) {
              CustomAlert.error('Error', 'Something went wrong. Please try again.');
            }
          }
        }
      ],
      dismissable: true
    });
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

  const handleReport = () => {
    setOptionsVisible(false);
    setHasOpenedReportModal(true);
    setReportModalVisible(true);
  };

  const renderPostItem = ({ item }: { item: Post }) => {
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
      <View
        onLayout={(e) => {
          postPositions.current.set(item._id, {
            y: e.nativeEvent.layout.y,
            height: e.nativeEvent.layout.height,
          });
        }}
      >
        <FeedCard
          post={postWithAuthor as any}
          currentUserId={currentUser?._id || ''}
          shouldPlay={item._id === playingPostId}
          shouldLoadMedia={loadedPostMediaIds.has(item._id)}
          compactInteractions
        />
      </View>
    );
  };

  const getPostsData = () => posts.length > 0 ? posts : null;
  const getAlbumData = () => album.length > 0 ? album : null;

  const handleScroll = useCallback((event: any) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const viewportHeight = event.nativeEvent.layoutMeasurement.height;
    const visibleTop = offsetY;
    const visibleBottom = offsetY + viewportHeight;

    if (activeTab === 'posts') {
      let bestId: string | null = null;
      let bestOverlap = 0;

      postPositions.current.forEach((pos, id) => {
        const postTop = postsListLayout.current.y + pos.y;
        const postBottom = postTop + pos.height;
        const overlapTop = Math.max(visibleTop, postTop);
        const overlapBottom = Math.min(visibleBottom, postBottom);
        const overlap = Math.max(0, overlapBottom - overlapTop);
        if (overlap > bestOverlap) {
          bestOverlap = overlap;
          bestId = id;
        }
      });

      if (bestId && bestOverlap > 0) {
        setPlayingPostId(bestId);
        const visiblePostIndex = posts.findIndex(post => post._id === bestId);
        const nextMediaIds = new Set(
          visiblePostIndex >= 0
            ? posts.slice(visiblePostIndex, visiblePostIndex + 2).map(post => post._id)
            : [bestId]
        );
        setLoadedPostMediaIds(prev => {
          if (
            prev.size === nextMediaIds.size &&
            [...prev].every(postId => nextMediaIds.has(postId))
          ) {
            return prev;
          }
          return nextMediaIds;
        });
      } else {
        setPlayingPostId(null);
      }
    }

    const postsBottom = postsListLayout.current.y + postsListLayout.current.height;
    if (
      activeTab === 'posts' &&
      hasMorePosts &&
      !postsLoadingRef.current &&
      visibleBottom >= postsBottom - viewportHeight * 1.5
    ) {
      loadMorePosts();
    }
    const albumBottom = albumGridLayout.current.y + albumGridLayout.current.height;
    if (
      activeTab === 'album' &&
      hasMoreAlbum &&
      !albumLoadingRef.current &&
      visibleBottom >= albumBottom - viewportHeight * 1.5
    ) {
      loadMoreAlbum();
    }
  }, [activeTab, hasMoreAlbum, hasMorePosts, loadMoreAlbum, loadMorePosts, posts]);

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
          setAlbumTotal(prev => Math.max(0, prev - 1));
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
      <Stack.Screen options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />

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
          pointerEvents: 'none'
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
            {profile && !isOwnProfile && (
              <TouchableOpacity onPress={() => setOptionsVisible(true)} style={styles.backButton} activeOpacity={0.7}>
                <IconSymbol name="ellipsis" size={26} color={textColor} />
              </TouchableOpacity>
            )}
          </View>

          {!isLoading && !profile && (
            <View style={styles.profileLoadError}>
              <ThemedText style={{ color: textColor, textAlign: 'center' }}>
                {profileError || 'Unable to load this profile.'}
              </ThemedText>
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: primaryColor }]}
                onPress={() => void fetchProfile()}
                activeOpacity={0.7}
              >
                <ThemedText style={styles.buttonText}>Try Again</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
                <ThemedText style={{ color: textColor }}>Go Back</ThemedText>
              </TouchableOpacity>
            </View>
          )}
  
          {profile && (
            <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false} onScroll={handleScroll} scrollEventThrottle={16}>
              {/* Cover Photo */}
              <View style={styles.coverPhotoContainer}>
                {profile.coverPhoto ? (
                  <OptimizedStorageImage imagePath={profile.coverPhoto} transform={{ width: 1280, quality: 75 }} style={styles.coverPhoto} cachePolicy="memory-disk" contentFit="cover" />
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
                            <OptimizedStorageImage imagePath={profile.profilePhoto} transform={{ width: 256, height: 256, quality: 70, resize: 'cover' }} style={[styles.avatar, { borderColor: primaryColor }]} cachePolicy="memory-disk" contentFit="cover" />
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
                  {(profile.school || profile.educationLevel) && (
                    <View style={styles.locationRow}>
                      <ThemedText style={{ color: lightTextColor }}>
                        {[profile.educationLevel, profile.school].filter(Boolean).join(' at ')}
                      </ThemedText>
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
                        <IconSymbol name="person.remove" size={18} color={errorColor} />
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
                    <ThemedText type="title" style={{ fontFamily: typography.families.bold, color: primaryColor }}>{albumTotal}</ThemedText>
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
                <View
                  style={styles.postsList}
                  onLayout={(event) => {
                    postsListLayout.current = {
                      y: event.nativeEvent.layout.y,
                      height: event.nativeEvent.layout.height,
                    };
                  }}
                >
                  {posts.length > 0 ? (
                    posts.map((p) => renderPostItem({ item: p }))
                  ) : (
                    <View style={styles.emptyContainer}>
                      {postsError ? (
                        <>
                          <ThemedText style={[styles.emptyText, { color: textColor }]}>{postsError}</ThemedText>
                          <TouchableOpacity onPress={() => void fetchPosts(postsPage || 1)} activeOpacity={0.7}>
                            <ThemedText style={[styles.emptyText, { color: primaryColor }]}>Try Again</ThemedText>
                          </TouchableOpacity>
                        </>
                      ) : (
                        <>
                          <IconSymbol name="camera" size={48} color={lightTextColor} />
                          <ThemedText style={[styles.emptyText, { color: textColor }]}>No posts yet</ThemedText>
                        </>
                      )}
                    </View>
                  )}
                  {loadingPosts && <ActivityIndicator style={styles.postsLoading} color={primaryColor} />}
                  {posts.length > 0 && postsError && (
                    <TouchableOpacity style={styles.postsLoading} onPress={() => void fetchPosts(postsPage + 1)} activeOpacity={0.7}>
                      <ThemedText style={{ color: primaryColor }}>{postsError} Try Again</ThemedText>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {activeTab !== 'posts' && (
                <View />
              )}

              {/* Album empty/loading state handled in album section below */
              /* (removed erroneous extra wrapper that broke JSX structure) */}
              {activeTab === 'album' && (
                <View
                  style={styles.albumGrid}
                  onLayout={(event) => {
                    albumGridLayout.current = {
                      y: event.nativeEvent.layout.y,
                      height: event.nativeEvent.layout.height,
                    };
                  }}
                >
                  {getAlbumData() ? (
                    album.map((photo) => (
                      <TouchableOpacity
                        key={photo._id}
                        style={styles.albumItem}
                        onPress={() => { setSelectedImage(getImageUrl(photo.image) || null); setSelectedPhotoId(photo._id); }}
                        activeOpacity={0.8}
                      >
                        <OptimizedStorageImage imagePath={photo.image} transform={{ width: 480, quality: 75 }} style={styles.albumImage} cachePolicy="memory-disk" contentFit="cover" />
                      </TouchableOpacity>
                    ))
                  ) : (
                    <View style={styles.emptyContainer}>
                      {loadingAlbum ? (
                        <ActivityIndicator color={primaryColor} />
                      ) : albumError ? (
                        <>
                          <ThemedText style={[styles.emptyText, { color: textColor }]}>{albumError}</ThemedText>
                          <TouchableOpacity onPress={() => void fetchAlbum(albumPage || 1)} activeOpacity={0.7}>
                            <ThemedText style={[styles.emptyText, { color: primaryColor }]}>Try Again</ThemedText>
                          </TouchableOpacity>
                        </>
                      ) : (
                        <>
                          <IconSymbol name="photo" size={48} color={lightTextColor} />
                          <ThemedText style={[styles.emptyText, { color: textColor }]}>No photos in album</ThemedText>
                        </>
                      )}
                    </View>
                  )}
                  {loadingAlbum && album.length > 0 && <ActivityIndicator style={styles.postsLoading} color={primaryColor} />}
                  {album.length > 0 && albumError && (
                    <TouchableOpacity style={styles.postsLoading} onPress={() => void fetchAlbum(albumPage + 1)} activeOpacity={0.7}>
                      <ThemedText style={{ color: primaryColor }}>{albumError} Try Again</ThemedText>
                    </TouchableOpacity>
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

      <Modal visible={optionsVisible} transparent animationType="fade" onRequestClose={() => setOptionsVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setOptionsVisible(false)}>
          <View style={styles.optionsOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.optionsContainer, { backgroundColor: surfaceColor }]}>
                <TouchableOpacity style={[styles.optionRow, { borderColor }]} onPress={handleReport} activeOpacity={0.7}>
                  <IconSymbol name="flag" size={20} color={errorColor} />
                  <ThemedText style={[styles.optionLabel, { color: errorColor }]}>Report User</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelOption} onPress={() => setOptionsVisible(false)} activeOpacity={0.7}>
                  <ThemedText style={{ color: textColor }}>Cancel</ThemedText>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {hasOpenedReportModal && profile && (
        <ReportUserModal
          visible={reportModalVisible}
          onClose={() => setReportModalVisible(false)}
          targetUserId={profile._id}
          targetUsername={profile.username}
        />
      )}
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
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm
  },
  backButton: { padding: spacing.xs },
  profileLoadError: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xl },
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
  postsLoading: { marginVertical: spacing.lg },
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
  optionsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  optionsContainer: {
    width: '80%',
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    elevation: 5
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md
  },
  optionLabel: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.families.medium
  },
  cancelOption: {
    alignItems: 'center',
    paddingVertical: spacing.md
  },
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
