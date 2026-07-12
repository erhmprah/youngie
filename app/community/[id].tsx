import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert, FlatList, Platform, Modal, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import * as Calendar from 'expo-calendar';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { spacing, borderRadius, typography, shadows } from '@/constants/design-tokens';
import { communityAPI, getImageUrl } from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';
import { CreateEventModal } from '@/components/create-event-modal';
import { getRelativeTime } from '@/utils/helpers';
import { CustomAlert } from '@/utils/alert';

interface CommunityEvent {
  _id: string;
  title: string;
  description: string;
  date: string;
  type: 'voice' | 'game' | 'meetup' | 'other';
  creator: { _id: string; username: string; profilePhoto?: string };
}

interface CommunityFeed {
  _id: string;
  community: string;
  author: { _id: string; username: string; profilePhoto?: string };
  content?: string;
  images?: string[];
  likes: Array<{ _id: string; username: string; profilePhoto?: string }>;
  createdAt: string;
}

export default function CommunityScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const router = useRouter();
  
  const [community, setCommunity] = useState<any>(null);
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [activeTab, setActiveTab] = useState<'feed' | 'events' | 'members'>('feed');
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [calendarModalVisible, setCalendarModalVisible] = useState(false);
  const [availableCalendars, setAvailableCalendars] = useState<Calendar.Calendar[]>([]);
  const [selectedEventForCalendar, setSelectedEventForCalendar] = useState<CommunityEvent | null>(null);

  const [feeds, setFeeds] = useState<CommunityFeed[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedPage, setFeedPage] = useState(1);
  const [feedHasMore, setFeedHasMore] = useState(false);
  const [feedContent, setFeedContent] = useState('');
  const [feedImages, setFeedImages] = useState<string[]>([]);
  const [feedPosting, setFeedPosting] = useState(false);

  const primaryColor = useThemeColor('primary');
  const textColor = useThemeColor('text');
  const lightTextColor = useThemeColor('lightText');
  const surfaceColor = useThemeColor('surface');
  const borderColor = useThemeColor('border');
  const white = useThemeColor('white');

  const fetchCommunityDetails = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      // Assuming these API endpoints exist or will be implemented
      const [commResponse, eventsResponse] = await Promise.all([
        communityAPI.getCommunity(id as string),
        communityAPI.getEvents ? communityAPI.getEvents(id as string) : Promise.resolve({ data: [] })
      ]);
      
      setCommunity(commResponse.data);
      setEvents(eventsResponse.data || []);
    } catch (error) {
      Alert.alert('Error', 'Could not load community details');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCommunityDetails();
  }, [fetchCommunityDetails]);

  // Debugging logs to help identify why the button isn't showing
  useEffect(() => {
    if (community && user) {
    }
  }, [community, user]);

  const getCreatorId = () => {
    const c = community?.creator;
    if (!c) return undefined;
    return typeof c === 'object' ? (c._id || c.id) : c;
  };

  const isAdmin = !!user?._id && String(getCreatorId()) === String(user._id);

  const isMember = !!user?._id && (community?.members || []).some(
    (m: any) => String(m?._id || m) === String(user?._id)
  );

  // Admin and approved members can create feed posts
  const canPostFeed = !!community && (isAdmin || isMember);

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'voice': return 'mic.fill';
      case 'game': return 'gamecontroller.fill';
      case 'meetup': return 'person.3.fill';
      default: return 'calendar';
    }
  };

  // ---- Community Feed ----

  const fetchFeed = useCallback(async (pageToLoad: number = 1, replace: boolean = true) => {
    if (!id) return;
    setFeedLoading(true);
    try {
      const response = await communityAPI.getFeed(id as string, pageToLoad, 20);
      const { feeds: newFeeds, hasMore } = response.data || { feeds: [], hasMore: false };
      setFeeds(prev => replace ? newFeeds : [...prev, ...newFeeds]);
      setFeedHasMore(hasMore);
      setFeedPage(pageToLoad);
    } catch (error: any) {
      if (error?.response?.status !== 403) {
        CustomAlert.error('Error', 'Could not load the community feed');
      }
    } finally {
      setFeedLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (activeTab === 'feed' && community) {
      fetchFeed(1);
    }
  }, [activeTab, community, fetchFeed]);

  const handlePickFeedImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 10 - feedImages.length,
    });
    if (!result.canceled) {
      const uris = result.assets.map(a => a.uri);
      setFeedImages(prev => [...prev, ...uris].slice(0, 10));
    }
  };

  const handleCreateFeed = async () => {
    if (!id) return;
    if (!feedContent.trim() && feedImages.length === 0) {
      CustomAlert.error('Error', 'Please add some content or an image to your post.');
      return;
    }
    setFeedPosting(true);
    try {
      const imageUrls: string[] = [];
      for (const uri of feedImages) {
        if (uri.startsWith('http') || uri.startsWith('/uploads')) {
          imageUrls.push(uri);
          continue;
        }
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
        const filename = `feed-image-${Date.now()}-${Math.random()}.jpg`;
        const upload = await communityAPI.uploadImageBase64({
          imageData: `data:image/jpeg;base64,${base64}`,
          filename,
        });
        if (upload?.imageUrl) imageUrls.push(upload.imageUrl);
      }

      await communityAPI.createFeed(id as string, {
        content: feedContent.trim() || undefined,
        images: imageUrls.length > 0 ? imageUrls : undefined,
      });

      setFeedContent('');
      setFeedImages([]);
      fetchFeed(1);
    } catch (error) {
      CustomAlert.error('Error', 'Failed to create feed post. Please try again.');
    } finally {
      setFeedPosting(false);
    }
  };

  const handleDeleteFeed = (feed: CommunityFeed) => {
    const isAuthor = String(feed.author._id) === String(user?._id);
    // Members can delete their own feed; admin can delete any feed
    if (!isAuthor && !isAdmin) return;

    CustomAlert.confirm(
      'Delete Post',
      'Are you sure you want to delete this feed post?',
      async () => {
        try {
          await communityAPI.deleteFeed(id as string, feed._id);
          setFeeds(prev => prev.filter(f => f._id !== feed._id));
        } catch (error) {
          CustomAlert.error('Error', 'Failed to delete feed post.');
        }
      }
    );
  };

  const handleToggleLike = async (feed: CommunityFeed) => {
    if (!canPostFeed) return;
    const optimisticLiked = !feed.likes.some(l => String(l._id) === String(user?._id));
    setFeeds(prev => prev.map(f => {
      if (f._id !== feed._id) return f;
      const likes = optimisticLiked
        ? [...f.likes, { _id: user!._id, username: user!.username, profilePhoto: user!.profilePhoto }]
        : f.likes.filter(l => String(l._id) !== String(user?._id));
      return { ...f, likes };
    }));
    try {
      await communityAPI.likeFeed(id as string, feed._id);
    } catch (error) {
      fetchFeed(1);
    }
  };

  const renderFeedItem = ({ item }: { item: CommunityFeed }) => {
    const isAuthor = String(item.author._id) === String(user?._id);
    const liked = item.likes.some(l => String(l._id) === String(user?._id));
    return (
      <View style={[styles.feedCard, { backgroundColor: surfaceColor, borderColor }]}>
        <View style={styles.feedHeader}>
          {item.author.profilePhoto ? (
            <Image source={{ uri: getImageUrl(item.author.profilePhoto) }} style={styles.feedAvatar} />
          ) : (
            <View style={[styles.feedAvatarPlaceholder, { backgroundColor: primaryColor + '20' }]}>
              <IconSymbol name="person.fill" size={16} color={primaryColor} />
            </View>
          )}
          <View style={styles.feedAuthorInfo}>
            <ThemedText type="body1" style={{ fontFamily: typography.families.bold }}>{item.author.username}</ThemedText>
            <ThemedText type="caption" style={{ color: lightTextColor }}>{getRelativeTime(item.createdAt)}</ThemedText>
          </View>
          {(isAuthor || isAdmin) && (
            <TouchableOpacity onPress={() => handleDeleteFeed(item)} style={styles.feedDeleteButton}>
              <IconSymbol name="trash" size={18} color={lightTextColor} />
            </TouchableOpacity>
          )}
        </View>

        {item.content ? (
          <ThemedText type="body1" style={{ color: textColor, marginBottom: item.images?.length ? spacing.md : 0 }}>
            {item.content}
          </ThemedText>
        ) : null}

        {item.images && item.images.length > 0 && (
          <View style={[
            styles.feedImages,
            item.images.length === 1 ? styles.feedImagesSingle : {},
          ]}>
            {item.images.map((img, idx) => (
              <Image
                key={idx}
                source={{ uri: getImageUrl(img) }}
                style={item.images!.length === 1 ? styles.feedImageSingle : styles.feedImage}
              />
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.feedLikeRow} onPress={() => handleToggleLike(item)}>
          <IconSymbol name={liked ? 'heart.fill' : 'heart'} size={18} color={liked ? '#FF3B30' : lightTextColor} />
          <ThemedText type="caption" style={{ color: lightTextColor, marginLeft: spacing.xs }}>
            {item.likes.length} {item.likes.length === 1 ? 'Like' : 'Likes'}
          </ThemedText>
        </TouchableOpacity>
      </View>
    );
  };


  const initiateAddToCalendar = async (event: CommunityEvent) => {
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Calendar permission is required to add events.');
        return;
      }

      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const writableCalendars = calendars.filter(c => c.allowsModifications);

      if (writableCalendars.length === 0) {
        Alert.alert('Error', 'No writable calendars found on device.');
        return;
      }

      if (writableCalendars.length === 1) {
        saveEventToCalendar(writableCalendars[0].id, event);
      } else {
        setAvailableCalendars(writableCalendars);
        setSelectedEventForCalendar(event);
        setCalendarModalVisible(true);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to access calendar.');
    }
  };

  const saveEventToCalendar = async (calendarId: string, event: CommunityEvent) => {
    try {
      const startDate = new Date(event.date);
      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // Default 1 hour duration

      // Check for duplicates
      const existingEvents = await Calendar.getEventsAsync(
        [calendarId],
        startDate,
        endDate
      );

      const duplicate = existingEvents.find((e) => e.title === event.title);

      if (duplicate) {
        Alert.alert('Info', 'This event is already in your calendar.');
        return;
      }

      await Calendar.createEventAsync(calendarId, {
        title: event.title,
        startDate,
        endDate,
        location: 'Community Event',
        notes: event.description,
        alarms: [{ relativeOffset: -15, method: Calendar.AlarmMethod.ALERT }],
      });

      Alert.alert('Success', 'Event added to your calendar!');
    } catch (error) {
      Alert.alert('Error', 'Failed to add event to calendar.');
    }
  };

  const renderEventItem = ({ item }: { item: CommunityEvent }) => (
    <View style={[styles.eventCard, { backgroundColor: surfaceColor, borderColor }]}>
      <View style={[styles.eventIconContainer, { backgroundColor: primaryColor + '20' }]}>
        <IconSymbol name={getEventIcon(item.type) as any} size={24} color={primaryColor} />
      </View>
      <View style={styles.eventInfo}>
        <ThemedText type="body1" style={{ fontFamily: typography.families.bold }}>{item.title}</ThemedText>
        <ThemedText type="caption" style={{ color: lightTextColor, marginBottom: spacing.xs }}>
          {new Date(item.date).toLocaleString()}
        </ThemedText>
        <ThemedText type="body2" style={{ color: textColor }}>{item.description}</ThemedText>
        <View style={styles.organizerRow}>
          {item.creator.profilePhoto ? (
            <Image 
              source={{ uri: getImageUrl(item.creator.profilePhoto) }} 
              style={styles.organizerAvatar} 
            />
          ) : (
            <View style={[styles.organizerAvatarPlaceholder, { backgroundColor: surfaceColor }]}>
              <IconSymbol name="person.fill" size={12} color={lightTextColor} />
            </View>
          )}
          <ThemedText type="caption" style={{ color: lightTextColor }}>
            Hosted by {item.creator.username}
          </ThemedText>
        </View>
      </View>
      <TouchableOpacity style={[styles.joinButton, { borderColor: primaryColor }]} onPress={() => initiateAddToCalendar(item)}>
        <ThemedText style={{ color: primaryColor, fontFamily: typography.families.bold }}>Join</ThemedText>
      </TouchableOpacity>
    </View>
  );

  const renderMemberItem = ({ item }: { item: any }) => {
    const memberId = item._id || item.id;
    const isCreator = String(memberId) === String(getCreatorId());
    return (
      <TouchableOpacity
        style={[styles.memberCard, { backgroundColor: surfaceColor, borderColor }]}
        onPress={() => memberId && router.push(`/user/${memberId}`)}
      >
        {item.profilePhoto ? (
          <Image source={{ uri: getImageUrl(item.profilePhoto) }} style={styles.memberAvatar} />
        ) : (
          <View style={[styles.memberAvatarPlaceholder, { backgroundColor: primaryColor + '20' }]}>
            <IconSymbol name="person.fill" size={20} color={primaryColor} />
          </View>
        )}
        <View style={styles.memberInfo}>
          <ThemedText type="body1" style={{ fontFamily: typography.families.bold }}>{item.username}</ThemedText>
          {isCreator && (
            <ThemedText type="caption" style={{ color: primaryColor }}>Admin</ThemedText>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={primaryColor} />
      </ThemedView>
    );
  }

  if (!community) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ThemedText>Community not found</ThemedText>
      </ThemedView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ThemedView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <IconSymbol name="chevron.left" size={28} color={white} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              const chatId = typeof community.chat === 'object' ? (community.chat as any)?._id : community.chat;
              if (chatId) {
                router.push(`/chat/${chatId}`);
              } else {
                Alert.alert('Info', 'Chat not available for this community');
              }
            }}
            style={styles.chatButton}
          >
            <IconSymbol name="message.fill" size={24} color={white} />
          </TouchableOpacity>
          <Image source={{ uri: getImageUrl(community.image) }} style={styles.coverImage} />
          <View style={styles.headerOverlay} />
          <View style={styles.headerContent}>
            <ThemedText type="heading1" style={{ color: white }}>{community.name}</ThemedText>
            <ThemedText style={{ color: white, opacity: 0.9 }}>{community.members?.length || 0} Members</ThemedText>
          </View>
        </View>

        {/* Tabs */}
        <View style={[styles.tabs, { borderBottomColor: borderColor }]}>
          {['feed', 'events', 'members'].map((tab) => (
            <TouchableOpacity 
              key={tab} 
              style={[styles.tab, activeTab === tab && { borderBottomColor: primaryColor }]}
              onPress={() => setActiveTab(tab as any)}
            >
              <ThemedText style={{ 
                color: activeTab === tab ? primaryColor : lightTextColor,
                fontFamily: typography.families.bold,
                textTransform: 'capitalize'
              }}>
                {tab}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>

        {/* Content */}
        <View style={styles.content}>
          {activeTab === 'events' ? (
            <View style={{ flex: 1 }}>
              <View style={styles.eventsHeader}>
                <ThemedText type="title">Upcoming Events</ThemedText>
                {isAdmin && (
                  <TouchableOpacity 
                    style={[styles.createButton, { backgroundColor: primaryColor }]}
                    onPress={() => setShowCreateEvent(true)}
                  >
                    <IconSymbol name="plus" size={20} color={white} />
                    <ThemedText style={{ color: white, marginLeft: spacing.xs, fontWeight: 'bold' }}>Create</ThemedText>
                  </TouchableOpacity>
                )}
              </View>
              
              <FlatList
                data={events}
                renderItem={renderEventItem}
                keyExtractor={item => item._id}
                contentContainerStyle={styles.eventsList}
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <IconSymbol name="calendar" size={48} color={lightTextColor} />
                    <ThemedText style={{ color: lightTextColor, marginTop: spacing.md }}>No upcoming events</ThemedText>
                    {isAdmin && (
                      <TouchableOpacity onPress={() => setShowCreateEvent(true)}>
                        <ThemedText style={{ color: primaryColor, marginTop: spacing.sm, fontWeight: 'bold' }}>
                          Schedule one now!
                        </ThemedText>
                      </TouchableOpacity>
                    )}
                  </View>
                }
              />
            </View>
          ) : activeTab === 'members' ? (
            <FlatList
              data={community.members || []}
              keyExtractor={(item) => item._id || item.id}
              contentContainerStyle={styles.eventsList}
              renderItem={renderMemberItem}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <IconSymbol name="person.2" size={48} color={lightTextColor} />
                  <ThemedText style={{ color: lightTextColor, marginTop: spacing.md }}>No members yet</ThemedText>
                </View>
              }
            />
          ) : (
            <View style={styles.feedContainer}>
              {canPostFeed && (
                <View style={[styles.composer, { backgroundColor: surfaceColor, borderColor }]}>
                  <View style={styles.composerHeader}>
                    {user?.profilePhoto ? (
                      <Image source={{ uri: getImageUrl(user.profilePhoto) }} style={styles.composerAvatar} />
                    ) : (
                      <View style={[styles.composerAvatarPlaceholder, { backgroundColor: primaryColor + '20' }]}>
                        <IconSymbol name="person.fill" size={16} color={primaryColor} />
                      </View>
                    )}
                    <ThemedText type="body2" style={{ color: lightTextColor }}>
                      {isAdmin ? 'Posting as Admin' : 'Share something with the community'}
                    </ThemedText>
                  </View>
                  <TextInput
                    style={[styles.composerInput, { color: textColor, borderColor }]}
                    placeholder="Write a post..."
                    placeholderTextColor={lightTextColor}
                    value={feedContent}
                    onChangeText={setFeedContent}
                    multiline
                    textAlignVertical="top"
                  />
                  {feedImages.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.composerImages}>
                      {feedImages.map((uri, idx) => (
                        <View key={idx} style={styles.composerImageWrapper}>
                          <Image source={{ uri }} style={styles.composerImage} />
                          <TouchableOpacity
                            style={styles.composerRemoveImage}
                            onPress={() => setFeedImages(prev => prev.filter((_, i) => i !== idx))}
                          >
                            <IconSymbol name="xmark.circle.fill" size={20} color="white" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </ScrollView>
                  )}
                  <View style={styles.composerActions}>
                    <TouchableOpacity onPress={handlePickFeedImage} disabled={feedImages.length >= 10}>
                      <IconSymbol name="photo" size={22} color={feedImages.length >= 10 ? lightTextColor : primaryColor} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.composerPostButton, { backgroundColor: primaryColor }]}
                      onPress={handleCreateFeed}
                      disabled={feedPosting || (!feedContent.trim() && feedImages.length === 0)}
                    >
                      {feedPosting ? (
                        <ActivityIndicator color={white} size="small" />
                      ) : (
                        <ThemedText style={{ color: white, fontWeight: typography.weights.semibold }}>Post</ThemedText>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {feedLoading && feeds.length === 0 ? (
                <View style={styles.feedLoading}>
                  <ActivityIndicator color={primaryColor} />
                </View>
              ) : !canPostFeed ? (
                <View style={styles.emptyState}>
                  <IconSymbol name="lock" size={48} color={lightTextColor} />
                  <ThemedText style={{ color: lightTextColor, marginTop: spacing.md }}>
                    Join this community to see and post in the feed
                  </ThemedText>
                </View>
              ) : feeds.length === 0 ? (
                <View style={styles.emptyState}>
                  <IconSymbol name="doc" size={48} color={lightTextColor} />
                  <ThemedText style={{ color: lightTextColor, marginTop: spacing.md }}>
                    No posts yet. Be the first to share!
                  </ThemedText>
                </View>
              ) : (
                <FlatList
                  data={feeds}
                  renderItem={renderFeedItem}
                  keyExtractor={item => item._id}
                  contentContainerStyle={styles.feedList}
                  onEndReached={() => {
                    if (feedHasMore && !feedLoading) fetchFeed(feedPage + 1, false);
                  }}
                  onEndReachedThreshold={0.2}
                  ListFooterComponent={feedLoading && feeds.length > 0 ? (
                    <View style={styles.feedLoading}><ActivityIndicator color={primaryColor} /></View>
                  ) : null}
                />
              )}
            </View>
          )}
        </View>

        <CreateEventModal 
          visible={showCreateEvent} 
          onClose={() => setShowCreateEvent(false)} 
          communityId={id as string}
          onCreate={fetchCommunityDetails}
        />

        <Modal
          visible={calendarModalVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setCalendarModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <ThemedView style={styles.calendarModalContent}>
              <ThemedText type="title" style={{ marginBottom: spacing.md, textAlign: 'center' }}>Select Calendar</ThemedText>
              <FlatList
                data={availableCalendars}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.calendarOption, { borderBottomColor: borderColor }]}
                    onPress={() => {
                      if (selectedEventForCalendar) {
                        saveEventToCalendar(item.id, selectedEventForCalendar);
                        setCalendarModalVisible(false);
                      }
                    }}
                  >
                    <ThemedText>{item.title}</ThemedText>
                    <ThemedText type="caption" style={{ color: lightTextColor }}>{item.source.name}</ThemedText>
                  </TouchableOpacity>
                )}
                style={{ maxHeight: 300 }}
              />
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: primaryColor }]}
                onPress={() => setCalendarModalVisible(false)}
              >
                <ThemedText style={{ color: primaryColor, fontFamily: typography.families.bold }}>Cancel</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          </View>
        </Modal>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { height: 200, position: 'relative' },
  coverImage: { width: '100%', height: '100%' },
  headerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  headerContent: { position: 'absolute', bottom: spacing.lg, left: spacing.lg },
  backButton: { position: 'absolute', top: spacing.lg, left: spacing.lg, zIndex: 10, padding: spacing.xs },
  chatButton: { position: 'absolute', top: spacing.lg, right: spacing.lg, zIndex: 10, padding: spacing.xs },
  tabs: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  content: { flex: 1 },
  eventsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg },
  createButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.md },
  eventsList: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  eventCard: { flexDirection: 'row', padding: spacing.md, borderRadius: borderRadius.lg, borderWidth: 1, marginBottom: spacing.md, alignItems: 'flex-start' },
  eventIconContainer: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  eventInfo: { flex: 1 },
  organizerRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  organizerAvatar: { width: 20, height: 20, borderRadius: 10, marginRight: spacing.xs },
  organizerAvatarPlaceholder: { width: 20, height: 20, borderRadius: 10, marginRight: spacing.xs, justifyContent: 'center', alignItems: 'center' },
  joinButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.md, borderWidth: 1, marginLeft: spacing.sm },
  memberCard: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: borderRadius.lg, borderWidth: 1, marginBottom: spacing.md },
  memberAvatar: { width: 44, height: 44, borderRadius: 22, marginRight: spacing.md },
  memberAvatarPlaceholder: { width: 44, height: 44, borderRadius: 22, marginRight: spacing.md, justifyContent: 'center', alignItems: 'center' },
  memberInfo: { flex: 1 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  calendarModalContent: { width: '100%', borderRadius: borderRadius.lg, padding: spacing.lg, ...shadows.lg },
  calendarOption: { paddingVertical: spacing.md, borderBottomWidth: 1 },
  cancelButton: { marginTop: spacing.lg, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderRadius: borderRadius.md },
  // Feed
  feedContainer: { flex: 1, padding: spacing.lg },
  composer: { borderRadius: borderRadius.lg, borderWidth: 1, padding: spacing.md, marginBottom: spacing.md },
  composerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  composerAvatar: { width: 32, height: 32, borderRadius: 16, marginRight: spacing.sm },
  composerAvatarPlaceholder: { width: 32, height: 32, borderRadius: 16, marginRight: spacing.sm, justifyContent: 'center', alignItems: 'center' },
  composerInput: { minHeight: 70, borderWidth: 1, borderRadius: borderRadius.md, padding: spacing.sm, fontSize: typography.sizes.body1, textAlignVertical: 'top' },
  composerImages: { marginTop: spacing.sm },
  composerImageWrapper: { position: 'relative', marginRight: spacing.sm },
  composerImage: { width: 72, height: 72, borderRadius: borderRadius.md },
  composerRemoveImage: { position: 'absolute', top: -6, right: -6 },
  composerActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  composerPostButton: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: borderRadius.md, minWidth: 70, alignItems: 'center' },
  feedList: { paddingBottom: spacing.xl },
  feedLoading: { paddingVertical: spacing.lg, alignItems: 'center' },
  feedCard: { borderRadius: borderRadius.lg, borderWidth: 1, padding: spacing.md, marginBottom: spacing.md },
  feedHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  feedAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: spacing.sm },
  feedAvatarPlaceholder: { width: 36, height: 36, borderRadius: 18, marginRight: spacing.sm, justifyContent: 'center', alignItems: 'center' },
  feedAuthorInfo: { flex: 1 },
  feedDeleteButton: { padding: spacing.xs },
  feedImages: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  feedImagesSingle: { flexDirection: 'column' },
  feedImage: { width: '48%', aspectRatio: 1, borderRadius: borderRadius.md },
  feedImageSingle: { width: '100%', aspectRatio: 1.5, borderRadius: borderRadius.md },
  feedLikeRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: '#E0E0E0' },
});