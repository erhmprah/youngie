import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, ScrollView, Image, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { userAPI, getImageUrl, chatAPI } from '@/utils/api';
import { useThemeColor } from '@/hooks/use-theme-color';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { spacing, borderRadius, typography } from '@/constants/design-tokens';
import { useAuth } from '@/contexts/AuthContext';
import { shadows } from '@/constants/design-tokens';

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

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'self' | 'friend' | 'requested' | 'received' | 'none'>('none');
  const [stats, setStats] = useState({ posts: 0, friends: 0 });

  const backgroundColor = useThemeColor('background');
  const primaryColor = useThemeColor('primary');
  const textColor = useThemeColor('text');
  const lightTextColor = useThemeColor('lightText');
  const surfaceColor = useThemeColor('surface');
  const borderColor = useThemeColor('border');

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

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSendRequest = async () => {
    if (!currentUser?._id || !profile) return;
    try {
      await userAPI.sendFriendRequest(currentUser._id, profile._id);
      setConnectionStatus('requested');
      Alert.alert('Success', 'Friend request sent');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.msg || 'Failed to send request');
    }
  };

  const handleAcceptRequest = async () => {
    if (!currentUser?._id || !profile) return;
    try {
      await userAPI.acceptFriendRequest(currentUser._id, profile._id);
      setConnectionStatus('friend');
      Alert.alert('Success', 'Friend request accepted');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.msg || 'Failed to accept request');
    }
  };

  const handleCancelRequest = async () => {
    if (!currentUser?._id || !profile) return;
    try {
      await userAPI.cancelFriendRequest(currentUser._id, profile._id);
      setConnectionStatus('none');
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

  if (isLoading || !profile) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={primaryColor} />
      </ThemedView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor }}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={[primaryColor + '20', 'transparent']} style={styles.headerBackground} />
      
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.navHeader}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <IconSymbol name="chevron.left" size={28} color={textColor} />
            </TouchableOpacity>
        </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
            <View style={styles.statBox}>
                <ThemedText type="title" style={{ fontFamily: typography.families.bold, color: primaryColor }}>{stats.friends}</ThemedText>
                <ThemedText style={{ color: lightTextColor }}>Friends</ThemedText>
            </View>
        </View>

        <View style={styles.actionButtons}>
            {connectionStatus === 'none' && (
                <TouchableOpacity style={[styles.primaryButton, { backgroundColor: primaryColor }]} onPress={handleSendRequest}>
                    <ThemedText style={styles.buttonText}>Add Friend</ThemedText>
                </TouchableOpacity>
            )}
            {connectionStatus === 'requested' && (
                <TouchableOpacity style={[styles.secondaryButton, { borderColor }]} onPress={handleCancelRequest}>
                    <ThemedText style={{ color: lightTextColor }}>Cancel Request</ThemedText>
                </TouchableOpacity>
            )}
            {connectionStatus === 'received' && (
                <TouchableOpacity style={[styles.primaryButton, { backgroundColor: primaryColor }]} onPress={handleAcceptRequest}>
                    <ThemedText style={styles.buttonText}>Accept Request</ThemedText>
                </TouchableOpacity>
            )}
            {connectionStatus === 'friend' && (
                <TouchableOpacity style={[styles.secondaryButton, { borderColor }]} onPress={handleMessage}>
                    <ThemedText style={{ color: textColor }}>Message</ThemedText>
                </TouchableOpacity>
            )}
        </View>

        {profile.interests && profile.interests.length > 0 && (
            <View style={styles.section}>
                <ThemedText type="subtitle" style={styles.sectionTitle}>Interests</ThemedText>
                <View style={styles.interestsContainer}>
                    {profile.interests.map((interest, index) => (
                        <View key={index} style={[styles.interestChip, { backgroundColor: surfaceColor }]}>
                            <ThemedText>{interest}</ThemedText>
                        </View>
                    ))}
                </View>
            </View>
        )}
      </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    headerBackground: { position: 'absolute', top: 0, left: 0, right: 0, height: 200 },
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
    statBox: { flex: 1, alignItems: 'center', borderRightWidth: 1 },
    actionButtons: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md, marginBottom: spacing.xl },
    primaryButton: { paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, borderRadius: borderRadius.md, minWidth: 120, alignItems: 'center' },
    secondaryButton: { paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center', minWidth: 120 },
    buttonText: { color: 'white', fontWeight: 'bold' },
    section: { marginBottom: spacing.lg },
    sectionTitle: { fontWeight: 'bold', marginBottom: spacing.md },
    interestsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    interestChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.full },
});