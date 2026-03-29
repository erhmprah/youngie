import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert, FlatList, Platform, Modal } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import * as Calendar from 'expo-calendar';
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

interface CommunityEvent {
  _id: string;
  title: string;
  description: string;
  date: string;
  type: 'voice' | 'game' | 'meetup' | 'other';
  creator: { _id: string; username: string; profilePhoto?: string };
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
        communityAPI.get(id as string),
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

  const isAdmin = community?.creator && user?._id ? (
    (String(community.creator) === String(user._id)) ||
    (typeof community.creator === 'object' && (String(community.creator._id) === String(user._id) || String(community.creator.id) === String(user._id)))
  ) : false;

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'voice': return 'mic.fill';
      case 'game': return 'gamecontroller.fill';
      case 'meetup': return 'person.3.fill';
      default: return 'calendar';
    }
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
          <Image source={{ uri: getImageUrl(community.image) }} style={styles.coverImage} />
          <View style={styles.headerOverlay} />
          <View style={styles.headerContent}>
            <ThemedText type="heading1" style={{ color: white }}>{community.name}</ThemedText>
            <ThemedText style={{ color: white, opacity: 0.9 }}>{community.memberCount || 0} Members</ThemedText>
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
                <TouchableOpacity 
                  style={[styles.createButton, { backgroundColor: primaryColor }]}
                  onPress={() => setShowCreateEvent(true)}
                >
                  <IconSymbol name="plus" size={20} color={white} />
                  <ThemedText style={{ color: white, marginLeft: spacing.xs, fontWeight: 'bold' }}>Create</ThemedText>
                </TouchableOpacity>
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
                    <TouchableOpacity onPress={() => setShowCreateEvent(true)}>
                      <ThemedText style={{ color: primaryColor, marginTop: spacing.sm, fontWeight: 'bold' }}>
                        Schedule one now!
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                }
              />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <ThemedText style={{ color: lightTextColor }}>{activeTab === 'feed' ? 'Community Feed' : 'Member List'} Placeholder</ThemedText>
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
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  calendarModalContent: { width: '100%', borderRadius: borderRadius.lg, padding: spacing.lg, ...shadows.lg },
  calendarOption: { paddingVertical: spacing.md, borderBottomWidth: 1 },
  cancelButton: { marginTop: spacing.lg, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderRadius: borderRadius.md },
});