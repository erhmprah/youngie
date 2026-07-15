import React from 'react';
import { Modal, StyleSheet, View, TouchableOpacity, ScrollView, Image } from 'react-native';
import { ThemedView } from './themed-view';
import { ThemedText } from './themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { spacing, borderRadius, typography } from '@/constants/design-tokens';
import { Ionicons } from '@expo/vector-icons';
import { getImageUrl } from '@/utils/api';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

interface Like {
    _id: string;
    username: string;
    profilePhoto?: string;
}

interface LikesModalProps {
    visible: boolean;
    onClose: () => void;
    likes: Like[];
}

export function LikesModal({ visible, onClose, likes }: LikesModalProps) {
    const { user } = useAuth();
    const backgroundColor = useThemeColor('background');
    const textColor = useThemeColor('text');
    const lightTextColor = useThemeColor('lightText');
    const surfaceColor = useThemeColor('surface');
    const router = useRouter();

    const interactions = likes || [];

    return (
        <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
            <View style={styles.overlay}>
                <ThemedView style={[styles.container, { backgroundColor }]} >
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color={textColor} />
                        </TouchableOpacity>
                        <ThemedText style={[styles.title, { color: textColor }]}>
                            Likes ({interactions.length})
                        </ThemedText>
                        <View style={{ width: 24 }} />
                    </View>

                    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                        {interactions.length > 0 ? (
                            interactions.map((item) => {
                                if (!item || typeof item !== 'object') return null;

                                return (
                                <TouchableOpacity 
                                    key={item._id} 
                                    style={styles.userRow}
                                    onPress={() => {
                                        if (item._id === user?._id || item._id === 'anonymous') return;
                                        onClose();
                                        router.push(`/user/${item._id}`);
                                    }}
                                >
                                    <View style={styles.userInfo}>
                                        {item.profilePhoto ? (
                                            <Image source={{ uri: getImageUrl(item.profilePhoto) }} style={styles.avatar} />
                                        ) : (
                                            <View style={[styles.avatar, { backgroundColor: surfaceColor, justifyContent: 'center', alignItems: 'center' }]}>
                                                <Ionicons name="person" size={16} color={lightTextColor} />
                                            </View>
                                        )}
                                        <ThemedText style={[styles.username, { color: textColor }]}>
                                            {item.username}
                                        </ThemedText>
                                    </View>
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
        borderBottomColor: 'rgba(0,0.1)',
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
    username: {
        fontSize: typography.sizes.body1,
        fontFamily: typography.families.medium,
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
});
