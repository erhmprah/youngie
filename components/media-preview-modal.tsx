import { useThemeColor } from '@/hooks/use-theme-color';
import { getImageUrl } from '@/utils/api';
import { ResizeMode, Video } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { useEffect, useState } from 'react';
import { Alert, Dimensions, Image, Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from './themed-text';
import { IconSymbol } from './ui/icon-symbol';

const { width, height } = Dimensions.get('window')

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

    const parseAttachment = (value: any): any => {
        if (typeof value === 'string') {
            try {
                return JSON.parse(value);
            } catch {
                return { uri: value };
            }
        }
        return value;
    };

    const extractUri = (value: any): string | undefined => {
        if (!value) return undefined;

        if (typeof value === 'string') {
            return value;
        }

        if (typeof value === 'object') {
            const fallbackKeys = [
                'uri',
                'url',
                'mediaUrl',
                'imageUrl',
                'thumbnailUrl',
                'downloadUrl',
                'fileUrl',
                'videoUrl',
                'source',
                'src',
                'path',
                'image',
                'photo',
                'file',
                'attachment',
            ];

            for (const key of fallbackKeys) {
                const candidate = value[key];
                if (typeof candidate === 'string' && candidate.length > 0) {
                    return candidate;
                }
                if (typeof candidate === 'object') {
                    const nested = extractUri(candidate);
                    if (nested) return nested;
                }
            }

            for (const key of Object.keys(value)) {
                const candidate = value[key];
                if (typeof candidate === 'string' && /^(https?:)?\/\//.test(candidate)) {
                    return candidate;
                }
                if (typeof candidate === 'string' && /\.(jpg|jpeg|png|gif|mp4|mov|avi|mkv|webm)(\?|$)/i.test(candidate)) {
                    return candidate;
                }
            }
        }

        return undefined;
    };

    const parsedAttachment = parseAttachment(attachment);
    let uri = extractUri(parsedAttachment);

    if (!uri && typeof attachment === 'string') {
        uri = attachment;
    }
    if (!uri) return null;

    const normalizedUri = String(uri).trim().replace(/\\/g, '/');
    const normalizedPath = normalizedUri.startsWith('/') ? normalizedUri : `/${normalizedUri}`;
    const finalUri = /^(http|https):/.test(normalizedUri)
        ? normalizedUri
        : normalizedUri.startsWith('//')
            ? `http:${normalizedUri}`
            : getImageUrl(normalizedPath) || normalizedUri;
    const uriToDisplay = encodeURI(finalUri);

    const inferType = (value: any, fallback: string): string => {
        if (!value) return fallback;
        if (typeof value === 'string' && value.startsWith('video')) return 'video';
        if (typeof value === 'string' && value.startsWith('image')) return 'image';
        if (typeof value === 'string' && /\.(mp4|mov|avi|mkv|webm)(\?|$)/i.test(value)) return 'video';
        if (typeof value === 'string' && /\.(jpe?g|png|gif|webp|bmp|heic)(\?|$)/i.test(value)) return 'image';
        return fallback;
    };

    const type = parsedAttachment.type ?? parsedAttachment.mimeType ?? parsedAttachment.contentType ?? inferType(finalUri, 'image');
    const isVideo = type === 'video' || (typeof type === 'string' && type.startsWith('video'));
    const isLocalFile = uriToDisplay.startsWith('file://');

    console.log('MediaPreviewModal URI debug:', {
      rawUri: parsedAttachment.uri ?? parsedAttachment.url ?? parsedAttachment.mediaUrl ?? parsedAttachment.imageUrl ?? parsedAttachment.thumbnailUrl ?? parsedAttachment.downloadUrl,
      finalUri: uriToDisplay,
      isLocalFile,
      attachment: parsedAttachment,
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
                                        source={{ uri: uriToDisplay }}
                                        style={styles.media}
                                        useNativeControls
                                        resizeMode={ResizeMode.CONTAIN}
                                        shouldPlay={false}
                                        key={uriToDisplay}
                                        onError={(e) => {
                                            console.log('Video load error:', e);
                                            setMediaError(true);
                                        }}
                                    />
                                ) : (
                                    <Image
                                        source={
                                            mediaError
                                                ? require('@/assets/placeholder-gray.png')
                                                : { uri: uriToDisplay }
                                        }
                                        style={styles.media}
                                        resizeMode="contain"
                                        key={uriToDisplay}
                                        onLoadStart={() => {
                                            console.log('Media load started', uriToDisplay);
                                        }}
                                        onLoad={() => {
                                            console.log('Media loaded successfully', uriToDisplay);
                                        }}
                                        onError={(e) => {
                                            console.log('Media load error:', e.nativeEvent.error, uriToDisplay);
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
                    {(() => {
                        const rawSize = parsedAttachment.fileSize ?? parsedAttachment.size;
                        if (typeof rawSize === 'number' && rawSize > 0) {
                            return (
                                <ThemedText style={styles.fileSize}>
                                    {(rawSize / 1024 / 1024).toFixed(2)} MB
                                </ThemedText>
                            );
                        }
                        return null;
                    })()}
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
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: width * 0.03,
        paddingTop: 60,
        paddingBottom: 100,
    },
    mediaWrapper: {
        flex: 1,
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        borderRadius: 10,
        backgroundColor: 'black',
    },
    media: {
        width: '100%',
        height: '100%',
        borderRadius: 10,
        backgroundColor: 'black',
    },
    infoContainer: {
        position: 'absolute',
        bottom: 20,
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