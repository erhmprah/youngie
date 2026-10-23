// components/chat-tab-icon.tsx

import React, { useState, useEffect, useRef, useCallback, ComponentProps } from 'react';
import { View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { cachedChatAPI } from '@/utils/cachedApi';
import { useAuth } from '@/contexts/AuthContext';
import { spacing, borderRadius, typography } from '@/constants/design-tokens';
import { getSocket } from '@/utils/socket';
import {
    getUnreadChatCount,
    setUnreadChatCount,
    subscribeUnreadChatCount,
    subscribeUnreadChatInvalidated,
} from '@/utils/unreadStore';

interface ChatTabIconProps {
    color: ComponentProps<typeof Feather>['color'];
}

export function ChatTabIcon({ color }: ChatTabIconProps) {
    const { user } = useAuth();
    const [unreadCount, setUnreadCount] = useState(getUnreadChatCount());
    const primaryColor = useThemeColor('primary');
    const white = useThemeColor('white');
    const fetchInProgressRef = useRef(false);
    const pendingRefetchRef = useRef(false);
    const lastFetchTimeRef = useRef(0);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    const fetchUnreadCount = useCallback(async (force = false) => {
        if (!user?._id) return;

        // Prevent concurrent fetches, but never drop a forced refresh: remember
        // it and re-run as soon as the in-flight request settles.
        if (fetchInProgressRef.current) {
            if (force) pendingRefetchRef.current = true;
            return;
        }

        // Debounce: minimum 10 seconds between fetches (unless forced)
        const now = Date.now();
        if (!force && now - lastFetchTimeRef.current < 10000) {
            return;
        }

        fetchInProgressRef.current = true;
        lastFetchTimeRef.current = now;

        try {
            const response = await cachedChatAPI.getUnreadCount();
            if (response?.data?.count !== undefined) {
                setUnreadChatCount(response.data.count);
            }
        } catch (error) {
            console.error('Error fetching unread chat count:', error);
            // Silently handle error - keep previous unread count or set to 0
            // This prevents crashes when backend is unreachable
        } finally {
            fetchInProgressRef.current = false;
            if (pendingRefetchRef.current) {
                pendingRefetchRef.current = false;
                fetchUnreadCount(true);
            }
        }
    }, [user?._id]);

    const debouncedFetch = useCallback(() => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(() => {
            fetchUnreadCount(true);
        }, 500);
    }, [fetchUnreadCount]);

    useEffect(() => {
        setUnreadCount(getUnreadChatCount());
        return subscribeUnreadChatCount(setUnreadCount);
    }, []);

    useEffect(() => {
        // Initial fetch
        fetchUnreadCount(true);

        // Poll every 60 seconds (reduced from 30s to reduce rate limiting)
        const interval = setInterval(() => fetchUnreadCount(), 60000);

        // Refresh when socket events indicate changes (debounced)
        const socket = getSocket();
        if (socket) {
            socket.on('chatUpdated', debouncedFetch);
            socket.on('messages-read', debouncedFetch);
        }

        // Opening a chat / reading messages invalidates the count locally;
        // refetch immediately so the badge clears without waiting for the poll.
        const unsubscribeInvalidation = subscribeUnreadChatInvalidated(() => {
            fetchUnreadCount(true);
        });

        return () => {
            clearInterval(interval);
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
            if (socket) {
                socket.off('chatUpdated', debouncedFetch);
                socket.off('messages-read', debouncedFetch);
            }
            unsubscribeInvalidation();
        };
    }, [user?._id, fetchUnreadCount, debouncedFetch]);

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