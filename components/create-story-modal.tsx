// components/create-story-modal.tsx

import React, { useState } from 'react';
import { Modal, StyleSheet, View, TextInput, TouchableOpacity, ActivityIndicator, Alert, Image, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { ThemedView } from './themed-view';
import { ThemedText } from './themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { spacing, borderRadius, typography } from '@/constants/design-tokens';
import { IconSymbol } from './ui/icon-symbol';
import { MediaPickerButton, MediaPickerResult } from './media-picker-button';
import { storyAPI, getImageUrl } from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';

interface CreateStoryModalProps {
    visible: boolean;
    onClose: () => void;
    onCreate: (forceRefresh?: boolean) => void;
}

export function CreateStoryModal({ visible, onClose, onCreate }: CreateStoryModalProps) {
    const { user } = useAuth();
    const [content, setContent] = useState('');
    const [image, setImage] = useState<string | null>(null);
    const [video, setVideo] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showPoll, setShowPoll] = useState(false);
    const [pollOptions, setPollOptions] = useState(['Yes', 'No']);

    const backgroundColor = useThemeColor('background');
    const textColor = useThemeColor('text');
    const primaryColor = useThemeColor('primary');
    const white = useThemeColor('white');
    const lightTextColor = useThemeColor('lightText');

    const handlePickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [9, 16], // Story aspect ratio
            quality: 1,
        });

        if (!result.canceled) {
            setImage(result.assets[0].uri);
            setVideo(null); // Clear video when selecting image
        }
    };

    const handlePickVideo = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['videos'],
            allowsEditing: true,
            aspect: [9, 16],
            quality: 1,
            videoMaxDuration: 60, // 60 seconds max for stories
        });

        if (!result.canceled) {
            setVideo(result.assets[0].uri);
            setImage(null); // Clear image when selecting video
        }
    };

    // Handle unified media picker selection
    const handleMediaSelected = (result: MediaPickerResult) => {
        if (result.type === 'photo') {
            setImage(result.uri);
            setVideo(null);
        } else if (result.type === 'video') {
            setVideo(result.uri);
            setImage(null);
        }
        // Audio is not supported for stories
    };

    const handleCreateStory = async () => {
        if (!content && !image && !video) {
            Alert.alert('Error', 'Please add some content, an image, or a video to your story.');
            return;
        }

        let finalPollOptions = undefined;
        if (showPoll) {
            const validOptions = pollOptions.filter(o => o.trim().length > 0);
            if (validOptions.length < 2) {
                Alert.alert('Error', 'Poll must have at least 2 options.');
                return;
            }
            finalPollOptions = validOptions.map(opt => ({ text: opt }));
        }

        setIsLoading(true);
        try {
            let uploadedImageUrl = undefined;
            let uploadedVideoUrl = undefined;

            if (image) {
                const base64 = await FileSystem.readAsStringAsync(image, { encoding: 'base64' });
                const filename = `story-image-${Date.now()}.jpg`;
                const uploadResponse = await storyAPI.uploadStoryImageBase64({
                    imageData: `data:image/jpeg;base64,${base64}`,
                    filename,
                });
                uploadedImageUrl = uploadResponse.imageUrl;
            }

            if (video) {
                const base64 = await FileSystem.readAsStringAsync(video, { encoding: 'base64' });
                const filename = `story-video-${Date.now()}.mp4`;
                const uploadResponse = await storyAPI.uploadStoryVideoBase64({
                    videoData: `data:video/mp4;base64,${base64}`,
                    filename,
                });
                uploadedVideoUrl = uploadResponse.videoUrl;
            }

            await storyAPI.createStory({ content, image: uploadedImageUrl, video: uploadedVideoUrl, pollOptions: finalPollOptions });
            onCreate(true);
            onClose();
            setContent('');
            setImage(null);
            setVideo(null);
            setShowPoll(false);
            setPollOptions(['Yes', 'No']);
        } catch (error) {
            console.error('Error creating story:', error);
            Alert.alert('Error', 'Failed to create story. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
            <ThemedView style={[styles.container, { backgroundColor }]} safe>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose}>
                        <IconSymbol name="x" size={24} color={textColor} />
                    </TouchableOpacity>
                    <ThemedText style={{ fontSize: typography.sizes.title, fontFamily: typography.families.bold }}>New Story</ThemedText>
                    <TouchableOpacity onPress={handleCreateStory} disabled={isLoading}>
                        {isLoading ? <ActivityIndicator color={primaryColor} /> : <ThemedText style={{ color: primaryColor, fontSize: typography.sizes.title, fontFamily: typography.families.bold }}>Post</ThemedText>}
                    </TouchableOpacity>
                </View>

                <ScrollView style={styles.content}>
                    <View style={styles.userInfo}>
                        {user?.profilePhoto || user?.avatar ? (
                            <Image source={{ uri: getImageUrl(user?.profilePhoto || user?.avatar) }} style={styles.avatar} />
                        ) : (
                            <View style={[styles.avatar, { backgroundColor: 'rgba(0,0,0,0.1)', justifyContent: 'center', alignItems: 'center' }]}>
                                <IconSymbol name="person.fill" size={20} color={textColor} />
                            </View>
                        )}
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
                    
                    {showPoll && (
                        <View style={styles.pollContainer}>
                            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm}}>
                                <ThemedText style={{fontWeight: 'bold'}}>Poll</ThemedText>
                                <TouchableOpacity onPress={() => setShowPoll(false)}>
                                    <IconSymbol name="x" size={20} color={lightTextColor} />
                                </TouchableOpacity>
                            </View>
                            {pollOptions.map((option, index) => (
                                <TextInput
                                    key={index}
                                    style={[styles.input, styles.pollInput, { color: textColor, borderColor: '#E0E0E0' }]}
                                    placeholder={`Option ${index + 1}`}
                                    placeholderTextColor={lightTextColor}
                                    value={option}
                                    onChangeText={(text) => {
                                        const newOptions = [...pollOptions];
                                        newOptions[index] = text;
                                        setPollOptions(newOptions);
                                    }}
                                />
                            ))}
                            {pollOptions.length < 4 && (
                                <TouchableOpacity onPress={() => setPollOptions([...pollOptions, ''])} style={{marginTop: spacing.xs}}>
                                    <ThemedText style={{ color: primaryColor }}>+ Add Option</ThemedText>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    {image && <Image source={{ uri: image }} style={styles.previewImage} />}
                </ScrollView>

                <View style={styles.actions}>
                    <MediaPickerButton
                        onMediaSelected={handleMediaSelected}
                        icon="camera"
                        size={24}
                        showAudioOption={false}
                    />
                    <TouchableOpacity onPress={() => setShowPoll(!showPoll)} style={styles.actionButton}>
                        <IconSymbol name="chart.bar.fill" size={24} color={primaryColor} />
                        <ThemedText style={{ color: primaryColor }}>Poll</ThemedText>
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
    pollContainer: {
        marginTop: spacing.md,
        padding: spacing.sm,
        backgroundColor: 'rgba(0,0,0,0.03)',
        borderRadius: borderRadius.md,
    },
    pollInput: {
        minHeight: 40,
        marginBottom: spacing.sm,
        paddingVertical: spacing.sm,
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
