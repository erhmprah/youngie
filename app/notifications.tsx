import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { StyleSheet, View, SectionList, TouchableOpacity, ActivityIndicator, Alert, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/contexts/AuthContext';
import { notificationAPI, userAPI, communityAPI, chatAPI, getImageUrl, postAPI, storyAPI } from '@/utils/api';
import { getColors, spacing, typography, borderRadius, shadows } from '@/constants/design-tokens';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Swipeable } from 'react-native-gesture-handler';
import { showErrorAlert } from '@/utils/error-handler';

interface Notification {
  _id: string;
  sender: {
    _id: string;
    username: string;
    avatar?: string;
    profilePhoto?: string;
  };
  type: 'like' | 'comment' | 'follow' | 'match' | 'message' | 'community_join_request' | 'chat_invitation' | 'tag';
  message: string;
  isRead: boolean;
  createdAt: string;
  relatedCommunity?: string;
  relatedChat?: string;
  relatedPost?: string;
}

const NotificationSkeleton = ({ colors }: { colors: ReturnType<typeof getColors> }) => (
  <View style={dynamicStyles(colors).skeletonContainer}>
    <View style={dynamicStyles(colors).skeletonAvatar} />
    <View style={dynamicStyles(colors).skeletonTextContainer}>
      <View style={dynamicStyles(colors).skeletonTextLine} />
      <View style={[dynamicStyles(colors).skeletonTextLine, { width: '60%' }]} />
    </View>
  </View>
);

export default function NotificationsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme as 'light' | 'dark');
  const styles = dynamicStyles(colors);

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user]);

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const response = await notificationAPI.getNotifications();
      setNotifications(response.data);
    } catch (error) {
      showErrorAlert(error, () => fetchNotifications());
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkAsRead = useCallback(async (notificationId: string) => {
    try {
      await notificationAPI.markAsRead(notificationId);
      setNotifications(prev => prev.map(notif =>
        notif._id === notificationId ? { ...notif, isRead: true } : notif
      ));
    } catch (error) {
    }
  }, []);

  const handleAcceptRequest = async (senderId: string, notificationId: string) => {
    if (!user?._id) return;
    try {
      await userAPI.acceptFriendRequest(user._id, senderId);
      await notificationAPI.markAsRead(notificationId);
      setNotifications(prev => prev.map(notif =>
        notif._id === notificationId ? { ...notif, isRead: true, message: 'Friend request accepted' } : notif
      ));
      Alert.alert('Success', 'Friend request accepted!');
    } catch (error: any) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  };

  const handleIgnoreRequest = async (senderId: string, notificationId: string) => {
    if (!user?._id) return;
    try {
      await userAPI.ignoreFriendRequest(user._id, senderId);
      await notificationAPI.markAsRead(notificationId);
      setNotifications(prev => prev.map(notif =>
        notif._id === notificationId ? { ...notif, isRead: true, message: 'Friend request ignored' } : notif
      ));
      Alert.alert('Ignored', 'Friend request ignored');
    } catch (error: any) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  };

  const handleApproveCommunity = async (communityId: string, senderId: string, notificationId: string) => {
    try {
      await communityAPI.approveMember(communityId, senderId);
      await notificationAPI.markAsRead(notificationId);
      setNotifications(prev => prev.map(notif =>
        notif._id === notificationId ? { ...notif, isRead: true, message: 'Community join request approved' } : notif
      ));
      Alert.alert('Success', 'Member approved!');
    } catch (error: any) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  };

  const handleRejectCommunity = async (notificationId: string) => {
    try {
      await notificationAPI.markAsRead(notificationId);
      setNotifications(prev => prev.map(notif =>
        notif._id === notificationId ? { ...notif, isRead: true, message: 'Community join request rejected' } : notif
      ));
      Alert.alert('Rejected', 'Join request rejected');
    } catch (error: any) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  };

  const handleAcceptChatInvitation = async (chatId: string, notificationId: string) => {
    try {
      await chatAPI.acceptInvitation(chatId);
      await notificationAPI.markAsRead(notificationId);
      setNotifications(prev => prev.map(notif =>
        notif._id === notificationId ? { ...notif, isRead: true, message: 'Chat invitation accepted' } : notif
      ));
      Alert.alert('Success', 'You have joined the chat!');
    } catch (error: any) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  };

  const handleRejectChatInvitation = async (chatId: string, notificationId: string) => {
    try {
      await chatAPI.rejectInvitation(chatId);
      await notificationAPI.markAsRead(notificationId);
      setNotifications(prev => prev.map(notif =>
        notif._id === notificationId ? { ...notif, isRead: true, message: 'Chat invitation rejected' } : notif
      ));
      Alert.alert('Rejected', 'Chat invitation rejected');
    } catch (error: any) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationAPI.markAllAsRead();
      setNotifications(prev => prev.map(notif => ({ ...notif, isRead: true })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleClearAllNotifications = () => {
    Alert.alert(
      'Clear All Notifications',
      'Are you sure you want to clear all notifications?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await notificationAPI.clearAll();
              setNotifications([]);
              Alert.alert('Success', 'All notifications cleared');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear notifications');
            }
          },
        },
      ]
    );
  };

  const groupedNotifications = useMemo(() => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const groups = {
      Today: [] as Notification[],
      Yesterday: [] as Notification[],
      Older: [] as Notification[],
    };

    notifications.forEach(notification => {
      const notificationDate = new Date(notification.createdAt);
      if (notificationDate.toDateString() === today.toDateString()) {
        groups.Today.push(notification);
      } else if (notificationDate.toDateString() === yesterday.toDateString()) {
        groups.Yesterday.push(notification);
      } else {
        groups.Older.push(notification);
      }
    });

    return Object.entries(groups)
      .map(([title, data]) => ({ title, data }))
      .filter(section => section.data.length > 0);
  }, [notifications]);

  const renderRightActions = (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>, notificationId: string) => {
    const trans = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [0, 80],
      extrapolate: 'clamp',
    });
    return (
      <TouchableOpacity onPress={() => handleMarkAsRead(notificationId)}>
        <Animated.View style={[styles.rightAction, { transform: [{ translateX: trans }] }]}>
          <Ionicons name="checkmark-circle" size={24} color={colors.white} />
          <ThemedText style={styles.rightActionText}>Read</ThemedText>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  const handleNotificationPress = async (notification: Notification) => {
    // Mark as read when tapped
    if (!notification.isRead) {
      handleMarkAsRead(notification._id);
    }

    // Navigate based on notification type
    if ((notification.type === 'tag' || notification.type === 'like' || notification.type === 'comment') && notification.relatedPost) {
      // Check if the post still exists before navigating
      try {
        const response = await postAPI.getPost(notification.relatedPost);
        
        if (response.data) {
          // Navigate to the feed and scroll to the specific post
          router.push(`/?postId=${notification.relatedPost}`);
        } else {
          // Post no longer exists, remove the notification and show alert
          Alert.alert('Post Deleted', 'This post has been deleted and the notification has been removed.');
          setNotifications(prev => prev.filter(n => n._id !== notification._id));
          
          // Also delete the notification from the backend
          try {
            await notificationAPI.deleteNotification(notification._id);
          } catch (err) {
            // Ignore errors, notification already removed from UI
          }
        }
      } catch (error: any) {
        // Post doesn't exist or error occurred
        if (error.response?.status === 404) {
          Alert.alert('Post Deleted', 'This post has been deleted and the notification has been removed.');
          setNotifications(prev => prev.filter(n => n._id !== notification._id));
          
          // Also delete the notification from the backend
          try {
            await notificationAPI.deleteNotification(notification._id);
          } catch (err) {
            // Ignore errors, notification already removed from UI
          }
        } else {
          // Network error or other issue, navigate anyway (feed will handle invalid postId)
          router.push(`/?postId=${notification.relatedPost}`);
        }
      }
    } else if (notification.relatedCommunity) {
      // Check if the community still exists before navigating
      try {
        const response = await communityAPI.getCommunity(notification.relatedCommunity);
        
        if (response.data) {
          // Navigate to community
          router.push(`/community/${notification.relatedCommunity}`);
        } else {
          // Community no longer exists, remove the notification and show alert
          Alert.alert('Community Deleted', 'This community has been deleted and the notification has been removed.');
          setNotifications(prev => prev.filter(n => n._id !== notification._id));
          
          // Also delete the notification from the backend
          try {
            await notificationAPI.deleteNotification(notification._id);
          } catch (err) {
            // Ignore errors, notification already removed from UI
          }
        }
      } catch (error: any) {
        // Community doesn't exist or error occurred
        if (error.response?.status === 404) {
          Alert.alert('Community Deleted', 'This community has been deleted and the notification has been removed.');
          setNotifications(prev => prev.filter(n => n._id !== notification._id));
          
          // Also delete the notification from the backend
          try {
            await notificationAPI.deleteNotification(notification._id);
          } catch (err) {
            // Ignore errors, notification already removed from UI
          }
        } else {
          // Network error or other issue, navigate anyway
          router.push(`/community/${notification.relatedCommunity}`);
        }
      }
    } else if (notification.relatedChat) {
      // Navigate to chat
      router.push(`/chat/${notification.relatedChat}`);
    }
    // Note: Story notifications don't have relatedStory in the interface yet
    // Add more navigation cases as needed
  };

  const renderNotification = ({ item }: { item: Notification }) => {
    const isPendingFriendRequest = item.type === 'follow' && item.message === 'sent you a friend request' && !item.isRead;
    const isPendingCommunityRequest = item.type === 'community_join_request' && !item.isRead;
    const isPendingChatInvitation = item.type === 'chat_invitation' && !item.isRead;
    // For accepted/ignored, the message will already be updated by handleAcceptRequest/handleIgnoreRequest
    // So, we just need to make sure buttons don't show if it's not a pending request.

    return (
      <Swipeable
        renderRightActions={(progress, dragX) => renderRightActions(progress, dragX, item._id)}
        onSwipeableOpen={() => handleMarkAsRead(item._id)}
        friction={2}
        rightThreshold={40}
      >
        <TouchableOpacity
          style={[styles.notification, !item.isRead && styles.unread]}
          onPress={() => handleNotificationPress(item)}
          activeOpacity={0.7}
        >
          <TouchableOpacity onPress={() => router.push(`/user/${item.sender._id}`)}>
            <View style={[styles.avatarContainer, { backgroundColor: colors.surface }]}>
              {item.sender.profilePhoto ? (
                <Image
                  source={{ uri: getImageUrl(item.sender.profilePhoto) }}
                  style={styles.avatar}
                />
              ) : item.sender.avatar ? (
                <Image
                  source={{ uri: getImageUrl(item.sender.avatar) }}
                  style={styles.avatar}
                />
              ) : (
                <Ionicons name="person" size={24} color={colors.lightText} />
              )}
            </View>
          </TouchableOpacity>
          <View style={styles.textContainer}>
            <ThemedText>
              <ThemedText style={styles.sender}>{item.sender.username}</ThemedText> {item.message}
            </ThemedText>
            <ThemedText style={styles.timestamp}>
              {new Date(item.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </ThemedText>
            
            {isPendingFriendRequest && (
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.acceptButton}
                  onPress={() => handleAcceptRequest(item.sender._id, item._id)}
                >
                  <ThemedText style={styles.buttonText}>Accept</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.ignoreButton}
                  onPress={() => handleIgnoreRequest(item.sender._id, item._id)}
                >
                  <ThemedText style={styles.buttonText}>Ignore</ThemedText>
                </TouchableOpacity>
              </View>
            )}

            {isPendingCommunityRequest && item.relatedCommunity && (
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.acceptButton}
                  onPress={() => handleApproveCommunity(item.relatedCommunity!, item.sender._id, item._id)}
                >
                  <ThemedText style={styles.buttonText}>Approve</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.ignoreButton}
                  onPress={() => handleRejectCommunity(item._id)}
                >
                  <ThemedText style={styles.buttonText}>Reject</ThemedText>
                </TouchableOpacity>
              </View>
            )}

            {isPendingChatInvitation && item.relatedChat && (
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.acceptButton}
                  onPress={() => handleAcceptChatInvitation(item.relatedChat!, item._id)}
                >
                  <ThemedText style={styles.buttonText}>Accept</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.ignoreButton}
                  onPress={() => handleRejectChatInvitation(item.relatedChat!, item._id)}
                >
                  <ThemedText style={styles.buttonText}>Reject</ThemedText>
                </TouchableOpacity>
              </View>
            )}
          </View>
          {!item.isRead && <View style={styles.unreadDot} />}
        </TouchableOpacity>
      </Swipeable>
    );
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.header}>
             <ThemedText type="title" style={styles.title}>Notifications</ThemedText>
          </View>
          <NotificationSkeleton colors={colors} />
          <NotificationSkeleton colors={colors} />
          <NotificationSkeleton colors={colors} />
        </SafeAreaView>
      </ThemedView>
    );
  }

  const hasUnread = notifications.some(n => !n.isRead);
  const hasNotifications = notifications.length > 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ThemedView style={styles.container}>
        <View style={styles.header}>
           <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
             <Ionicons name="chevron-back" size={28} color={colors.text} />
           </TouchableOpacity>
           <ThemedText type="title" style={styles.title}>Notifications</ThemedText>
         </View>

        {(hasUnread || hasNotifications) && (
          <View style={styles.optionsBar}>
            {hasUnread && (
              <TouchableOpacity onPress={handleMarkAllAsRead} style={styles.optionButton}>
                <Ionicons name="checkmark-done-outline" size={18} color={colors.primary} />
                <ThemedText style={styles.markAllText}>Mark all read</ThemedText>
              </TouchableOpacity>
            )}
            {hasNotifications && (
              <TouchableOpacity onPress={handleClearAllNotifications} style={styles.optionButton}>
                <Ionicons name="trash-outline" size={18} color={colors.lightText} />
                <ThemedText style={[styles.markAllText, { color: colors.lightText }]}>Clear all</ThemedText>
              </TouchableOpacity>
            )}
          </View>
        )}

        {notifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <ThemedText style={styles.emptyIcon}>🎉</ThemedText>
            <ThemedText style={styles.emptyText}>All caught up!</ThemedText>
            <ThemedText style={styles.emptySubtext}>You have no new notifications.</ThemedText>
          </View>
        ) : (
          <SectionList
            sections={groupedNotifications}
            renderItem={renderNotification}
            keyExtractor={(item) => item._id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContainer}
            renderSectionHeader={({ section: { title } }) => (
              <ThemedText style={styles.sectionHeader}>{title}</ThemedText>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        )}
      </ThemedView>
    </SafeAreaView>
  );
}

const dynamicStyles = (colors: ReturnType<typeof getColors>) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    position: 'absolute',
    left: spacing.lg,
    zIndex: 1,
    padding: spacing.sm,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: typography.sizes.heading3,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  optionsBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  markAllText: {
    fontSize: typography.sizes.caption,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  listContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md, // Added vertical padding
  },
  sectionHeader: {
    fontSize: typography.sizes.body1,
    fontWeight: typography.weights.bold,
    color: colors.text,
    paddingVertical: spacing.sm,
    paddingTop: spacing.xl,
    backgroundColor: colors.background,
  },
   notification: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md, // Consistent padding
    marginVertical: spacing.xs, // Add vertical margin between items
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md, // Softer corners
  },
  unread: {
    backgroundColor: colors.primary + '20', // More distinct tint for unread
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: spacing.md, // Consistent spacing
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: spacing.xs, // Added vertical padding for text
  },
  sender: {
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  timestamp: {
    fontSize: typography.sizes.caption, // Slightly smaller font
    color: colors.lighterText, // Less prominent color
    marginTop: spacing.xs,
  },
  unreadDot: {
    width: 8, // Slightly smaller dot
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: spacing.sm, // Consistent spacing
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md, // Consistent margin
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.lg,
  },
  emptyText: {
    fontSize: typography.sizes.heading4,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.sm,
    color: colors.text,
  },
  emptySubtext: {
    fontSize: typography.sizes.body1,
    color: colors.lightText,
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  acceptButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.xl,
  },
  ignoreButton: {
    backgroundColor: colors.error,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.xl,
  },
  buttonText: {
    color: colors.white,
    fontSize: typography.sizes.body2,
    fontWeight: typography.weights.bold,
  },
  rightAction: {
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80, // Keeping original width
    height: '100%',
  },
  rightActionText: {
    color: colors.white,
    marginTop: spacing.xs,
  },
  skeletonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surface,
    marginVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  skeletonAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.border,
    marginRight: spacing.md,
  },
  skeletonTextContainer: {
    marginLeft: spacing.md,
    flex: 1,
  },
  skeletonTextLine: {
    height: 16,
    backgroundColor: colors.border,
    borderRadius: 4,
    marginBottom: spacing.xs,
  },
});