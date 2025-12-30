// components/create-story-modal.tsx

import React, { useState } from 'react';
import { Modal, StyleSheet, View, TextInput, TouchableOpacity, ActivityIndicator, Alert, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ThemedView } from './themed-view';
import { ThemedText } from './themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { spacing, borderRadius, typography } from '@/constants/design-tokens';
import { IconSymbol } from './ui/icon-symbol';
import { storyAPI } from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';

interface CreateStoryModalProps {
    visible: boolean;
    onClose: () => void;
    onCreate: () => void;
}

export function CreateStoryModal({ visible, onClose, onCreate }: CreateStoryModalProps) {
    const { user } = useAuth();
    const [content, setContent] = useState('');
    const [image, setImage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const backgroundColor = useThemeColor('background');
    const textColor = useThemeColor('text');
    const primaryColor = useThemeColor('primary');
    const white = useThemeColor('white');
    const lightTextColor = useThemeColor('lightText');

    const handlePickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [9, 16], // Story aspect ratio
            quality: 1,
        });

        if (!result.canceled) {
            setImage(result.assets[0].uri);
        }
    };

    const handleCreateStory = async () => {
        if (!content && !image) {
            Alert.alert('Error', 'Please add some content or an image to your story.');
            return;
        }

        setIsLoading(true);
        try {
            let uploadedImageUrl = undefined;
            if (image) {
                // Convert image to base64 and upload
                const response = await fetch(image);
                const blob = await response.blob();
                const base64 = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.readAsDataURL(blob);
                });
                const filename = `story-image-${Date.now()}.jpg`;
                const uploadResponse = await storyAPI.uploadStoryImageBase64({
                    imageData: base64,
                    filename,
                });
                uploadedImageUrl = uploadResponse.imageUrl;
            }

            await storyAPI.createStory({ content, image: uploadedImageUrl });
            onCreate();
            onClose();
            setContent('');
            setImage(null);
        } catch (error) {
            console.error('Error creating story:', error);
            Alert.alert('Error', 'Failed to create story. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
            <ThemedView style={[styles.container, { backgroundColor }]}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose}>
                        <IconSymbol name="x" size={24} color={textColor} />
                    </TouchableOpacity>
                    <ThemedText style={{ fontSize: typography.sizes.title, fontFamily: typography.families.bold }}>New Story</ThemedText>
                    <TouchableOpacity onPress={handleCreateStory} disabled={isLoading}>
                        {isLoading ? <ActivityIndicator color={primaryColor} /> : <ThemedText style={{ color: primaryColor, fontSize: typography.sizes.title, fontFamily: typography.families.bold }}>Post</ThemedText>}
                    </TouchableOpacity>
                </View>

                <View style={styles.content}>
                    <View style={styles.userInfo}>
                        <Image source={{ uri: user?.profilePhoto || `https://i.pravatar.cc/150?u=${user?._id}` }} style={styles.avatar} />
                        <ThemedText style={{ fontFamily: typography.families.bold }}>{user?.username}</ThemedText>
                    </View>
                    <TextInput
                        style={[styles.input, { color: textColor }]}
                        placeholder="Share a thought..."
                        placeholderTextColor={lightTextColor}
                        value={content}
                        onChangeText={setContent}
                        multiline
                    />
                    {image && <Image source={{ uri: image }} style={styles.previewImage} />}
                </View>

                <View style={styles.actions}>
                    <TouchableOpacity onPress={handlePickImage} style={styles.actionButton}>
                        <IconSymbol name="camera" size={24} color={primaryColor} />
                        <ThemedText style={{ color: primaryColor }}>Photo</ThemedText>
                    </TouchableOpacity>
                </View>
            </ThemedView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    content: {
        padding: spacing.md,
        flex: 1,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: spacing.md,
    },
    input: {
        fontSize: typography.sizes.body1,
        minHeight: 100,
        textAlignVertical: 'top',
    },
    previewImage: {
        width: '100%',
        height: 300, // Adjusted for story aspect ratio
        borderRadius: borderRadius.md,
        marginTop: spacing.md,
    },
    actions: {
        flexDirection: 'row',
        padding: spacing.md,
        borderTopWidth: 1,
        borderTopColor: '#E0E0E0',
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
});
