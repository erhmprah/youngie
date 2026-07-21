// components/chat-tab-icon.tsx

import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { chatAPI } from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';
import { spacing, borderRadius, typography } from '@/constants/design-tokens';
import { getSocket } from '@/utils/socket';

interface ChatTabIconProps {
    color: string;
}

export function ChatTabIcon({ color }: ChatTabIconProps) {
    const { user } = useAuth();
    const [unreadCount, setUnreadCount] = useState(0);
    const primaryColor = useThemeColor('primary');
    const white = useThemeColor('white');

    useEffect(() => {
        const fetchUnreadCount = async () => {
            if (!user?._id) return;

            try {
                const response = await chatAPI.getUserChats(user._id);
                
                // Handle null/undefined response data gracefully
                if (!response?.data) {
                    console.warn('No chat data received, could be offline');
                    setUnreadCount(0);
                    return;
                }
                
                const chats = response.data?.data || [];
                const unread = Array.isArray(chats) ? chats.reduce((count: number, chat: any) => {
                    return count + (chat.unreadCount || 0);
                }, 0) : 0;
                setUnreadCount(unread);
            } catch (error) {
                console.error('Error fetching unread chat count:', error);
                // Silently handle error - keep previous unread count or set to 0
                // This prevents crashes when backend is unreachable
                setUnreadCount(0);
            }
        };

        fetchUnreadCount();

        // Poll every 30 seconds
        const interval = setInterval(fetchUnreadCount, 30000);

        // Refresh immediately when a new message arrives or chats are read
        const socket = getSocket();
        if (socket) {
            socket.on('chatUpdated', fetchUnreadCount);
            socket.on('messages-read', fetchUnreadCount);
        }

        return () => {
            clearInterval(interval);
            if (socket) {
                socket.off('chatUpdated', fetchUnreadCount);
                socket.off('messages-read', fetchUnreadCount);
            }
        };
    }, [user?._id]);

    return (
        <View>
            <IconSymbol size={24} name="message.fill" color={color} />
            {unreadCount > 0 && (
                <View style={[styles.badge, { backgroundColor: primaryColor }]}>
                    <ThemedText style={[styles.badgeText, { color: white }]}>
                        {unreadCount > 99 ? '99+' : unreadCount.toString()}
                    </ThemedText>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        position: 'absolute',
        top: -8,
        right: -8,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    badgeText: {
        fontSize: typography.sizes.tiny,
        fontFamily: typography.families.bold,
    },
});