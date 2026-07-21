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
import { getColors, spacing, typography, borderRadius, shadows, sizes } from '@/constants/design-tokens';
import { verticalScale } from '@/utils/scale';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Swipeable } from 'react-native-gesture-handler';
import { showErrorAlert } from '@/utils/error-handler';
import { CustomAlert } from '@/utils/alert';
import { getSocket } from '@/utils/socket';

interface NotificationSender {
  _id: string;
  username: string;
  avatar?: string;
  profilePhoto?: string;
}

interface Notification {
  _id: string;
  sender: NotificationSender;
  type: 'like' | 'comment' | 'follow' | 'match' | 'message' | 'community_join_request' | 'chat_invitation' | 'tag';
  message: string;
  isRead: boolean;
  createdAt: string;
  relatedCommunity?: string;
  relatedChat?: string;
  // The API populates relatedPost, so it may arrive as an object
  relatedPost?: string | { _id: string };
  // Aggregation fields: likes/comments on the same post are collapsed
  count?: number;
  senders?: NotificationSender[];
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
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme as 'light' | 'dark');
  const styles = dynamicStyles(colors);

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let appState: any;
    let subscription: any;

    import('react-native').then((m) => {
      const { AppState } = m;
      appState = AppState;
      if (!appState?.addEventListener) return;

      subscription = appState.addEventListener('change', (nextState: string) => {
        if (nextState === 'active') {
          fetchNotifications();
        }
      });
    });

    return () => {
      try {
        subscription?.remove?.();
      } catch {
        // ignore
      }
    };
  }, [user]);


  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const response = await notificationAPI.getNotifications(1, 20);
      setNotifications(response.data.data || []);
      setHasMore(response.data.pagination?.hasNextPage || false);
      setPage(1);
    } catch (error) {
      showErrorAlert(error, () => fetchNotifications());
    } finally {
      setIsLoading(false);
    }
  };

  const loadMoreNotifications = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const response = await notificationAPI.getNotifications(nextPage, 20);
      setNotifications(prev => [...prev, ...(response.data.data || [])]);
      setHasMore(response.data.pagination?.hasNextPage || false);
      setPage(nextPage);
    } catch (error) {
    } finally {
      setLoadingMore(false);
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
       CustomAlert.success('Success', 'Friend request accepted!');
     } catch (error: any) {
       CustomAlert.error('Error', 'Something went wrong. Please try again.');
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
       CustomAlert.info('Ignored', 'Friend request ignored');
     } catch (error: any) {
       CustomAlert.error('Error', 'Something went wrong. Please try again.');
     }
  };

   const handleApproveCommunity = async (communityId: string, senderId: string, notificationId: string) => {
     try {
       await communityAPI.approveMember(communityId, senderId);
       await notificationAPI.markAsRead(notificationId);
       setNotifications(prev => prev.map(notif =>
         notif._id === notificationId ? { ...notif, isRead: true, message: 'Community join request approved' } : notif
       ));
       CustomAlert.success('Success', 'Member approved!');
     } catch (error: any) {
       CustomAlert.error('Error', 'Something went wrong. Please try again.');
     }
   };

   const handleRejectCommunity = async (communityId: string, senderId: string, notificationId: string) => {
      try {
        await communityAPI.rejectMember(communityId, senderId);
        await notificationAPI.markAsRead(notificationId);
        setNotifications(prev => prev.map(notif =>
          notif._id === notificationId ? { ...notif, isRead: true, message: 'Community join request rejected' } : notif
        ));
        CustomAlert.info('Rejected', 'Join request rejected');
      } catch (error: any) {
        CustomAlert.error('Friend Limit Reached', error?.response?.data?.msg || 'Something went wrong. Please try again.');
      }
  };

   const handleAcceptChatInvitation = async (chatId: string, notificationId: string) => {
     try {
       await chatAPI.acceptInvitation(chatId);
       await notificationAPI.markAsRead(notificationId);
       setNotifications(prev => prev.map(notif =>
         notif._id === notificationId ? { ...notif, isRead: true, message: 'Chat invitation accepted' } : notif
       ));
       CustomAlert.success('Success', 'You have joined the chat!');
     } catch (error: any) {
       CustomAlert.error('Error', 'Something went wrong. Please try again.');
     }
   };

   const handleRejectChatInvitation = async (chatId: string, notificationId: string) => {
     try {
       await chatAPI.rejectInvitation(chatId);
       await notificationAPI.markAsRead(notificationId);
       setNotifications(prev => prev.map(notif =>
         notif._id === notificationId ? { ...notif, isRead: true, message: 'Chat invitation rejected' } : notif
       ));
       CustomAlert.info('Rejected', 'Chat invitation rejected');
     } catch (error: any) {
       CustomAlert.error('Error', 'Something went wrong. Please try again.');
     }
   };



   const handleClearAllNotifications = () => {
     CustomAlert.show({
       type: 'confirm',
       title: 'Clear All Notifications',
       message: 'Are you sure you want to clear all notifications?',
       buttons: [
         { text: 'Cancel', style: 'cancel' },
         {
           text: 'Clear',
           style: 'destructive',
           onPress: async () => {
             try {
               await notificationAPI.clearAll();
               setNotifications([]);
               CustomAlert.success('Success', 'All notifications cleared');
             } catch (error) {
               CustomAlert.error('Error', 'Failed to clear notifications');
             }
           },
         }
       ],
       dismissable: true
     });
   };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationAPI.markAllAsRead();
      setNotifications(prev => prev.map(notif => ({ ...notif, isRead: true })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };



  // Real-time updates via socket when the app is online
  useEffect(() => {
    if (!user) return;
    const socket = getSocket();
    if (!socket) return;

    const handleNewNotification = () => {
      fetchNotifications();
    };

    socket.on('notification:new', handleNewNotification);
    socket.on('new-notification', handleNewNotification);

    return () => {
      socket.off('notification:new', handleNewNotification);
      socket.off('new-notification', handleNewNotification);
    };
  }, [user]);


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

    // Post-like notifications
    if (
      (notification.type === 'tag' ||
        notification.type === 'like' ||
        notification.type === 'comment') &&
      notification.relatedPost
    ) {
      // relatedPost may be populated as an object by the API; normalize to id.
      const postId = typeof notification.relatedPost === 'string'
        ? notification.relatedPost
        : notification.relatedPost?._id;

      if (!postId) return;

      // Comment notifications should land on the post's comments section.
      const focusComments = notification.type === 'comment';

      try {
        const response = await postAPI.getPost(postId);

        if (response?.data) {
          router.push(focusComments ? `/?postId=${postId}&focus=comments` : `/?postId=${postId}`);
        } else {
          CustomAlert.info(
            'Post Deleted',
            'This post has been deleted and the notification has been removed.'
          );
          setNotifications(prev => prev.filter(n => n._id !== notification._id));

          try {
            await notificationAPI.deleteNotification(notification._id);
          } catch {
            // ignore
          }
        }
      } catch (error: any) {
        if (error?.response?.status === 404) {
          CustomAlert.info(
            'Post Deleted',
            'This post has been deleted and the notification has been removed.'
          );
          setNotifications(prev => prev.filter(n => n._id !== notification._id));

          try {
            await notificationAPI.deleteNotification(notification._id);
          } catch {
            // ignore
          }
        } else {
          router.push(focusComments ? `/?postId=${postId}&focus=comments` : `/?postId=${postId}`);
        }
      }

      return;
    }

    // Community notifications
    if (notification.relatedCommunity) {
      try {
        const response = await communityAPI.getCommunity(notification.relatedCommunity);

        if (response?.data) {
          router.push(`/community/${notification.relatedCommunity}`);
        } else {
          CustomAlert.info(
            'Community Deleted',
            'This community has been deleted and the notification has been removed.'
          );
          setNotifications(prev => prev.filter(n => n._id !== notification._id));

          try {
            await notificationAPI.deleteNotification(notification._id);
          } catch {
            // ignore
          }
        }
      } catch (error: any) {
        if (error?.response?.status === 404) {
          CustomAlert.info(
            'Community Deleted',
            'This community has been deleted and the notification has been removed.'
          );
          setNotifications(prev => prev.filter(n => n._id !== notification._id));

          try {
            await notificationAPI.deleteNotification(notification._id);
          } catch {
            // ignore
          }
        } else {
          router.push(`/community/${notification.relatedCommunity}`);
        }
      }

      return;
    }

    // Chat invitations
    if (notification.relatedChat) {
      router.push(`/chat/${notification.relatedChat}`);
    }
  };

  const renderNotification = ({ item }: { item: Notification }) => {
    const isPendingFriendRequest = item.type === 'follow' && item.message === 'sent you a friend request' && !item.isRead;
    const isPendingCommunityRequest = item.type === 'community_join_request' && !item.isRead;
    const isPendingChatInvitation = item.type === 'chat_invitation' && !item.isRead;
    // For accepted/ignored, the message will already be updated by handleAcceptRequest/handleIgnoreRequest
    // So, we just need to make sure buttons don't show if it's not a pending request.

    const count = item.count || 1;
    const isAggregated = count > 1;
    const displaySenders = (item.senders && item.senders.length ? item.senders : [item.sender]).slice(0, 3);
    const extraSenders = Math.max(count - displaySenders.length, 0);
    const primaryName = (item.senders && item.senders[0]?.username) || item.sender.username;
    const others = count - 1;
    const isAnonymousSender = item.sender._id === 'anonymous';

    const renderAvatar = (sender: NotificationSender, index: number) => {
      const source = sender.profilePhoto || sender.avatar;
      return (
        <View
          key={sender._id + index}
          style={[
            styles.avatarContainer,
            { backgroundColor: colors.surface },
            index > 0 && styles.stackedAvatar,
          ]}
        >
          {source ? (
            <Image source={{ uri: getImageUrl(source) }} style={styles.avatar} />
          ) : (
            <Ionicons name="person" size={24} color={colors.lightText} />
          )}
        </View>
      );
    };

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
          <TouchableOpacity
            disabled={isAnonymousSender}
            onPress={() => {
              if (!isAnonymousSender) {
                router.push(`/user/${item.sender._id}`);
              }
            }}
          >
            <View style={styles.avatarStack}>
              {displaySenders.map((sender, i) => renderAvatar(sender, i))}
              {extraSenders > 0 && (
                <View style={[styles.avatarContainer, styles.stackedAvatar, styles.avatarMore]}>
                  <ThemedText style={styles.avatarMoreText}>+{extraSenders}</ThemedText>
                </View>
              )}
            </View>
          </TouchableOpacity>
          <View style={styles.textContainer}>
            <ThemedText>
              <ThemedText style={styles.sender}>
                {isAggregated ? `${primaryName} and ${others} other${others === 1 ? '' : 's'} ` : `${primaryName} `}
              </ThemedText>
              {item.message}
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
                  onPress={() => handleRejectCommunity(item.relatedCommunity!, item.sender._id, item._id)}
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
            onEndReached={loadMoreNotifications}
            onEndReachedThreshold={0.3}
            ListFooterComponent={loadingMore ? <ActivityIndicator style={{ padding: spacing.md }} color={colors.primary} /> : null}
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
    width: sizes.iconLarge + 8,
    height: sizes.iconLarge + 8,
    borderRadius: (sizes.iconLarge + 8) / 2,
  },
  avatarContainer: {
    width: sizes.iconLarge + 8,
    height: sizes.iconLarge + 8,
    borderRadius: (sizes.iconLarge + 8) / 2,
    marginRight: spacing.md, // Consistent spacing
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarStack: {
    flexDirection: 'row',
    marginRight: spacing.md,
    alignItems: 'center',
  },
  stackedAvatar: {
    marginLeft: -spacing.md,
    borderWidth: sizes.borderWidth,
    borderColor: colors.background,
  },
  avatarMore: {
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarMoreText: {
    color: colors.white,
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.bold,
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
    width: sizes.iconSmall,
    height: sizes.iconSmall,
    borderRadius: sizes.iconSmall / 2,
    backgroundColor: colors.primary,
    marginLeft: spacing.sm,
  },
  separator: {
    height: sizes.dividerWidth,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
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
    width: verticalScale(80),
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
    width: sizes.iconLarge + 8,
    height: sizes.iconLarge + 8,
    borderRadius: (sizes.iconLarge + 8) / 2,
    backgroundColor: colors.border,
    marginRight: spacing.md,
  },
  skeletonTextContainer: {
    marginLeft: spacing.md,
    flex: 1,
  },
  skeletonTextLine: {
    height: verticalScale(16),
    backgroundColor: colors.border,
    borderRadius: sizes.borderRadiusSm,
    marginBottom: spacing.xs,
  },
});