import React, { useState, useCallback } from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { notificationAPI } from '@/utils/api';
import { getColors } from '@/constants/design-tokens';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function NotificationBell() {
  const { user } = useAuth();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);
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

  const handlePress = () => {
    router.push('/notifications');
  };

  return (
    <TouchableOpacity onPress={handlePress} style={styles.container}>
      <Ionicons name="notifications-outline" size={28} color={colors.text} />
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
    padding: 8,
  },
  badge: {
    position: 'absolute',
    right: -2, // Adjusted position
    top: -2, // Adjusted position
    backgroundColor: colors.error,
    borderRadius: 12, // Slightly larger border radius
    minWidth: 24, // Increased size
    height: 24, // Increased size
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.white, // Always white border for contrast
  },
  badgeText: {
    color: colors.white,
    fontSize: 14, // Larger font size
    fontWeight: 'bold',
  },
});
