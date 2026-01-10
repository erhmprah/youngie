import React from 'react';
import { Modal, StyleSheet, View, TouchableOpacity, FlatList, ScrollView } from 'react-native';
import { ThemedView } from './themed-view';
import { ThemedText } from './themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { spacing, borderRadius, typography } from '@/constants/design-tokens';
import { Ionicons } from '@expo/vector-icons';
import { ReactionType } from './reaction-picker';

interface Reaction {
    user: {
        _id: string;
        username: string;
    };
    type: ReactionType;
    createdAt: string;
}

interface ReactionModalProps {
    visible: boolean;
    onClose: () => void;
    reactions: Reaction[];
}

const REACTION_CONFIG: { type: ReactionType; icon: keyof typeof Ionicons.glyphMap; color: string; label: string }[] = [
    { type: 'like', icon: 'thumbs-up', color: '#4A90E2', label: 'Like' },
    { type: 'heart', icon: 'heart', color: '#E0245E', label: 'Love' },
    { type: 'laugh', icon: 'happy', color: '#F7B500', label: 'Haha' },
    { type: 'wow', icon: 'star', color: '#9013FE', label: 'Wow' },
    { type: 'sad', icon: 'sad', color: '#F5A623', label: 'Sad' },
    { type: 'fire', icon: 'flame', color: '#FF5722', label: 'Fire' },
];

export function ReactionModal({ visible, onClose, reactions }: ReactionModalProps) {
    const backgroundColor = useThemeColor('background');
    const textColor = useThemeColor('text');
    const lightTextColor = useThemeColor('lightText');
    const surfaceColor = useThemeColor('surface');

    // Group reactions by type
    const groupedReactions = reactions.reduce((acc, reaction) => {
        if (!acc[reaction.type]) {
            acc[reaction.type] = [];
        }
        acc[reaction.type].push(reaction);
        return acc;
    }, {} as Record<ReactionType, Reaction[]>);

    // Sort reaction types by count (most popular first)
    const sortedReactionTypes = Object.keys(groupedReactions).sort((a, b) =>
        groupedReactions[b as ReactionType].length - groupedReactions[a as ReactionType].length
    ) as ReactionType[];

    const renderReactionGroup = (reactionType: ReactionType) => {
        const reactionsForType = groupedReactions[reactionType];
        const config = REACTION_CONFIG.find(c => c.type === reactionType);

        if (!config) return null;

        return (
            <View key={reactionType} style={styles.reactionGroup}>
                <View style={styles.reactionHeader}>
                    <Ionicons name={config.icon} size={24} color={config.color} />
                    <ThemedText style={[styles.reactionLabel, { color: textColor }]}>
                        {config.label} ({reactionsForType.length})
                    </ThemedText>
                </View>
                <FlatList
                    data={reactionsForType}
                    keyExtractor={(item) => `${item.user._id}-${item.createdAt}`}
                    renderItem={({ item }) => (
                        <View style={styles.userRow}>
                            <View style={styles.userInfo}>
                                <Ionicons name={config.icon} size={16} color={config.color} style={styles.reactionIcon} />
                                <ThemedText style={[styles.username, { color: textColor }]}>
                                    {item.user.username}
                                </ThemedText>
                            </View>
                            <ThemedText style={[styles.timestamp, { color: lightTextColor }]}>
                                {new Date(item.createdAt).toLocaleDateString()}
                            </ThemedText>
                        </View>
                    )}
                    scrollEnabled={false}
                />
            </View>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
            <View style={styles.overlay}>
                <ThemedView style={[styles.container, { backgroundColor }]}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color={textColor} />
                        </TouchableOpacity>
                        <ThemedText style={[styles.title, { color: textColor }]}>
                            Reactions ({reactions.length})
                        </ThemedText>
                        <View style={{ width: 24 }} />
                    </View>

                    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                        {sortedReactionTypes.map(renderReactionGroup)}
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
        flex: 1,
        paddingHorizontal: spacing.md,
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
    userRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
        marginLeft: spacing.xl,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    reactionIcon: {
        marginRight: spacing.xs,
    },
    username: {
        fontSize: typography.sizes.body1,
        fontFamily: typography.families.medium,
    },
    timestamp: {
        fontSize: typography.sizes.caption,
    },
});
