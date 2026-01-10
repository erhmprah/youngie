import React from 'react';
import { Modal, StyleSheet, View, TouchableOpacity, FlatList, Image, ScrollView } from 'react-native';
import { ThemedView } from './themed-view';
import { ThemedText } from './themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { spacing, borderRadius, typography } from '@/constants/design-tokens';
import { Ionicons } from '@expo/vector-icons';
import { getImageUrl } from '@/utils/api';
import { useRouter } from 'expo-router';

interface User {
    _id: string;
    username: string;
    profilePhoto?: string;
}

interface Viewer {
    user: User;
    viewedAt: string;
}

interface Reaction {
    user: User;
    type: string;
}

interface StoryViewersModalProps {
    visible: boolean;
    onClose: () => void;
    viewers: Viewer[];
    reactions: Reaction[];
    onUserSelect?: (userId: string) => void;
}

const REACTION_ICONS: Record<string, { name: keyof typeof Ionicons.glyphMap; color: string }> = {
    like: { name: 'thumbs-up', color: '#4A90E2' },
    heart: { name: 'heart', color: '#E0245E' },
    laugh: { name: 'happy', color: '#F7B500' },
    wow: { name: 'star', color: '#9013FE' },
    sad: { name: 'sad', color: '#F5A623' },
    fire: { name: 'flame', color: '#FF5722' },
    default: { name: 'heart', color: '#E0245E' }
};

export function StoryViewersModal({ visible, onClose, viewers = [], reactions = [], onUserSelect }: StoryViewersModalProps) {
    const backgroundColor = useThemeColor('background');
    const textColor = useThemeColor('text');
    const lightTextColor = useThemeColor('lightText');
    const surfaceColor = useThemeColor('surface');
    const router = useRouter();

    // Create a map of reactions by user ID for easy lookup
    const reactionMap = new Map();
    reactions.forEach(r => {
        const userId = r.user && (r.user._id || r.user.toString());
        if (userId) {
            reactionMap.set(userId, r.type);
        }
    });

    const viewerIds = new Set();
    const combinedList: any[] = [];

    // Add viewers
    viewers.forEach(v => {
        const userId = v.user && (v.user._id || v.user.toString());
        if (userId && typeof v.user === 'object') {
            viewerIds.add(userId);
            combinedList.push({
                user: v.user,
                viewedAt: v.viewedAt,
                reaction: reactionMap.get(userId)
            });
        }
    });

    // Add reactors who are not in viewers list
    reactions.forEach(r => {
        const userId = r.user && (r.user._id || r.user.toString());
        if (userId && typeof r.user === 'object' && !viewerIds.has(userId)) {
            combinedList.push({
                user: r.user,
                viewedAt: null,
                reaction: r.type
            });
        }
    });

    // Sort by viewedAt desc (most recent first)
    combinedList.sort((a, b) => {
        if (a.viewedAt && b.viewedAt) return new Date(b.viewedAt).getTime() - new Date(a.viewedAt).getTime();
        if (a.viewedAt) return -1;
        if (b.viewedAt) return 1;
        return 0;
    });

    // Calculate reaction counts
    const reactionCounts = reactions.reduce((acc, r) => {
        acc[r.type] = (acc[r.type] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return (
        <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
             <View style={styles.overlay}>
                <ThemedView style={[styles.container, { backgroundColor }]}>
                    <View style={styles.header}>
                        <ThemedText style={[styles.title, { color: textColor }]}>
                            Viewers & Reactions
                        </ThemedText>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color={textColor} />
                        </TouchableOpacity>
                    </View>

                    {Object.keys(reactionCounts).length > 0 && (
                        <View style={styles.reactionSummary}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reactionSummaryContent}>
                                {Object.entries(reactionCounts).map(([type, count]) => {
                                    const iconConfig = REACTION_ICONS[type] || REACTION_ICONS.default;
                                    return (
                                        <View key={type} style={[styles.reactionBadge, { backgroundColor: surfaceColor }]}>
                                            <Ionicons name={iconConfig.name} size={16} color={iconConfig.color} />
                                            <ThemedText style={[styles.reactionCount, { color: textColor }]}>
                                                {count}
                                            </ThemedText>
                                        </View>
                                    );
                                })}
                            </ScrollView>
                        </View>
                    )}

                    <FlatList
                        data={combinedList}
                        keyExtractor={(item) => item.user._id}
                        showsVerticalScrollIndicator={false}
                        renderItem={({ item }) => {
                            const iconConfig = item.reaction ? (REACTION_ICONS[item.reaction] || REACTION_ICONS.default) : null;
                            
                            return (
                                <TouchableOpacity 
                                    style={styles.userRow}
                                    onPress={() => {
                                        if (onUserSelect) {
                                            onUserSelect(item.user._id);
                                        } else {
                                            onClose();
                                            router.push(`/user/${item.user._id}`);
                                        }
                                    }}
                                >
                                    <View style={styles.userInfo}>
                                        {item.user.profilePhoto ? (
                                            <Image source={{ uri: getImageUrl(item.user.profilePhoto) }} style={styles.avatar} />
                                        ) : (
                                            <View style={[styles.avatar, { backgroundColor: surfaceColor, justifyContent: 'center', alignItems: 'center' }]}>
                                                <Ionicons name="person" size={16} color={lightTextColor} />
                                            </View>
                                        )}
                                        <View>
                                            <ThemedText style={[styles.username, { color: textColor }]}>{item.user.username}</ThemedText>
                                            {item.viewedAt && (
                                                <ThemedText style={[styles.timestamp, { color: lightTextColor }]}>
                                                    {new Date(item.viewedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </ThemedText>
                                            )}
                                        </View>
                                    </View>
                                    {iconConfig && (
                                        <Ionicons name={iconConfig.name} size={20} color={iconConfig.color} />
                                    )}
                                </TouchableOpacity>
                            );
                        }}
                        ListEmptyComponent={
                            <View style={styles.emptyState}>
                                <ThemedText style={{ color: lightTextColor }}>No views yet</ThemedText>
                            </View>
                        }
                    />
                </ThemedView>
             </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    container: {
        height: '60%',
        borderTopLeftRadius: borderRadius.lg,
        borderTopRightRadius: borderRadius.lg,
        paddingBottom: spacing.xl,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.1)',
    },
    closeButton: {
        padding: spacing.xs,
    },
    title: {
        fontSize: typography.sizes.title,
        fontFamily: typography.families.bold,
    },
    userRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    username: {
        fontSize: typography.sizes.body1,
        fontFamily: typography.families.medium,
    },
    timestamp: {
        fontSize: typography.sizes.caption,
    },
    emptyState: {
        padding: spacing.xl,
        alignItems: 'center',
    },
    reactionSummary: {
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    reactionSummaryContent: {
        paddingHorizontal: spacing.md,
        gap: spacing.sm,
    },
    reactionBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: borderRadius.full,
        gap: 4,
    },
    reactionCount: {
        fontSize: typography.sizes.caption,
        fontFamily: typography.families.bold,
    },
});