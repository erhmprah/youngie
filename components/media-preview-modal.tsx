import { useThemeColor } from '@/hooks/use-theme-color';
import { getImageUrl } from '@/utils/api';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library/legacy';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Dimensions, FlatList, Image, Modal, StyleSheet, TouchableOpacity, View, ViewToken } from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import Reanimated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { borderRadius, spacing, typography } from '@/constants/design-tokens';
import { ThemedText } from './themed-text';
import { IconSymbol } from './ui/icon-symbol';

const { width, height } = Dimensions.get('window')

interface MediaPreviewModalProps {
    visible: boolean;
    onClose: () => void;
    attachment?: any;
    attachments?: any[];
    initialIndex?: number;
    onIndexChange?: (index: number) => void;
}

const viewabilityConfig = { itemVisiblePercentThreshold: 60 };

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

const inferType = (value: any, fallback: string): string => {
    if (!value) return fallback;
    if (typeof value === 'string' && value.startsWith('video')) return 'video';
    if (typeof value === 'string' && value.startsWith('image')) return 'image';
    if (typeof value === 'string' && /\.(mp4|mov|avi|mkv|webm)(\?|$)/i.test(value)) return 'video';
    if (typeof value === 'string' && /\.(jpe?g|png|gif|webp|bmp|heic)(\?|$)/i.test(value)) return 'image';
    return fallback;
};

const normalizeUri = (rawUri?: string): string => {
    if (!rawUri) return '';
    const normalized = String(rawUri).trim().replace(/\\/g, '/');
    const hasUriScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(normalized);
    const normalizedPath = (normalized.startsWith('/') || hasUriScheme) ? normalized : `/${normalized}`;
    const finalUri = /^(http|https):/.test(normalized)
        ? normalized
        : normalized.startsWith('//')
            ? `http:${normalized}`
            : getImageUrl(normalizedPath) || normalized;
    return finalUri ? encodeURI(finalUri) : '';
};

interface ResolvedMedia {
    uri: string;
    isVideo: boolean;
    fileName?: string;
    fileSize?: number;
}

const resolveMedia = (value: any): ResolvedMedia => {
    const parsed = parseAttachment(value) ?? {};
    const rawUri = extractUri(parsed);
    const uri = normalizeUri(rawUri) || (typeof value === 'string' ? value : '');
    const type = parsed.type ?? parsed.mimeType ?? parsed.contentType ?? inferType(uri, 'image');
    const isVideo = type === 'video' || (typeof type === 'string' && type.startsWith('video'));
    return {
        uri,
        isVideo,
        fileName: parsed.fileName,
        fileSize: parsed.fileSize ?? parsed.size,
    };
};

export function MediaPreviewModal({ visible, onClose, attachment, attachments, initialIndex = 0, onIndexChange }: MediaPreviewModalProps) {
    const white = useThemeColor('white');
    const insets = useSafeAreaInsets();

    const mediaList: ResolvedMedia[] = (attachments && attachments.length > 0 ? attachments : (attachment ? [attachment] : []))
        .map(resolveMedia);

    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [errorUris, setErrorUris] = useState<Record<string, boolean>>({});
    const [videoControlsVisible, setVideoControlsVisible] = useState(false);
    const listRef = useRef<FlatList<ResolvedMedia>>(null);
    const indexRef = useRef(initialIndex);

    const translateY = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            // Opening the modal intentionally resets its local navigation state.
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setCurrentIndex(initialIndex);
            setErrorUris({});
            setVideoControlsVisible(false);
            indexRef.current = initialIndex;
            translateY.value = 0;
        }
    }, [visible, initialIndex, translateY]);

    const total = mediaList.length;
    const safeIndex = total > 0 ? Math.min(Math.max(currentIndex, 0), total - 1) : 0;
    const activeMedia = mediaList[safeIndex];
    const activeUri = activeMedia?.uri || '';
    const activeIsVideo = !!activeMedia?.isVideo;

    const player = useVideoPlayer({ uri: activeUri }, (p) => {
        p.loop = false;
    });

    useEffect(() => {
        if (activeIsVideo) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setVideoControlsVisible(false);
            player.play();
        } else {
            player.pause();
        }
    }, [activeIsVideo, activeUri, player]);

    const goToIndex = useCallback((nextIndex: number) => {
        indexRef.current = nextIndex;
        setCurrentIndex(nextIndex);
        onIndexChange?.(nextIndex);
        listRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    }, [onIndexChange]);

    const handleViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
        if (viewableItems.length === 0) return;
        const nextIndex = viewableItems[0].index ?? null;
        if (nextIndex === null || nextIndex === indexRef.current) return;
        indexRef.current = nextIndex;
        setCurrentIndex(nextIndex);
        onIndexChange?.(nextIndex);
    }, [onIndexChange]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    const onGestureEvent = (event: any) => {
        if (event.nativeEvent.y < 0) {
            // eslint-disable-next-line react-hooks/immutability
            translateY.value = event.nativeEvent.y;
        } else {
            translateY.value = event.nativeEvent.y * 0.4;
        }
    };

    const onHandlerStateChange = (event: any) => {
        if (event.nativeEvent.state === State.END) {
            const { y, velocityY } = event.nativeEvent;
            const SWIPE_THRESHOLD = height * 0.2;
            const VELOCITY_THRESHOLD = 800;

            if (y >= SWIPE_THRESHOLD || velocityY >= VELOCITY_THRESHOLD) {
                // eslint-disable-next-line react-hooks/immutability
                translateY.value = withTiming(height, { duration: 200 }, () => {
                    runOnJS(onClose)();
                    translateY.value = 0;
                });
            } else {
                translateY.value = withTiming(0, { duration: 200 });
            }
        }
    };

    const handleSave = async () => {
        if (!activeMedia?.uri) {
            Alert.alert('Error', 'No media to save');
            return;
        }
        try {
            // Request permissions
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission needed', 'Please grant permission to save media to your gallery');
                return;
            }

            const isLocalFile = activeMedia.uri.startsWith('file://');
            const extension = activeMedia.isVideo ? 'mp4' : (activeMedia.fileName?.split('.').pop() || 'jpg');

            // For local files, save directly
            if (isLocalFile) {
                await MediaLibrary.saveToLibraryAsync(activeMedia.uri);
                Alert.alert('Success', 'Media saved to gallery');
                return;
            }

            // For remote files, download first
            const fileUri = `${(FileSystem as any).documentDirectory}${activeMedia.fileName || `media_${Date.now()}.${extension}`}`;
            const downloadResult = await FileSystem.downloadAsync(activeMedia.uri, fileUri);

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

    const markError = (uri: string) => {
        setErrorUris((prev) => (prev[uri] ? prev : { ...prev, [uri]: true }));
    };

    const renderItem = useCallback(({ item, index }: { item: ResolvedMedia; index: number }) => {
        const isActive = index === safeIndex;
        const hasError = !!item.uri && !!errorUris[item.uri];

        return (
            <View style={styles.page}>
                {!item.uri ? (
                    <View style={styles.errorContainer}>
                        <IconSymbol name="exclamationmark.triangle" size={48} color={white} />
                        <ThemedText style={{ color: white, marginTop: 8 }}>No media available</ThemedText>
                    </View>
                ) : hasError ? (
                    <View style={styles.errorContainer}>
                        <IconSymbol name="exclamationmark.triangle" size={48} color={white} />
                        <ThemedText style={{ color: white, marginTop: 8 }}>Failed to load media</ThemedText>
                    </View>
                ) : item.isVideo ? (
                    isActive ? (
                        <View style={styles.page}>
                            <VideoView
                                player={player}
                                style={styles.media}
                                nativeControls={videoControlsVisible}
                                contentFit="contain"
                            />
                            {!videoControlsVisible && (
                                <TouchableOpacity
                                    style={styles.videoTapLayer}
                                    activeOpacity={1}
                                    accessibilityLabel="Show video controls"
                                    onPress={() => setVideoControlsVisible(true)}
                                />
                            )}
                        </View>
                    ) : (
                        <View style={[styles.media, { backgroundColor: 'black' }]} />
                    )
                ) : (
                    <Image
                        source={{ uri: item.uri }}
                        style={styles.media}
                        resizeMode="contain"
                        onError={() => markError(item.uri)}
                    />
                )}
            </View>
        );
    }, [errorUris, player, safeIndex, videoControlsVisible, white]);

    const getItemLayout = useCallback((_data: any, index: number) => ({
        length: width,
        offset: width * index,
        index,
    }), []);

    return (
        <Modal visible={visible} transparent={false} presentationStyle="fullScreen" animationType="fade" onRequestClose={onClose}>
            <PanGestureHandler
                onGestureEvent={onGestureEvent}
                onHandlerStateChange={onHandlerStateChange}
                activeOffsetY={[-20, 20]}
                failOffsetX={[-30, 30]}
            >
                <Reanimated.View style={[styles.container, animatedStyle]}>
                    <TouchableOpacity style={[styles.closeButton, { top: insets.top + 10 }]} onPress={onClose}>
                        <IconSymbol name="xmark" size={30} color={white} />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.saveButton, { top: insets.top + 10 }]} onPress={handleSave}>
                        <IconSymbol name="square.and.arrow.down" size={30} color={white} />
                    </TouchableOpacity>

                    {total > 1 && (
                        <View style={[styles.counterBadge, { top: insets.top + 14 }]}>
                            <ThemedText style={styles.counterText}>
                                {safeIndex + 1}/{total}
                            </ThemedText>
                        </View>
                    )}

                    <View style={styles.mediaContainer}>
                        {total > 0 ? (
                            <FlatList
                                ref={listRef}
                                data={mediaList}
                                renderItem={renderItem}
                                keyExtractor={(item, index) => `media-preview-${index}-${item.uri}`}
                                horizontal
                                pagingEnabled
                                showsHorizontalScrollIndicator={false}
                                initialScrollIndex={Math.min(Math.max(initialIndex, 0), total - 1)}
                                getItemLayout={getItemLayout}
                                onViewableItemsChanged={handleViewableItemsChanged}
                                viewabilityConfig={viewabilityConfig}
                                style={styles.carousel}
                            />
                        ) : (
                            <View style={styles.errorContainer}>
                                <IconSymbol name="exclamationmark.triangle" size={48} color={white} />
                                <ThemedText style={{ color: white, marginTop: 8 }}>No media available</ThemedText>
                            </View>
                        )}
                    </View>

                    {total > 1 && (
                        <View style={styles.pagination}>
                            {mediaList.map((item, index) => (
                                <TouchableOpacity
                                    key={`dot-${index}`}
                                    activeOpacity={0.8}
                                    onPress={() => goToIndex(index)}
                                    hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                                >
                                    <View style={[styles.dot, { backgroundColor: index === safeIndex ? 'white' : 'rgba(255,255,255,0.35)' }]} />
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {total > 1 && (
                        <View style={styles.swipeHint}>
                            <IconSymbol name="chevron.left" size={16} color="rgba(255,255,255,0.7)" />
                            <ThemedText style={styles.swipeHintText}>Swipe to view more</ThemedText>
                            <IconSymbol name="chevron.right" size={16} color="rgba(255,255,255,0.7)" />
                        </View>
                    )}

                    <View style={styles.infoContainer}>
                        <ThemedText style={styles.fileName}>
                            {activeMedia?.fileName || 'Media file'}
                        </ThemedText>
                        {(() => {
                            const rawSize = activeMedia?.fileSize;
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
                </Reanimated.View>
            </PanGestureHandler>
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
        paddingTop: 60,
        paddingBottom: 130,
    },
    carousel: {
        flex: 1,
        width: '100%',
    },
    page: {
        width: width,
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    media: {
        width: '100%',
        height: '100%',
        backgroundColor: 'black',
    },
    videoTapLayer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'transparent',
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
    fileSize: {
        color: 'white',
        fontSize: 14,
        opacity: 0.8,
    },
    counterBadge: {
        position: 'absolute',
        left: 20,
        zIndex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: borderRadius.round,
    },
    counterText: {
        color: 'white',
        fontSize: typography.sizes.caption,
        fontFamily: typography.families.medium,
    },
    pagination: {
        position: 'absolute',
        bottom: 118,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    dot: {
        width: 7,
        height: 7,
        borderRadius: 4,
    },
    swipeHint: {
        position: 'absolute',
        bottom: 92,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 6,
    },
    swipeHintText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 13,
    },
});