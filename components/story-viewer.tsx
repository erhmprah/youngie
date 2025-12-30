// components/story-viewer.tsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Modal, StyleSheet, View, Image, TouchableOpacity, Dimensions, Animated, Easing, Alert } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { spacing, borderRadius, typography } from '@/constants/design-tokens';
import { IconSymbol } from './ui/icon-symbol';
import { getImageUrl, storyAPI } from '@/utils/api';
import { getRelativeTime } from '@/utils/helpers';
import { useAuth } from '@/contexts/AuthContext';

interface User {
    _id: string;
    username: string;
    profilePhoto?: string;
}

interface Story {
    _id: string;
    author: User;
    content?: string;
    image?: string;
    video?: string;
    expiresAt: string;
    viewers: Array<{ user: User; viewedAt: string }>;
    createdAt: string;
}

interface StoryGroup {
    user: User;
    stories: Story[];
    allViewed: boolean;
}

interface StoryViewerProps {
    visible: boolean;
    onClose: () => void;
    storyGroups: StoryGroup[];
    initialGroupIndex: number;
    onStoryDeleted?: () => void;
}

const { width, height } = Dimensions.get('window');

export function StoryViewer({ visible, onClose, storyGroups, initialGroupIndex, onStoryDeleted }: StoryViewerProps) {
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const [currentGroupIndex, setCurrentGroupIndex] = useState(initialGroupIndex);
    const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
    const progressAnim = useRef(new Animated.Value(0)).current;

    const group = storyGroups[currentGroupIndex];
    const story = group?.stories[currentStoryIndex];

    const primaryColor = useThemeColor('primary');
    const white = useThemeColor('white');
    const lightTextColor = useThemeColor('lightText');

    const isOwnStory = story && user && story.author._id === user._id;

    const startProgressAnimation = useCallback(() => {
        progressAnim.setValue(0);
        Animated.timing(progressAnim, {
            toValue: 1,
            duration: 5000, // 5 seconds per story
            easing: Easing.linear,
            useNativeDriver: false,
        }).start(({ finished }) => {
            if (finished) {
                handleNextStory();
            }
        });
    }, [progressAnim, currentGroupIndex, currentStoryIndex]);

    useEffect(() => {
        if (visible && story) {
            startProgressAnimation();
        }
    }, [visible, story, startProgressAnimation]);

    const handleNextStory = () => {
        if (group && currentStoryIndex < group.stories.length - 1) {
            setCurrentStoryIndex(prev => prev + 1);
        } else if (currentGroupIndex < storyGroups.length - 1) {
            setCurrentGroupIndex(prev => prev + 1);
            setCurrentStoryIndex(0);
        } else {
            onClose();
        }
    };

    const handlePrevStory = () => {
        if (currentStoryIndex > 0) {
            setCurrentStoryIndex(prev => prev - 1);
        } else if (currentGroupIndex > 0) {
            const prevGroup = storyGroups[currentGroupIndex - 1];
            if (prevGroup && prevGroup.stories.length > 0) {
                setCurrentGroupIndex(prev => prev - 1);
                setCurrentStoryIndex(prevGroup.stories.length - 1);
            }
        } else {
            onClose();
        }
    };

    const handleDeleteStory = () => {
        if (!story) return;

        Alert.alert(
            'Delete Story',
            'Are you sure you want to delete this story? This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await storyAPI.deleteStory(story._id);
                            Alert.alert('Success', 'Story deleted successfully');
                            onStoryDeleted?.(); // Refresh stories in parent component
                            onClose(); // Close the viewer after deletion
                        } catch (error) {
                            console.error('Failed to delete story:', error);
                            Alert.alert('Error', 'Failed to delete story. Please try again.');
                        }
                    }
                }
            ]
        );
    };

    if (!group || !story) return null;

    return (
        <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
            <ThemedView style={styles.container}>
                {/* Story Media */}
                {story.image && <Image source={{ uri: getImageUrl(story.image) }} style={styles.media} />}
                {story.video && getImageUrl(story.video) && (
                    <Video
                        source={{ uri: getImageUrl(story.video)! }}
                        style={styles.media}
                        shouldPlay
                        isLooping
                        resizeMode={ResizeMode.COVER}
                    />
                )}
                {story.content && (
                    <View style={styles.contentOverlay}>
                        <ThemedText style={styles.storyContentText}>{story.content}</ThemedText>
                    </View>
                )}

                {/* Progress Indicators */}
                <View style={[styles.progressContainer, { top: insets.top + spacing.sm }]}>
                    {group.stories.map((_, index) => (
                        <View key={index} style={styles.progressBarBackground}>
                            {index === currentStoryIndex && (
                                <Animated.View style={[styles.progressBarFill, { width: progressAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: ['0%', '100%'],
                                }) }]} />
                            )}
                            {index < currentStoryIndex && <View style={[styles.progressBarFill, { width: '100%' }]} />}
                        </View>
                    ))}
                </View>

                {/* User Info */}
                <View style={[styles.userInfoContainer, { top: insets.top + spacing.xl }]}>
                    <Image source={{ uri: getImageUrl(group.user.profilePhoto) }} style={styles.avatar} />
                    <ThemedText style={styles.username}>{group.user.username}</ThemedText>
                    <ThemedText style={styles.time}>{getRelativeTime(story.createdAt)}</ThemedText>
                    {isOwnStory && (
                        <TouchableOpacity onPress={handleDeleteStory} style={styles.deleteButton}>
                            <IconSymbol name="trash" size={20} color={white} />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <IconSymbol name="x" size={24} color={white} />
                    </TouchableOpacity>
                </View>

                {/* Navigation Gestures */}
                <View style={styles.navigationOverlay}>
                    <TouchableOpacity style={styles.navButton} onPress={handlePrevStory} />
                    <TouchableOpacity style={styles.navButton} onPress={handleNextStory} />
                </View>
            </ThemedView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
    },
    media: {
        width: width,
        height: height,
        position: 'absolute',
    },
    contentOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    storyContentText: {
        color: 'white',
        fontSize: typography.sizes.title,
        textAlign: 'center',
        fontFamily: typography.families.bold,
    },
    progressContainer: {
        flexDirection: 'row',
        position: 'absolute',
        width: width - (spacing.sm * 2),
        marginHorizontal: spacing.sm,
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 1,
    },
    progressBarBackground: {
        height: 3,
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.5)',
        marginHorizontal: 2,
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: 'white',
    },
    userInfoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        position: 'absolute',
        width: '100%',
        paddingHorizontal: spacing.md,
        zIndex: 1,
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 2,
        borderColor: 'white',
        marginRight: spacing.sm,
    },
    username: {
        color: 'white',
        fontFamily: typography.families.bold,
        fontSize: typography.sizes.body2,
    },
    time: {
        color: 'white',
        fontSize: typography.sizes.caption,
        marginLeft: spacing.sm,
        opacity: 0.8,
    },
    deleteButton: {
        position: 'absolute',
        right: spacing.md + 40, // Position to the left of close button
        padding: spacing.xs,
    },
    closeButton: {
        position: 'absolute',
        right: spacing.md,
        padding: spacing.xs,
    },
    navigationOverlay: {
        flexDirection: 'row',
        ...StyleSheet.absoluteFillObject,
    },
    navButton: {
        flex: 1,
    },
});
