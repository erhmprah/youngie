import React from 'react';
import { Modal, StyleSheet, View, TouchableOpacity, Image, Dimensions, Text, Alert } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from './ui/icon-symbol';
import { ThemedText } from './themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getImageUrl } from '@/utils/api';

const { width, height } = Dimensions.get('window');

interface MediaPreviewModalProps {
    visible: boolean;
    onClose: () => void;
    attachment: any;
}

export function MediaPreviewModal({ visible, onClose, attachment }: MediaPreviewModalProps) {
    const white = useThemeColor('white');
    const insets = useSafeAreaInsets();

    if (!attachment) return null;

    const isVideo = attachment.type?.startsWith('video') || attachment.type === 'video';

    // Handle both uri (composed) and url (sent/received)
    const rawUri = attachment.uri || attachment.url;
    if (!rawUri) return null;

    // Normalize path separators for Windows backends
    const normalizedUrl = rawUri.replace(/\\/g, '/');

    // Check if it's a local file (file:// or content://)
    const isLocalFile = /^(file|content):/.test(normalizedUrl);

    // Check if it's already a full URL (http, https)
    const isFullUrl = /^(http|https):/.test(normalizedUrl);

    // If it's a local file or full URL, use it directly. Otherwise, use getImageUrl.
    const uri = (isLocalFile || isFullUrl)
      ? normalizedUrl
      : getImageUrl(normalizedUrl.startsWith('/') ? normalizedUrl : `/${normalizedUrl}`);

    const handleSave = async () => {
        try {
            // Request permissions
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission needed', 'Please grant permission to save media to your gallery');
                return;
            }

            // For local files, save directly
            if (isLocalFile) {
                await MediaLibrary.saveToLibraryAsync(uri);
                Alert.alert('Success', 'Media saved to gallery');
                return;
            }

            // For remote files, download first
            const fileUri = `${(FileSystem as any).documentDirectory}${(attachment.fileName || `media_${Date.now()}.${attachment.type?.split('/')[1] || 'jpg'}`)}`;
            const downloadResult = await FileSystem.downloadAsync(uri, fileUri);

            if (downloadResult.status === 200) {
                await MediaLibrary.saveToLibraryAsync(downloadResult.uri);
                Alert.alert('Success', 'Media saved to gallery');
            } else {
                Alert.alert('Error', 'Failed to download media');
            }
        } catch (error) {
            console.error('Save error:', error);
            Alert.alert('Error', 'Failed to save media');
        }
    };

    return (
        <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
            <View style={styles.container}>
                <TouchableOpacity style={[styles.closeButton, { top: insets.top + 10 }]} onPress={onClose}>
                    <IconSymbol name="xmark" size={30} color={white} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.saveButton, { top: insets.top + 10 }]} onPress={handleSave}>
                    <IconSymbol name="square.and.arrow.down" size={30} color={white} />
                </TouchableOpacity>

                <View style={styles.mediaContainer}>
                    <View style={styles.mediaWrapper}>
                        {isVideo ? (
                            <Video
                                source={{ uri }}
                                style={styles.media}
                                useNativeControls
                                resizeMode={ResizeMode.CONTAIN}
                                shouldPlay={false}
                            />
                        ) : (
                            <Image source={{ uri }} style={styles.media} resizeMode="contain" />
                        )}
                    </View>
                </View>

                <View style={styles.infoContainer}>
                    <ThemedText style={styles.fileName}>
                        {attachment.fileName || 'Media file'}
                    </ThemedText>
                    <ThemedText style={styles.fileSize}>
                        {((attachment.fileSize || attachment.size || 0) / 1024 / 1024).toFixed(2)} MB
                    </ThemedText>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.9)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeButton: {
        position: 'absolute',
        right: 20,
        zIndex: 1,
        padding: 10,
    },
    saveButton: {
        position: 'absolute',
        right: 70,
        zIndex: 1,
        padding: 10,
    },
    mediaContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        maxHeight: height * 0.8,
    },
    mediaWrapper: {
        maxWidth: height * 0.7,
        maxHeight: height * 0.7,
    },
    media: {
        width: '100%',
        height: '100%',
        borderRadius: 10,
    },
    infoContainer: {
        position: 'absolute',
        top: 100,
        left: 20,
        right: 20,
        backgroundColor: 'rgba(0,0,0,0.7)',
        padding: 15,
        borderRadius: 10,
    },
    fileName: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 5,
    },
    fileSize: {
        color: 'white',
        fontSize: 14,
        opacity: 0.8,
    },
});