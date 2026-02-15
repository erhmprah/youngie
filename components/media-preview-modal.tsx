import React, { useState, useEffect } from 'react';
import { Modal, StyleSheet, View, TouchableOpacity, Image, Dimensions, Text, Alert, ActivityIndicator } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
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
    const [mediaError, setMediaError] = useState(false);

    // Reset error state when attachment or visibility changes
    useEffect(() => {
        setMediaError(false);
    }, [attachment, visible]);

    if (!attachment) return null;

    // Parse attachment if it's a string (for sent media)
    let parsedAttachment = attachment;
    if (typeof attachment === 'string') {
        try {
            parsedAttachment = JSON.parse(attachment);
        } catch (e) {
            console.error('Failed to parse attachment', e);
            return null;
        }
    }
    const isVideo = parsedAttachment.type?.startsWith('video') || parsedAttachment.type === 'video';

    // Handle both uri (composed) and url (sent/received)
    // If uri is already a full URL (http/https), use it directly
    let uri = parsedAttachment.uri || parsedAttachment.url;
    if (!uri) return null;

    // Normalize path separators for Windows backends
    uri = uri.replace(/\\/g, '/');

    // Check if it's already a full URL - if so, use it directly
    const isFullUrl = /^(http|https):/.test(uri);

    // Only run through getImageUrl if it's not already a full URL
    if (!isFullUrl) {
        uri = getImageUrl(uri.startsWith('/') ? uri : `/${uri}`);
    }

    console.log('MediaPreviewModal URI debug:', {
      rawUri: parsedAttachment.uri || parsedAttachment.url,
      finalUri: uri,
      isFullUrl,
      attachment: parsedAttachment
    });

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
            const fileUri = `${(FileSystem as any).documentDirectory}${(parsedAttachment.fileName || `media_${Date.now()}.${parsedAttachment.type?.split('/')[1] || 'jpg'}`)}`;
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
        <Modal visible={visible} transparent={false} presentationStyle="fullScreen" animationType="fade" onRequestClose={onClose}>
            <View style={styles.container}>
                <TouchableOpacity style={[styles.closeButton, { top: insets.top + 10 }]} onPress={onClose}>
                    <IconSymbol name="xmark" size={30} color={white} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.saveButton, { top: insets.top + 10 }]} onPress={handleSave}>
                    <IconSymbol name="square.and.arrow.down" size={30} color={white} />
                </TouchableOpacity>

                <View style={styles.mediaContainer}>
                    <View style={styles.mediaWrapper}>
                        {mediaError ? (
                            <View style={styles.errorContainer}>
                                <IconSymbol name="exclamationmark.triangle" size={48} color={white} />
                                <ThemedText style={{ color: white, marginTop: 8 }}>Failed to load media</ThemedText>
                            </View>
                        ) : (
                            <>
                                {isVideo ? (
                                    <Video
                                        source={{ uri }}
                                        style={styles.media}
                                        useNativeControls
                                        resizeMode={ResizeMode.CONTAIN}
                                        shouldPlay={false}
                                        key={uri}
                                        onError={(e) => {
                                            console.log('Video load error:', e);
                                            setMediaError(true);
                                        }}
                                    />
                                ) : (
                                    <Image
                                        source={{ uri }}
                                        style={styles.media}
                                        resizeMode="contain"
                                        key={uri}
                                        onError={(e) => {
                                            console.log('Media load error:', e.nativeEvent.error, uri);
                                            setMediaError(true);
                                        }}
                                    />
                                )}
                            </>
                        )}
                    </View>
                </View>

                <View style={styles.infoContainer}>
                    <ThemedText style={styles.fileName}>
                        {parsedAttachment.fileName || 'Media file'}
                    </ThemedText>
                    <ThemedText style={styles.fileSize}>
                        {((parsedAttachment.fileSize || parsedAttachment.size || 0) / 1024 / 1024).toFixed(2)} MB
                    </ThemedText>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
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
        maxWidth: width * 0.9,
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
    errorContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 200,
    },
    loadingContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 200,
    },
    fileSize: {
        color: 'white',
        fontSize: 14,
        opacity: 0.8,
    },
});