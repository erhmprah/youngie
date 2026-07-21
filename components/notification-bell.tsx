import React, { useState, useCallback, useEffect } from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { notificationAPI } from '@/utils/api';
import { getColors, sizes } from '@/constants/design-tokens';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getSocket } from '@/utils/socket';
import * as Haptics from 'expo-haptics';

export function NotificationBell() {
  const { user } = useAuth();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme as 'light' | 'dark');
  const styles = dynamicStyles(colors);

  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const response = await notificationAPI.getUnreadCount();
      setUnreadCount(response.data.count);
    } catch (error) {
      console.error('Failed to fetch unread notification count:', error);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchUnreadCount();
    }, [fetchUnreadCount])
  );

  // Listen for real-time notifications
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleNewNotification = () => {
      setUnreadCount((prev) => prev + 1);
    };

    socket.on('notification:new', handleNewNotification);

    return () => {
      socket.off('notification:new', handleNewNotification);
    };
  }, []);

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
