// components/create-post-modal.tsx

import React, { useState, useEffect } from 'react';
import { Modal, StyleSheet, View, TextInput, TouchableOpacity, ActivityIndicator, Alert, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { ThemedView } from './themed-view';
import { ThemedText } from './themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { spacing, borderRadius, typography } from '@/constants/design-tokens';
import { postAPI, getImageUrl } from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';

interface CreatePostModalProps {
    visible: boolean;
    onClose: () => void;
    onPost: () => void;
    initialAnonymous?: boolean;
}

export function CreatePostModal({ visible, onClose, onPost, initialAnonymous = false }: CreatePostModalProps) {
    const { user } = useAuth();
    const [content, setContent] = useState('');
    const [image, setImage] = useState<string | null>(null);
    const [video, setVideo] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isPublic, setIsPublic] = useState(true);
    const [isAnonymous, setIsAnonymous] = useState(initialAnonymous);
    const [commentsDisabled, setCommentsDisabled] = useState(false);

    useEffect(() => {
        if (visible) {
            setIsAnonymous(initialAnonymous);
        }
    }, [visible, initialAnonymous]);

    const backgroundColor = useThemeColor('background');
    const textColor = useThemeColor('text');
    const primaryColor = useThemeColor('primary');
    const white = useThemeColor('white');
    const lightTextColor = useThemeColor('lightText');
    const surfaceColor = useThemeColor('surface');

    const handlePickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 1,
        });

        if (!result.canceled) {
            setImage(result.assets[0].uri);
            setVideo(null); // Clear video if image is selected
        }
    };

    const handlePickVideo = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 1,
        });

        if (!result.canceled) {
            setVideo(result.assets[0].uri);
            setImage(null); // Clear image if video is selected
        }
    };

    const handlePost = async () => {
        if (!content && !image && !video) {
            Alert.alert('Error', 'Please add some content, an image, or a video to your post.');
            return;
        }

        setIsLoading(true);
        try {
            let imageUrl = undefined;
            let videoUrl = undefined;

            // Upload image if selected
            if (image) {
                const base64 = await FileSystem.readAsStringAsync(image, { encoding: 'base64' });
                const filename = `post-image-${Date.now()}.jpg`;
                const uploadResponse = await postAPI.uploadPostImageBase64({
                    imageData: `data:image/jpeg;base64,${base64}`,
                    filename
                });
                imageUrl = uploadResponse.imageUrl;
            }

            // Upload video if selected
            if (video) {
                const base64 = await FileSystem.readAsStringAsync(video, { encoding: 'base64' });
                const filename = `post-video-${Date.now()}.mp4`;
                const uploadResponse = await postAPI.uploadPostVideoBase64({
                    videoData: `data:video/mp4;base64,${base64}`,
                    filename
                });
                videoUrl = uploadResponse.videoUrl;
            }

            // Create post with uploaded media URLs
            await postAPI.createPost({
                content: content.trim() || undefined,
                image: imageUrl,
                video: videoUrl,
                isPublic,
                isAnonymous,
                commentsDisabled
            });

            onPost();
            onClose();
            setContent('');
            setImage(null);
            setVideo(null);
        } catch (error) {
            console.error('Error creating post:', error);
            Alert.alert('Error', 'Failed to create post. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
            <ThemedView style={[styles.container, { backgroundColor }]}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose}>
                        <Ionicons name="close" size={24} color={textColor} />
                    </TouchableOpacity>
                    <ThemedText style={{ fontSize: typography.sizes.title, fontFamily: typography.families.bold }}>New Post</ThemedText>
                    <TouchableOpacity onPress={handlePost} disabled={isLoading}>
                        {isLoading ? <ActivityIndicator color={primaryColor} /> : <ThemedText style={{ color: primaryColor, fontSize: typography.sizes.title, fontFamily: typography.families.bold }}>Post</ThemedText>}
                    </TouchableOpacity>
                </View>

                <View style={styles.content}>
                    <View style={styles.userInfo}>
                        {isAnonymous ? (
                            <Image source={{ uri: 'https://i.pravatar.cc/150?u=anon' }} style={styles.avatar} />
                        ) : user?.profilePhoto ? (
                            <Image source={{ uri: getImageUrl(user.profilePhoto) }} style={styles.avatar} />
                        ) : (
                            <View style={[styles.avatar, { backgroundColor: surfaceColor, justifyContent: 'center', alignItems: 'center' }]}><Ionicons name="person" size={20} color={lightTextColor} /></View>
                        )}
                        <View>
                            <ThemedText style={{ fontFamily: typography.families.bold }}>
                                {isAnonymous ? 'Anonymous' : user?.username}
                            </ThemedText>
                        </View>
                    </View>
                    <TextInput
                        style={[styles.input, { color: textColor }]}
                        placeholder="What's on your mind?"
                        placeholderTextColor={lightTextColor}
                        value={content}
                        onChangeText={setContent}
                        multiline
                    />
                    {image && <Image source={{ uri: image }} style={styles.previewImage} />}
                    {video && (
                        <Video
                            source={{ uri: video }}
                            style={styles.previewVideo}
                            useNativeControls
                            resizeMode={ResizeMode.CONTAIN}
                            isLooping={false}
                        />
                    )}
                </View>

                <View style={styles.actions}>
                    <TouchableOpacity onPress={handlePickImage} style={styles.actionButton}>
                        <Ionicons name="camera" size={24} color={primaryColor} />
                        <ThemedText style={{ color: primaryColor }}>Photo</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handlePickVideo} style={styles.actionButton}>
                        <Ionicons name="videocam" size={24} color={primaryColor} />
                        <ThemedText style={{ color: primaryColor }}>Video</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setIsPublic(!isPublic)} style={styles.actionButton}>
                        <Ionicons name={isPublic ? "globe" : "people"} size={24} color={primaryColor} />
                        <ThemedText style={{ color: primaryColor }}>{isPublic ? 'Public' : 'Friends'}</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setIsAnonymous(!isAnonymous)} style={styles.actionButton}>
                        <Ionicons name={isAnonymous ? "glasses" : "person"} size={24} color={primaryColor} />
                        <ThemedText style={{ color: primaryColor }}>{isAnonymous ? 'Incognito' : 'Visible'}</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setCommentsDisabled(!commentsDisabled)} style={styles.actionButton}>
                        <Ionicons name={commentsDisabled ? "chatbox-ellipses-outline" : "chatbox-ellipses"} size={24} color={primaryColor} />
                        <ThemedText style={{ color: primaryColor }}>{commentsDisabled ? 'No Comments' : 'Comments'}</ThemedText>
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
        height: 200,
        borderRadius: borderRadius.md,
        marginTop: spacing.md,
    },
    previewVideo: {
        width: '100%',
        height: 200,
        borderRadius: borderRadius.md,
        marginTop: spacing.md,
    },
    actions: {
        flexDirection: 'row',
        padding: spacing.md,
        borderTopWidth: 1,
        borderTopColor: '#E0E0E0',
        gap: spacing.md,
        flexWrap: 'wrap',
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
});
