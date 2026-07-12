// components/create-post-modal.tsx

import React, { useState, useEffect, useRef } from 'react';
import { Modal, StyleSheet, View, TextInput, TouchableOpacity, ActivityIndicator, Alert, Image, FlatList, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { ThemedView } from './themed-view';
import { ThemedText } from './themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { spacing, borderRadius, typography } from '@/constants/design-tokens';
import { postAPI, userAPI, getImageUrl } from '@/utils/api';
import { cacheService } from '@/utils/cache';
import { useDebounce } from '@/hooks/use-debounce';
import { useAuth } from '@/contexts/AuthContext';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { MediaPickerButton, MediaPickerResult } from '@/components/media-picker-button';
import * as Haptics from 'expo-haptics';
import { CustomAlert } from '@/utils/alert';

interface CreatePostModalProps {
    visible: boolean;
    onClose: () => void;
    onPost: () => void;
    initialAnonymous?: boolean;
}

const MAX_IMAGES = 10;
const categories = [
  { id: '1', title: 'Music', icon: 'headphones', color: '#8E44AD' }, // Using static colors since useThemeColor not available here
  { id: '2', title: 'Gaming', icon: 'gamepad', color: '#E74C3C' },
  { id: '3', title: 'Sports', icon: 'globe', color: '#F39C12' },
  { id: '4', title: 'Art', icon: 'image', color: '#E74C3C' },
  { id: '5', title: 'Tech', icon: 'code', color: '#3498DB' },
];

export function CreatePostModal({ visible, onClose, onPost, initialAnonymous = false }: CreatePostModalProps) {
    const { user } = useAuth();
    const [content, setContent] = useState('');
    const [media, setMedia] = useState<Array<{ uri: string; type: 'image' | 'video' }>>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isPublic, setIsPublic] = useState(true);
    const [isAnonymous, setIsAnonymous] = useState(initialAnonymous);
    const [commentsDisabled, setCommentsDisabled] = useState(false);
    const [taggedUsers, setTaggedUsers] = useState<string[]>([]);
    const [showTagModal, setShowTagModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [friends, setFriends] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isLoadingFriends, setIsLoadingFriends] = useState(false);
    const [showPoll, setShowPoll] = useState(false);
    const [pollOptions, setPollOptions] = useState(['', '']);
    const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
    const videoPlayer = useRef<Video>(null);

    const debouncedSearchQuery = useDebounce(searchQuery, 500);

    const fetchFriends = async () => {
        if (!user?._id) return;

        setIsLoadingFriends(true);
        try {
            const response = await userAPI.getProfile(user._id);
            setFriends(response.data.friends || []);
        } catch (error) {
            console.error('Error fetching friends:', error);
            setFriends([]);
        } finally {
            setIsLoadingFriends(false);
        }
    };

    useEffect(() => {
        if (visible) {
            setIsAnonymous(initialAnonymous);
        }
    }, [visible, initialAnonymous]);

    useEffect(() => {
        if (showTagModal) {
            setTaggedUsers([]);
            setSearchQuery('');
            setSearchResults([]);
            fetchFriends();
        }
    }, [showTagModal, user?._id]);

    const performSearch = async (query: string) => {
        if (!query.trim()) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            const response = await userAPI.searchUsers(query);
            setSearchResults(response.data);
        } catch (error) {
            console.error('Search failed:', error);
        } finally {
            setIsSearching(false);
        }
    };

    useEffect(() => {
        performSearch(debouncedSearchQuery);
    }, [debouncedSearchQuery]);

    const backgroundColor = useThemeColor('background');
    const textColor = useThemeColor('text');
    const primaryColor = useThemeColor('primary');
    const white = useThemeColor('white');
    const lightTextColor = useThemeColor('lightText');
    const surfaceColor = useThemeColor('surface');
    const borderColor = useThemeColor('border');

    const handlePickImage = async () => {
        const currentImageCount = media.filter(m => m.type === 'image').length;
        if (currentImageCount >= MAX_IMAGES) {
            CustomAlert.warning('Limit Reached', `You can only upload a maximum of ${MAX_IMAGES} images.`);
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: false,
            quality: 1,
            allowsMultipleSelection: true,
            selectionLimit: MAX_IMAGES - currentImageCount,
        });

        if (!result.canceled) {
            const newMedia = result.assets.map(asset => ({ uri: asset.uri, type: 'image' as const }));
            setMedia(prev => {
                // This filter also conveniently removes any video that might have been selected.
                const currentImages = prev.filter(m => m.type === 'image');
                const combined = [...currentImages, ...newMedia];

                if (combined.length > MAX_IMAGES) {
                    CustomAlert.warning('Limit Exceeded', `You can only select up to ${MAX_IMAGES} images. ${combined.length - MAX_IMAGES} images were not added.`);
                    return combined.slice(0, MAX_IMAGES);
                }
                return combined;
            });
        }
    };

    const handlePickVideo = async () => {
        if (media.length > 0) {
            CustomAlert.confirm(
                'Clear Selection',
                'Adding a video will remove any selected images. Continue?',
                async () => {
                    const result = await ImagePicker.launchImageLibraryAsync({
                        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
                        allowsEditing: true,
                        quality: 1,
                    });
                    if (!result.canceled) {
                        setMedia([{ uri: result.assets[0].uri, type: 'video' as const }]);
                    }
                }
            );
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
            allowsEditing: true,
            quality: 1,
        });

        if (!result.canceled) {
            setMedia([{ uri: result.assets[0].uri, type: 'video' as const }]);
        }
    };

    // Handle unified media picker selection
    const handleMediaSelected = (result: MediaPickerResult) => {
        if (result.type === 'photo') {
            // For photos, use the existing pickImage flow
            handlePickImage();
        } else if (result.type === 'video') {
            // For videos, use the existing pickVideo flow
            handlePickVideo();
        }
        // Audio is not supported for posts, only for chat
    };

     const handlePost = async () => {
         if (!content && media.length === 0) {
             CustomAlert.error('Error', 'Please add some content, an image, or a video to your post.');
             return;
         }

         let finalPollOptions = undefined;
         if (showPoll) {
             const validOptions = pollOptions.filter(o => o.trim().length > 0);
             if (validOptions.length < 2) {
                 CustomAlert.error('Error', 'Poll must have at least 2 options.');
                 return;
             }
             finalPollOptions = validOptions.map(opt => ({ text: opt }));
        }

        setIsLoading(true);
        try {
            const imageUrls: string[] = [];
            let videoUrl: string | undefined = undefined;

            for (const medium of media) {
                if (medium.type === 'image') {
                    const base64 = await FileSystem.readAsStringAsync(medium.uri, { encoding: 'base64' });
                    const filename = `post-image-${Date.now()}-${Math.random()}.jpg`;
                    const uploadResponse = await postAPI.uploadPostImageBase64({
                        imageData: `data:image/jpeg;base64,${base64}`,
                        filename
                    });
                    imageUrls.push(uploadResponse.imageUrl);
                } else if (medium.type === 'video') {
                    const base64 = await FileSystem.readAsStringAsync(medium.uri, { encoding: 'base64' });
                    const filename = `post-video-${Date.now()}.mp4`;
                    const uploadResponse = await postAPI.uploadPostVideoBase64({
                        videoData: `data:video/mp4;base64,${base64}`,
                        filename
                    });
                    videoUrl = uploadResponse.videoUrl;
                }
            }

            // Create post with uploaded media URLs
            await postAPI.createPost({
                content: content.trim() || undefined,
                images: imageUrls.length > 0 ? imageUrls : undefined,
                video: videoUrl,
                isPublic,
                isAnonymous,
                commentsDisabled,
                tags: taggedUsers.length > 0 ? taggedUsers : undefined,
                pollOptions: finalPollOptions,
                category: selectedCategory
            });

            // Invalidate feed cache so the new post appears immediately on refresh
            await cacheService.invalidateByPrefix('cache_posts_');

            onPost();
            onClose();
            setContent('');
            setMedia([]);
            setShowPoll(false);
            setPollOptions(['', '']);
            setSelectedCategory(undefined);
         } catch (error) {
             console.error('Error creating post:', error);
             CustomAlert.error('Error', 'Failed to create post. Please try again.');
         } finally {
             setIsLoading(false);
         }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
            <ThemedView style={[styles.container, { backgroundColor }]} safe>
                <View style={[styles.header, { borderBottomColor: borderColor }]}>
                    <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onClose(); }} style={styles.headerButton}>
                        <ThemedText style={{ color: lightTextColor }}>Cancel</ThemedText>
                    </TouchableOpacity>
                    <ThemedText style={[styles.headerTitle, { color: textColor }]}>New Post</ThemedText>
                    <TouchableOpacity 
                        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); handlePost(); }} 
                        disabled={isLoading || (!content && media.length === 0)}
                        style={[styles.postButton, { backgroundColor: (content || media.length > 0) ? primaryColor : surfaceColor }]}
                    >
                        {isLoading ? (
                            <ActivityIndicator color={white} size="small" />
                        ) : (
                            <ThemedText style={{ color: white, fontWeight: typography.weights.semibold }}>Post</ThemedText>
                        )}
                    </TouchableOpacity>
                </View>

                <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
                    <View style={styles.userInfo}>
                        {isAnonymous ? (
                            <Image source={{ uri: 'https://i.pravatar.cc/150?u=anon' }} style={styles.avatar} />
                        ) : user?.profilePhoto ? (
                            <Image source={{ uri: getImageUrl(user.profilePhoto) }} style={styles.avatar} />
                        ) : (
                            <View style={[styles.avatar, { backgroundColor: surfaceColor }]}><Ionicons name="person" size={20} color={lightTextColor} /></View>
                        )}
                        <View style={styles.userDetails}>
                            <ThemedText style={{ fontWeight: typography.weights.semibold, color: textColor }}>
                                {isAnonymous ? 'Anonymous' : user?.username}
                            </ThemedText>
                            <TouchableOpacity 
                                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setIsPublic(!isPublic); }}
                                style={[styles.audienceSelector, { backgroundColor: surfaceColor }]}
                            >
                                <Ionicons name={isPublic ? "globe" : "people"} size={12} color={lightTextColor} />
                                <ThemedText style={{ color: lightTextColor, fontSize: typography.sizes.caption }}>
                                    {isPublic ? 'Public' : 'Friends'}
                                </ThemedText>
                                <Ionicons name="chevron-down" size={12} color={lightTextColor} />
                            </TouchableOpacity>
                        </View>
                    </View>
                    <TextInput
                        style={[styles.input, { color: textColor }]}
                        placeholder="What's on your mind?"
                        placeholderTextColor={lightTextColor}
                        value={content}
                        onChangeText={setContent}
                        multiline
                        textAlignVertical="top"
                    />
                    
                    {showPoll && (
                        <View style={styles.pollContainer}>
                            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm}}>
                                <ThemedText style={{fontWeight: 'bold'}}>Poll Options</ThemedText>
                                <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowPoll(false); }}>
                                    <Ionicons name="close-circle" size={20} color={lightTextColor} />
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
                                <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setPollOptions([...pollOptions, '']); }} style={{marginTop: spacing.xs}}>
                                    <ThemedText style={{ color: primaryColor }}>+ Add Option</ThemedText>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    {taggedUsers.length > 0 && (
                        <View style={styles.tagsContainer}>
                            <ThemedText style={{ color: lightTextColor, fontSize: typography.sizes.caption }}>Tagged: </ThemedText>
                            <View style={styles.tagsList}>
                                {taggedUsers.slice(0, 2).map((userId) => {
                                    const user = searchResults.find(u => u._id === userId) || friends.find(u => u._id === userId);
                                    return user ? (
                                        <TouchableOpacity
                                            key={userId}
                                            style={[styles.tagChip, { backgroundColor: primaryColor }]}
                                            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTaggedUsers(prev => prev.filter(id => id !== userId)); }}
                                        >
                                            <ThemedText style={{ color: white, fontSize: typography.sizes.caption }}>{user.username}</ThemedText>
                                            <Ionicons name="close" size={12} color={white} />
                                        </TouchableOpacity>
                                    ) : null;
                                })}
                                {taggedUsers.length > 2 && (
                                    <View style={[styles.tagChip, { backgroundColor: surfaceColor, borderWidth: 1, borderColor: '#E0E0E0' }]}>
                                        <ThemedText style={{ color: textColor, fontSize: typography.sizes.caption }}>
                                            +{taggedUsers.length - 2} others
                                        </ThemedText>
                                    </View>
                                )}
                            </View>
                        </View>
                    )}
                    {media.length > 0 && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaPreviewContainer}>
                            {media.map((medium, index) => (
                                <View key={index} style={styles.mediaItem}>
                                    {medium.type === 'image' ? (
                                        <Image source={{ uri: medium.uri }} style={styles.previewImage} />
                                    ) : (
                                        <Video
                                            ref={videoPlayer}
                                            source={{ uri: medium.uri }}
                                            style={styles.previewImage}
                                            useNativeControls
                                            resizeMode={ResizeMode.COVER}
                                            isLooping={false}
                                        />
                                    )}
                                    <TouchableOpacity 
                                        style={styles.removeMediaButton}
                                        onPress={() => {
                                            setMedia(prev => prev.filter((_, i) => i !== index));
                                        }}
                                    >
                                        <Ionicons name="close-circle" size={24} color="white" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </ScrollView>
                    )}
                </ScrollView>

                <View style={styles.optionsRow}>
                    <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setIsAnonymous(!isAnonymous); }} style={[styles.optionPill, { backgroundColor: isAnonymous ? primaryColor + '20' : surfaceColor }]}>
                        <Ionicons name={isAnonymous ? "glasses" : "eye-off"} size={16} color={primaryColor} />
                        <ThemedText style={{ color: primaryColor, fontSize: typography.sizes.caption }}>{isAnonymous ? 'Anonymous' : 'Normal'}</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setCommentsDisabled(!commentsDisabled); }} style={[styles.optionPill, { backgroundColor: commentsDisabled ? primaryColor + '20' : surfaceColor }]}>
                        <Ionicons name={commentsDisabled ? "chatbox-ellipses-outline" : "chatbox-ellipses"} size={16} color={primaryColor} />
                        <ThemedText style={{ color: primaryColor, fontSize: typography.sizes.caption }}>{commentsDisabled ? 'Off' : 'On'}</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowTagModal(true); }} style={styles.optionPill}>
                        <Ionicons name="person-add" size={16} color={primaryColor} />
                        <ThemedText style={{ color: primaryColor, fontSize: typography.sizes.caption }}>Tag</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowPoll(!showPoll); }} style={[styles.optionPill, { backgroundColor: showPoll ? primaryColor + '20' : surfaceColor }]}>
                        <Ionicons name="stats-chart" size={16} color={primaryColor} />
                        <ThemedText style={{ color: primaryColor, fontSize: typography.sizes.caption }}>Poll</ThemedText>
                    </TouchableOpacity>
                </View>

                <View style={styles.mediaActions}>
                    <MediaPickerButton
                        onMediaSelected={handleMediaSelected}
                        icon="camera"
                        size={22}
                        showAudioOption={false}
                    />
                </View>

                {/* Category Selection */}
                <View style={styles.categorySection}>
                    <ThemedText style={{ fontWeight: typography.weights.semibold, marginBottom: spacing.md, color: textColor }}>Category</ThemedText>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryList}>
                        {categories.map((cat) => (
                            <TouchableOpacity
                                key={cat.id}
                                style={[
                                    styles.catPill,
                                    {
                                        backgroundColor: selectedCategory === cat.title ? cat.color + '40' : cat.color + '15',
                                        borderColor: selectedCategory === cat.title ? cat.color + '80' : cat.color + '40'
                                    }
                                ]}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    setSelectedCategory(selectedCategory === cat.title ? undefined : cat.title);
                                }}
                            >
                                <IconSymbol name={cat.icon as any} size={18} color={cat.color} />
                                <ThemedText type="body2" style={[styles.catText, { color: cat.color }]}>{cat.title}</ThemedText>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Tag Modal */}
                <Modal visible={showTagModal} animationType="slide" transparent={true} onRequestClose={() => setShowTagModal(false)}>
                    <View style={styles.modalOverlay}>
                        <ThemedView style={[styles.tagModal, { backgroundColor }]}>
                            <View style={styles.modalHeader}>
                                <ThemedText style={{ fontSize: typography.sizes.title, fontFamily: typography.families.bold }}>Tag Users</ThemedText>
                                <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowTagModal(false); }}>
                                    <Ionicons name="close" size={24} color={textColor} />
                                </TouchableOpacity>
                            </View>
                            <TextInput
                                style={[styles.searchInput, { color: textColor, backgroundColor: surfaceColor, borderColor: '#E0E0E0' }]}
                                placeholder="Search users..."
                                placeholderTextColor={lightTextColor}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                            {isSearching || isLoadingFriends ? (
                                <ActivityIndicator size="small" color={primaryColor} />
                            ) : (
                                <FlatList
                                    data={searchQuery.trim() ? searchResults : friends}
                                    keyExtractor={(item) => item._id}
                                    renderItem={({ item }) => (
                                        <TouchableOpacity
                                            style={[styles.userRow, { borderBottomColor: '#E0E0E0' }]}
                                            onPress={() => {
                                                Haptics.selectionAsync();
                                                if (!taggedUsers.includes(item._id)) {
                                                    setTaggedUsers(prev => [...prev, item._id]);
                                                }
                                            }}
                                        >
                                            <View style={[styles.userAvatar, { backgroundColor: surfaceColor }]}>
                                                {item.profilePhoto ? (
                                                    <Image source={{ uri: getImageUrl(item.profilePhoto) }} style={styles.avatarImage} />
                                                ) : (
                                                    <Ionicons name="person" size={20} color={lightTextColor} />
                                                )}
                                            </View>
                                            <ThemedText style={{ color: textColor }}>{item.username}</ThemedText>
                                            {taggedUsers.includes(item._id) && (
                                                <Ionicons name="checkmark" size={20} color={primaryColor} />
                                            )}
                                        </TouchableOpacity>
                                    )}
                                    style={{ maxHeight: 200 }}
                                    ListEmptyComponent={
                                        searchQuery.trim() ? (
                                            <ThemedText style={{ color: lightTextColor, textAlign: 'center', padding: spacing.md }}>
                                                No users found
                                            </ThemedText>
                                        ) : (
                                            <ThemedText style={{ color: lightTextColor, textAlign: 'center', padding: spacing.md }}>
                                                No friends yet
                                            </ThemedText>
                                        )
                                    }
                                />
                            )}
                            <TouchableOpacity
                                style={[styles.doneButton, { backgroundColor: primaryColor }]}
                                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowTagModal(false); }}
                            >
                                <ThemedText style={{ color: white, fontFamily: typography.families.bold }}>Done</ThemedText>
                            </TouchableOpacity>
                        </ThemedView>
                    </View>
                </Modal>
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
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
    },
    headerButton: {
        padding: spacing.xs,
    },
    headerTitle: {
        fontSize: typography.sizes.title,
        fontWeight: typography.weights.semibold,
    },
    postButton: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.xl,
        minWidth: 64,
        alignItems: 'center',
    },
    content: {
        flex: 1,
        paddingHorizontal: spacing.lg,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        marginRight: spacing.md,
    },
    userDetails: {
        gap: spacing.xs,
    },
    audienceSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.md,
    },
    input: {
        fontSize: typography.sizes.body1,
        minHeight: 120,
        textAlignVertical: 'top',
        lineHeight: 24,
    },
    pollContainer: {
        marginTop: spacing.lg,
        padding: spacing.md,
        backgroundColor: 'rgba(0,0,0,0.03)',
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: '#D1D1D6',
    },
    pollInput: {
        minHeight: 44,
        marginBottom: spacing.sm,
        paddingHorizontal: spacing.md,
    },
    mediaItem: {
        width: 180,
        height: 180,
        marginRight: spacing.sm,
    },
    mediaPreviewContainer: {
        marginTop: spacing.lg,
    },
    previewImage: {
        width: '100%',
        height: '100%',
        borderRadius: borderRadius.lg,
    },
    removeMediaButton: {
        position: 'absolute',
        top: spacing.sm,
        right: spacing.sm,
    },
    previewVideo: {
        width: '100%',
        height: 180,
        borderRadius: borderRadius.lg,
        marginTop: spacing.lg,
    },
    optionsRow: {
        flexDirection: 'row',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        gap: spacing.sm,
    },
    optionPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.round,
        backgroundColor: '#F2F2F7',
    },
    mediaActions: {
        flexDirection: 'row',
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.lg,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    tagModal: {
        width: '90%',
        maxHeight: '80%',
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    searchInput: {
        height: 44,
        borderWidth: 1,
        borderRadius: borderRadius.lg,
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.lg,
    },
    doneButton: {
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xl,
        borderRadius: borderRadius.lg,
        alignSelf: 'flex-end',
        marginTop: spacing.md,
    },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    userAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    avatarImage: {
        width: 36,
        height: 36,
        borderRadius: 18,
    },
    tagsContainer: {
        marginTop: spacing.md,
    },
    tagsList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        marginTop: spacing.sm,
    },
    tagChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.round,
    },
    categorySection: {
        padding: spacing.lg,
    },
    categoryList: {
        paddingHorizontal: spacing.lg,
        gap: spacing.md,
    },
    catPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.round,
        gap: spacing.sm,
        borderWidth: 1,
    },
    catText: {
        fontWeight: typography.weights.medium,
        fontSize: typography.sizes.body2,
    },
});
