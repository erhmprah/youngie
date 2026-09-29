import React, { useState, useCallback, useEffect, useRef } from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { cachedNotificationAPI } from '@/utils/cachedApi';
import { getColors, sizes } from '@/constants/design-tokens';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getSocket } from '@/utils/socket';
import {
  getUnreadNotificationCount,
  setUnreadNotificationCount,
  subscribeUnreadNotificationCount,
  subscribeUnreadNotificationInvalidated,
} from '@/utils/unreadStore';
import * as Haptics from 'expo-haptics';

export function NotificationBell() {
  const { user } = useAuth();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(getUnreadNotificationCount());
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme as 'light' | 'dark');
  const styles = dynamicStyles(colors);
  const fetchInProgressRef = useRef(false);
  const pendingRefetchRef = useRef(false);
  const lastFetchTimeRef = useRef(0);

  const fetchUnreadCount = useCallback(async (force = false) => {
    if (!user) return;

    // Prevent concurrent fetches, but never drop a forced refresh: remember it
    // and re-run as soon as the in-flight request settles.
    if (fetchInProgressRef.current) {
      if (force) pendingRefetchRef.current = true;
      return;
    }

    // Debounce: minimum 15 seconds between fetches (unless forced)
    const now = Date.now();
    if (!force && now - lastFetchTimeRef.current < 15000) {
      return;
    }

    fetchInProgressRef.current = true;
    lastFetchTimeRef.current = now;

    try {
      // `force` must also bypass the cached total, otherwise the badge keeps
      // the pre-read count for the whole cache TTL.
      const response = await cachedNotificationAPI.getUnreadCount(force);
      if (response?.data?.count !== undefined) {
        setUnreadNotificationCount(response.data.count);
      }
    } catch (error) {
      console.error('Failed to fetch unread notification count:', error);
    } finally {
      fetchInProgressRef.current = false;
      if (pendingRefetchRef.current) {
        pendingRefetchRef.current = false;
        fetchUnreadCount(true);
      }
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchUnreadCount(true);
    }, [fetchUnreadCount])
  );

  useEffect(() => {
    setUnreadCount(getUnreadNotificationCount());
    return subscribeUnreadNotificationCount(setUnreadCount);
  }, []);

  // Reading a notification (single, all, delete, clear) invalidates the
  // count; refetch immediately so the badge clears without waiting for focus.
  useEffect(() => {
    return subscribeUnreadNotificationInvalidated(() => {
      fetchUnreadCount(true);
    });
  }, [fetchUnreadCount]);

  // Listen for real-time notifications
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // Refetch instead of blindly incrementing: the local total can be stale
    // and a `notification:new` may not always mean a new unread item.
    const handleNewNotification = () => {
      fetchUnreadCount(true);
    };

    socket.on('notification:new', handleNewNotification);
    socket.on('new-notification', handleNewNotification);
    socket.on('notification:read', handleNewNotification);
    socket.on('notification:read-all', handleNewNotification);

    return () => {
      socket.off('notification:new', handleNewNotification);
      socket.off('new-notification', handleNewNotification);
      socket.off('notification:read', handleNewNotification);
      socket.off('notification:read-all', handleNewNotification);
    };
  }, [fetchUnreadCount]);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/notifications');
  };

  return (
    <TouchableOpacity onPress={handlePress} style={styles.container}>
      <Ionicons name="notifications-outline" size={sizes.iconMedium} color={colors.text} />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const dynamicStyles = (colors: ReturnType<typeof getColors>) => StyleSheet.create({
  container: {
    padding: 0,
    width: sizes.iconLarge,
    height: sizes.iconLarge,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    right: 2,
    top: 2,
    backgroundColor: colors.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  badgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: 'bold',
    lineHeight: 12,
  },
});
