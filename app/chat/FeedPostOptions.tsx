import React from 'react';
import { Modal, StyleSheet, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { spacing, borderRadius, typography } from '@/constants/design-tokens';

interface FeedPostOptionsProps {
    visible: boolean;
    onClose: () => void;
    isOwner: boolean;
    onEdit?: () => void;
    onDelete?: () => void;
    onReport?: () => void;
}

export function FeedPostOptions({ 
    visible, 
    onClose, 
    isOwner, 
    onEdit, 
    onDelete, 
    onReport 
}: FeedPostOptionsProps) {
    const backgroundColor = useThemeColor('surface');
    const textColor = useThemeColor('text');
    const dangerColor = '#ff4444';

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback onPress={() => {}}>
                        <ThemedView style={[styles.container, { backgroundColor }]}>
                            {isOwner ? (
                                <>
                                    <TouchableOpacity style={styles.option} onPress={() => { onClose(); onEdit?.(); }}>
                                        <Ionicons name="pencil" size={24} color={textColor} style={styles.icon} />
                                        <ThemedText>Edit Post</ThemedText>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.option} onPress={() => { onClose(); onDelete?.(); }}>
                                        <Ionicons name="trash" size={24} color={dangerColor} style={styles.icon} />
                                        <ThemedText style={{ color: dangerColor }}>Delete Post</ThemedText>
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <TouchableOpacity style={styles.option} onPress={() => { onClose(); onReport?.(); }}>
                                    <Ionicons name="flag" size={24} color={textColor} style={styles.icon} />
                                    <ThemedText>Report Post</ThemedText>
                                </TouchableOpacity>
                            )}
                        </ThemedView>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        width: '80%',
        borderRadius: borderRadius.md,
        padding: spacing.sm,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
    },
    icon: {
        marginRight: spacing.md,
    },
});