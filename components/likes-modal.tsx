import React from 'react';
import { Modal, StyleSheet, View, TouchableOpacity, FlatList, ScrollView, Image } from 'react-native';
import { ThemedView } from './themed-view';
import { ThemedText } from './themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { spacing, borderRadius, typography } from '@/constants/design-tokens';
import { Ionicons } from '@expo/vector-icons';
import { ReactionType } from './reaction-picker';
import { getImageUrl } from '@/utils/api';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

interface Like {
    _id: string;
    username: string;
    profilePhoto?: string;
}

interface Reaction {
    user: {
        _id: string;
        username: string;
        profilePhoto?: string;
    };
    type: ReactionType;
    createdAt: string;
}

interface LikesModalProps {
    visible: boolean;
    onClose: () => void;
    likes: Like[];
    reactions?: Reaction[];
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

export function LikesModal({ visible, onClose, likes, reactions = [] }: LikesModalProps) {
    const { user } = useAuth();
    const backgroundColor = useThemeColor('background');
    const textColor = useThemeColor('text');
    const lightTextColor = useThemeColor('lightText');
    const surfaceColor = useThemeColor('surface');
    const router = useRouter();

    // Create a map to track users who have already interacted (either liked or reacted)
    const userInteractionMap = new Map();
    
    // Add likes first
    (likes || []).forEach(user => {
        if (user && user._id) {
            userInteractionMap.set(user._id, { user, type: 'default', _id: `like-${user._id}` });
        }
    });
    
    // Add reactions, replacing any existing interactions from the same user
    (reactions || []).forEach(reaction => {
        if (reaction.user && reaction.user._id) {
            userInteractionMap.set(reaction.user._id, { 
                user: reaction.user, 
                type: reaction.type, 
                _id: `reaction-${reaction.user._id}-${reaction.type}` 
            });
        }
    });
    
    // Convert map to array
    const allInteractions = Array.from(userInteractionMap.values());

    return (
        <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
            <View style={styles.overlay}>
                <ThemedView style={[styles.container, { backgroundColor }]} >
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color={textColor} />
                        </TouchableOpacity>
                        <ThemedText style={[styles.title, { color: textColor }]}>
                            Likes & Reactions ({allInteractions.length})
                        </ThemedText>
                        <View style={{ width: 24 }} />
                    </View>

                    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                        {allInteractions.length > 0 ? (
                            allInteractions.map((item) => {
                                if (!item.user || typeof item.user !== 'object') return null;
                                const iconConfig = REACTION_ICONS[item.type] || REACTION_ICONS.default;
                                
                                return (
                                <TouchableOpacity 
                                    key={item._id} 
                                    style={styles.userRow}
                                    onPress={() => {
                                        if (item.user._id === user?._id) return;
                                        onClose();
                                        router.push(`/user/${item.user._id}`);
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
                                        <ThemedText style={[styles.username, { color: textColor }]}>
                                            {item.user.username}
                                        </ThemedText>
                                    </View>
                                    <Ionicons name={iconConfig.name} size={16} color={iconConfig.color} style={styles.likeIcon} />
                                </TouchableOpacity>
                            )})
                        ) : (
                            <View style={styles.emptyState}>
                                <ThemedText style={[styles.emptyText, { color: lightTextColor }]}>
                                    No likes yet
                                </ThemedText>
                            </View>
                        )}
                    </ScrollView>
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
        maxHeight: '70%',
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
    scrollView: {
        paddingHorizontal: spacing.md,
    },
    userRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
        marginBottom: spacing.xs,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
    },
    likeIcon: {
        marginRight: spacing.xs,
    },
    username: {
        fontSize: typography.sizes.body1,
        fontFamily: typography.families.medium,
    },
    timestamp: {
        fontSize: typography.sizes.caption,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: spacing.xl,
    },
    emptyText: {
        fontSize: typography.sizes.body1,
        textAlign: 'center',
    },
    reactionGroup: {
        marginTop: spacing.md,
    },
    reactionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.sm,
        gap: spacing.sm,
    },
    reactionLabel: {
        fontSize: typography.sizes.body1,
        fontFamily: typography.families.bold,
    },
});
