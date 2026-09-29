import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, ScrollView, Image, TouchableOpacity, Alert, FlatList, ActivityIndicator } from 'react-native';
import AnimatedActivityIndicator from '@/components/animated-activity-indicator';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { communityAPI, getImageUrl } from '@/utils/api';
import { useThemeColor } from '@/hooks/use-theme-color';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { spacing, borderRadius, typography, shadows } from '@/constants/design-tokens';
import { useAuth } from '@/contexts/AuthContext';
import { getSocket } from '@/utils/socket';

interface User {
  _id: string;
  username: string;
  profilePhoto?: string;
}

interface Community {
  _id: string;
  name: string;
  description: string;
  image?: string;
  creator: User;
  members: User[];
  pendingMembers?: User[];
  requiresApproval: boolean;
  chat?: string | { _id: string }; // ID or Object
  createdAt: string;
}

export default function CommunityScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const [community, setCommunity] = useState<Community | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const backgroundColor = useThemeColor('background');
  const primaryColor = useThemeColor('primary');
  const textColor = useThemeColor('text');
  const lightTextColor = useThemeColor('lightText');
  const surfaceColor = useThemeColor('surface');
  const borderColor = useThemeColor('border');
  const white = useThemeColor('white');
  const errorColor = useThemeColor('error');

  const fetchCommunity = useCallback(async () => {
    try {
      if (!id || id === 'undefined') return;
      const response = await communityAPI.getCommunity(id as string);
      setCommunity(response.data);
    } catch (error) {
      console.error('Failed to fetch community:', error);
      Alert.alert('Error', 'Failed to load community details');
      router.back();
    } finally {
      setIsLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchCommunity();
  }, [fetchCommunity]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleNotificationNew = (notification: any) => {
      if (notification.relatedCommunity === community?._id) {
        fetchCommunity();

        if (notification.type === 'community_join_request' || notification.type === 'community_join_request_approved' || notification.type === 'community_join_request_rejected') {
          if (notification.message.includes('approved')) {
            Alert.alert('Request Approved', notification.message);
          } else if (notification.message.includes('rejected')) {
            Alert.alert('Request Rejected', notification.message);
          }
        }
      }
    };

    socket.on('notification:new', handleNotificationNew);

    return () => {
      socket.off('notification:new', handleNotificationNew);
    };
  }, [community?._id, fetchCommunity]);


  const handleJoin = async () => {
    if (!community) return;
    setIsActionLoading(true);
    try {
      await communityAPI.join(community._id);
      if (community.requiresApproval) {
        Alert.alert('Request Sent', 'Your request to join has been sent to the admin.');
        fetchCommunity();
      } else {
        Alert.alert('Success', 'You have joined the community!');
        fetchCommunity();
      }
    } catch (error: any) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleApprove = async (userId: string) => {
    if (!community) return;
    try {
      await communityAPI.approveMember(community._id, userId);
      fetchCommunity();
    } catch (error: any) {
      Alert.alert('Error', 'Failed to approve member');
    }
  };

  const handleReject = async (userId: string) => {
    if (!community) return;
    try {
      await communityAPI.rejectMember(community._id, userId);
      fetchCommunity();
    } catch (error: any) {
      Alert.alert('Error', 'Failed to reject member');
    }
  };

  const isMember = community?.members.some(m => m._id === user?._id) || false;
  const isCreator = community?.creator._id === user?._id || false;
  const isPending = community?.pendingMembers?.some(m => (typeof m === 'string' ? m === user?._id : m._id === user?._id)) || false;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Loading View */}
      <AnimatedActivityIndicator size="large" color={primaryColor} style={styles.loadingContainer} />

      {/* Content View */}
      <View style={{ flex: 1 }}>
        {community && (
          <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header Image */}
        <View style={styles.imageContainer}>
          {community.image ? (
            <Image source={{ uri: getImageUrl(community.image) }} style={styles.coverImage} />
          ) : (
            <View style={[styles.placeholderImage, { backgroundColor: surfaceColor }]}>
              <IconSymbol name="person.3.fill" size={64} color={lightTextColor} />
            </View>
          )}
          <TouchableOpacity style={[styles.backButton, { backgroundColor: 'rgba(0,0,0,0.5)' }]} onPress={() => router.back()}>
            <IconSymbol name="chevron.left" size={24} color={white} />
          </TouchableOpacity>
        </View>

        <ThemedView style={styles.contentContainer}>
          <ThemedText type="heading1" style={styles.title}>{community.name}</ThemedText>
          
          <View style={styles.statsRow}>
            <ThemedText style={{ color: lightTextColor }}>{community.members.length} Members</ThemedText>
            <ThemedText style={{ color: lightTextColor }}>•</ThemedText>
            <ThemedText style={{ color: lightTextColor }}>Created by {community.creator.username}</ThemedText>
          </View>

          <ThemedText style={styles.description}>{community.description}</ThemedText>

          {/* Actions */}
          <View style={styles.actionContainer}>
            {isMember ? (
              <TouchableOpacity 
                style={[styles.primaryButton, { backgroundColor: primaryColor }]}
                onPress={() => {
                    const chatId = typeof community.chat === 'object' ? (community.chat as any)._id : community.chat;
                    if (chatId) {
                        router.push(`/chat/${chatId}`);
                    } else {
                        Alert.alert('Info', 'No chat available for this community');
                    }
                }}
              >
                <IconSymbol name="message.fill" size={20} color={white} />
                <ThemedText style={styles.buttonText}>Open Chat</ThemedText>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={[styles.primaryButton, { backgroundColor: isPending ? surfaceColor : primaryColor }]}
                onPress={handleJoin}
                disabled={isPending || isActionLoading}
              >
                {isActionLoading ? (
                  <ActivityIndicator color={white} />
                ) : (
                  <ThemedText style={[styles.buttonText, isPending && { color: lightTextColor }]}>
                    {isPending ? 'Requested' : 'Join Community'}
                  </ThemedText>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Pending Requests (Admin Only) */}
          {isCreator && community.pendingMembers && community.pendingMembers.length > 0 && (
            <View style={[styles.section, { borderTopColor: borderColor, borderTopWidth: 1 }]}>
              <ThemedText type="title" style={styles.sectionTitle}>Pending Requests</ThemedText>
              {community.pendingMembers.map(member => (
                <View key={member._id} style={[styles.memberRow, { borderBottomColor: borderColor }]}>
                  <View style={styles.memberInfo}>
                    <View style={[styles.memberAvatar, { backgroundColor: surfaceColor, overflow: 'hidden' }]}>
                        {member.profilePhoto ? (
                            <Image source={{ uri: getImageUrl(member.profilePhoto) }} style={{ width: '100%', height: '100%' }} />
                        ) : (
                            <IconSymbol name="person.fill" size={20} color={lightTextColor} />
                        )}
                    </View>
                    <ThemedText style={styles.memberName}>{member.username}</ThemedText>
                  </View>
                  <View style={styles.adminActions}>
                    <TouchableOpacity onPress={() => handleApprove(member._id)} style={[styles.iconBtn, { backgroundColor: primaryColor }]}>
                        <IconSymbol name="checkmark" size={16} color={white} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleReject(member._id)} style={[styles.iconBtn, { backgroundColor: errorColor }]}>
                        <IconSymbol name="x" size={16} color={white} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Members List */}
          <View style={[styles.section, { borderTopColor: borderColor, borderTopWidth: 1 }]}>
            <ThemedText type="title" style={styles.sectionTitle}>Members</ThemedText>
            {community.members.map(member => (
              <TouchableOpacity 
                key={member._id} 
                style={[styles.memberRow, { borderBottomColor: borderColor }]}
                onPress={() => router.push(`/user/${member._id}`)}
              >
                <View style={styles.memberInfo}>
                    <View style={[styles.memberAvatar, { backgroundColor: surfaceColor, overflow: 'hidden' }]}>
                        {member.profilePhoto ? (
                            <Image source={{ uri: getImageUrl(member.profilePhoto) }} style={{ width: '100%', height: '100%' }} />
                        ) : (
                            <IconSymbol name="person.fill" size={20} color={lightTextColor} />
                        )}
                    </View>
                  <ThemedText style={styles.memberName}>{member.username}</ThemedText>
                  {member._id === community.creator._id && (
                    <View style={[styles.badge, { backgroundColor: primaryColor + '20' }]}>
                        <ThemedText style={[styles.badgeText, { color: primaryColor }]}>Admin</ThemedText>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>

        </ThemedView>
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingBottom: spacing.xl },
  imageContainer: { height: 200, width: '100%' },
  coverImage: { width: '100%', height: '100%' },
  placeholderImage: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  backButton: { position: 'absolute', top: spacing.lg, left: spacing.lg, padding: spacing.sm, borderRadius: borderRadius.round },
  contentContainer: { padding: spacing.lg },
  title: { fontFamily: typography.families.bold, marginBottom: spacing.xs },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  description: { fontSize: typography.sizes.body1, lineHeight: 24, marginBottom: spacing.xl },
  actionContainer: { marginBottom: spacing.xl },
  primaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md, borderRadius: borderRadius.md, gap: spacing.sm },
  buttonText: { color: '#FFF', fontFamily: typography.families.bold, fontSize: typography.sizes.body1 },
  section: { paddingTop: spacing.lg, marginTop: spacing.md },
  sectionTitle: { marginBottom: spacing.md, fontFamily: typography.families.bold },
  memberRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md, borderBottomWidth: 1 },
  memberInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  memberAvatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  memberName: { fontFamily: typography.families.medium, fontSize: typography.sizes.body1 },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.sm, marginLeft: spacing.sm },
  badgeText: { fontSize: typography.sizes.caption, fontFamily: typography.families.bold },
  adminActions: { flexDirection: 'row', gap: spacing.md },
  iconBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
});