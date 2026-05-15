// components/story-viewer.tsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Modal, StyleSheet, View, Image, TouchableOpacity, Dimensions, Animated, Easing, Alert, TouchableWithoutFeedback } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { PollView, PollOption } from './poll-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { spacing, borderRadius, typography } from '@/constants/design-tokens';
import { IconSymbol } from './ui/icon-symbol';
import { getImageUrl, storyAPI } from '@/utils/api';
import { getRelativeTime } from '@/utils/helpers';
import { useAuth } from '@/contexts/AuthContext';
import { ReactionPicker, ReactionType } from './reaction-picker';
import { StoryViewersModal } from './story-viewers-modal';
import { useRouter } from 'expo-router';

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
    pollOptions?: { text: string; votes: string[] }[];
    reactions?: Array<{ user: User; type: string }>;
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
    onStoryViewed?: (storyId: string) => void;
}

const { width, height } = Dimensions.get('window');

export function StoryViewer({ visible, onClose, storyGroups, initialGroupIndex, onStoryDeleted, onStoryViewed }: StoryViewerProps) {
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const router = useRouter();
    const [currentGroupIndex, setCurrentGroupIndex] = useState(initialGroupIndex);
    const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
    const [showReactions, setShowReactions] = useState(false);
    const [showViewersModal, setShowViewersModal] = useState(false);
    const [currentPollOptions, setCurrentPollOptions] = useState<PollOption[]>([]);
    const progressAnim = useRef(new Animated.Value(0)).current;
    const currentValueRef = useRef(0);

    const group = storyGroups[currentGroupIndex];
    const story = group?.stories[currentStoryIndex];
    const storyGroupsLengthRef = useRef(storyGroups.length);

    // Reset to initial index when storyGroups changes (e.g., after deletion)
    useEffect(() => {
        // Only reset when the number of story groups changes (not on every open)
        if (storyGroups.length !== storyGroupsLengthRef.current) {
            storyGroupsLengthRef.current = storyGroups.length;
            
            if (storyGroups.length === 0) {
                // No stories left - close the viewer
                onClose();
            } else if (currentGroupIndex >= storyGroups.length) {
                // Current group index is now invalid - reset
                setCurrentGroupIndex(0);
                setCurrentStoryIndex(0);
            }
        }
    }, [storyGroups.length, onClose, currentGroupIndex]);

    // Reset to initial index when opened with a new initialGroupIndex
    useEffect(() => {
        setCurrentGroupIndex(initialGroupIndex);
        setCurrentStoryIndex(0);
    }, [initialGroupIndex]);

    useEffect(() => {
        setCurrentPollOptions(story?.pollOptions || []);
    }, [story?.pollOptions]);

    useEffect(() => {
        const listener = progressAnim.addListener(({ value }) => {
            currentValueRef.current = value;
        });
        return () => {
            progressAnim.removeListener(listener);
        };
    }, [progressAnim]);

    const primaryColor = useThemeColor('primary');
    const white = useThemeColor('white');
    const lightTextColor = useThemeColor('lightText');

    const isOwnStory = story && user && story.author._id === user._id;

    const handlePressIn = () => {
        progressAnim.stopAnimation();
    };

    const handlePressOut = () => {
        startProgressAnimation(currentValueRef.current);
    };

    const startProgressAnimation = useCallback((fromValue?: number) => {
        if (showReactions || showViewersModal) return; // Pause when reacting or viewing viewers
        const startValue = fromValue !== undefined ? fromValue : 0;
        progressAnim.setValue(startValue);
        Animated.timing(progressAnim, {
            toValue: 1,
            duration: (1 - startValue) * 5000, // remaining time
            easing: Easing.linear,
            useNativeDriver: false,
        }).start(({ finished }) => {
            if (finished) {
                handleNextStory();
            }
        });
    }, [progressAnim, currentGroupIndex, currentStoryIndex, showReactions, showViewersModal]);

    useEffect(() => {
        if (visible && story) {
            // Mark as viewed if not already viewed AND not the author
            const isAuthor = story.author?._id === user?._id || story.author?._id === user?.id;
            if (user && !isAuthor && !story.viewers?.some(v => v.user._id === user._id)) {
                 storyAPI.viewStory(story._id).then(() => {
                     onStoryViewed?.(story._id);
                 }).catch(() => {});
            }
            if (showReactions || showViewersModal) {
                progressAnim.stopAnimation();
            } else {
                startProgressAnimation();
            }
        }
    }, [visible, story, startProgressAnimation, showReactions, showViewersModal, user, progressAnim, onStoryViewed]);

    // Reset viewers modal when story changes or viewer is closed
    useEffect(() => {
        setShowViewersModal(false);
    }, [currentStoryIndex, currentGroupIndex, visible]);

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

    const handleMuteUser = () => {
        if (!group) return;
        
        Alert.alert(
            `Mute ${group.user.username}?`,
            "You won't see their stories in your feed anymore.",
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Mute',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await storyAPI.muteUser(group.user._id);
                            Alert.alert('Success', `Muted ${group.user.username}'s stories`);
                            onClose();
                            onStoryDeleted?.(); // Refresh feed
                        } catch (error) {
                            console.error('Failed to mute user:', error);
                            Alert.alert('Error', 'Failed to mute user.');
                        }
                    }
                }
            ]
        );
    };

    const handleReaction = async (type: ReactionType) => {
        setShowReactions(false);
        try {
            // Check if user already has this reaction
            const hasSameReaction = story.reactions?.some(r => r.user._id === currentUserId && r.type === type);
            
            if (hasSameReaction) {
                // Remove reaction if user is clicking the same reaction type again
                // Note: You may need to implement a remove reaction API endpoint for stories
                console.log('User already has this reaction');
            } else {
                // Add new reaction (and remove any existing reaction)
                await storyAPI.reactStory(story._id, { reactionType: type });
                // Optionally show a floating animation here
            }
        } catch (error) {
            console.error('Failed to react to story:', error);
        }
    };

    if (!group || !story) return null;

    const storyContent = (
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
                <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center' }}
                    onPress={() => {
                        if (group.user._id !== user?._id) {
                            onClose();
                            router.push(`/user/${group.user._id}`);
                        }
                    }}
                >
                    <Image source={{ uri: getImageUrl(group.user.profilePhoto) }} style={styles.avatar} />
                    <ThemedText style={styles.username}>{group.user.username}</ThemedText>
                </TouchableOpacity>
                <ThemedText style={styles.time}>{getRelativeTime(story.createdAt)}</ThemedText>
                {!isOwnStory && (
                    <TouchableOpacity onPress={handleMuteUser} style={styles.moreButton}>
                        <IconSymbol name="ellipsis" size={24} color={white} />
                    </TouchableOpacity>
                )}
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

            {/* Poll */}
            {currentPollOptions && currentPollOptions.length > 0 && (
                <View style={styles.pollContainer}>
                    <PollView
                        postId={story._id}
                        options={currentPollOptions}
                        voteAPI={storyAPI.votePoll}
                        onVote={setCurrentPollOptions}
                    />
                </View>
            )}

            {isOwnStory && (
                <TouchableOpacity
                    style={[styles.viewersButton, { paddingBottom: insets.bottom + spacing.md }]}
                    onPress={() => setShowViewersModal(true)}
                >
                    <IconSymbol name="eye.fill" size={24} color={white} />
                    <ThemedText style={styles.viewersCount}>
                        {story.viewers?.length || 0}
                    </ThemedText>
                </TouchableOpacity>
            )}
        </ThemedView>
    );

    return (
        <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
            {showViewersModal || showReactions ? storyContent : (
                <TouchableWithoutFeedback onPressIn={handlePressIn} onPressOut={handlePressOut}>
                    {storyContent}
                </TouchableWithoutFeedback>
            )}

            {/* Reaction Controls */}
            {!isOwnStory && (
                <View style={[styles.footerControls, { paddingBottom: insets.bottom + spacing.md }]}>
                    {showReactions ? (
                        <ReactionPicker
                            onSelect={handleReaction}
                            onClose={() => setShowReactions(false)}
                        />
                    ) : (
                        <TouchableOpacity
                            style={styles.reactButton}
                            onPress={() => setShowReactions(true)}
                        >
                            <IconSymbol name="heart" size={28} color={white} />
                        </TouchableOpacity>
                    )}
                </View>
            )}

            <StoryViewersModal
                visible={showViewersModal}
                onClose={() => setShowViewersModal(false)}
                viewers={story.viewers || []}
                reactions={story.reactions || []}
                currentUserId={user?._id || ''}
                onUserSelect={(userId) => {
                    if (userId !== user?._id) {
                        setShowViewersModal(false);
                        onClose();
                        router.push(`/user/${userId}`);
                    }
                }}
            />
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
    moreButton: {
        position: 'absolute',
        right: spacing.md + 40,
        padding: spacing.xs,
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
    pollContainer: {
        position: 'absolute',
        bottom: 100,
        left: spacing.md,
        right: spacing.md,
        backgroundColor: 'rgba(0,0,0,0.7)',
        borderRadius: borderRadius.md,
        padding: spacing.md,
    },
    footerControls: {
        position: 'absolute',
        bottom: 0,
        right: spacing.md,
        zIndex: 10,
        alignItems: 'flex-end',
    },
    reactButton: {
        padding: spacing.sm,
        opacity: 0.9,
    },
    viewersButton: {
        position: 'absolute',
        bottom: 0,
        left: spacing.md,
        zIndex: 10,
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.sm,
    },
    viewersCount: {
        color: 'white',
        marginLeft: spacing.xs,
        fontSize: typography.sizes.body1,
        fontFamily: typography.families.bold,
    },
});
