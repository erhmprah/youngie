// components/story-viewer.tsx

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Modal, StyleSheet, View, Image, Dimensions, Animated, Easing, Alert, Pressable } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEventListener } from 'expo';
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
import { useInterstitialAdHelper } from '@/hooks/useInterstitialAdHelper';

interface User {
    _id: string;
    id: string;
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
    viewers: { user: User; viewedAt: string }[];
    createdAt: string;
    pollOptions?: { text: string; votes: string[] }[];
    reactions?: { user: User; type: string }[];
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
    // Preferred over initialGroupIndex: the feed tray re-sorts seen users to the
    // back, so an index captured at tap time can point at a different user.
    initialUserId?: string | null;
    onStoryDeleted?: () => void;
    onStoryViewed?: (storyId: string) => void;
}

const { width, height } = Dimensions.get('window');

const STORY_DURATION_MS = 5000;

// Walk `order` from the entry after (or before) `currentUserId` and return the
// first user that still has at least one story. Skipping empty/expired groups
// keeps auto-advance from stalling on a user with nothing left to show.
function findNextSessionUserId(
    order: string[],
    currentUserId: string | null,
    groups: StoryGroup[],
    direction: 1 | -1
): string | null {
    const start = currentUserId ? order.indexOf(currentUserId) : (direction === 1 ? -1 : 0);
    for (let i = start + direction; i >= 0 && i < order.length; i += direction) {
        const g = groups.find(group => group.user?._id === order[i]);
        if (g && g.stories.length > 0) return order[i];
    }
    return null;
}

export function StoryViewer({ visible, onClose, storyGroups, initialGroupIndex, initialUserId, onStoryDeleted, onStoryViewed }: StoryViewerProps) {
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const router = useRouter();
    const [currentGroupIndex, setCurrentGroupIndex] = useState(initialGroupIndex);
    // The feed tray re-sorts itself as stories get watched (a fully seen user
    // moves to the back), so the viewer identifies the current user by id and
    // walks a snapshot of the opening order instead of raw array indices. That
    // keeps the cursor on the right user while the array is rearranged.
    const [currentGroupUserId, setCurrentGroupUserId] = useState<string | null>(
        storyGroups[initialGroupIndex]?.user?._id ?? null
    );
    const [sessionGroupIds, setSessionGroupIds] = useState<string[]>(() =>
        storyGroups.map(g => g.user?._id).filter((id): id is string => !!id)
    );
    const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
    const [showReactions, setShowReactions] = useState(false);
    const [showViewersModal, setShowViewersModal] = useState(false);
    const [currentPollOptions, setCurrentPollOptions] = useState<PollOption[]>([]);
    const [progressAnim] = useState(() => new Animated.Value(0));
    const [storiesViewedSinceAd, setStoriesViewedSinceAd] = useState(0);
    const [adShownForStory, setAdShownForStory] = useState(false);
    const currentValueRef = useRef(0);
    const group = useMemo(
        () => storyGroups.find(g => g.user?._id === currentGroupUserId) ?? storyGroups[currentGroupIndex],
        [storyGroups, currentGroupUserId, currentGroupIndex]
    );
    const story = group?.stories[currentStoryIndex];
    const storyVideoUri = story?.video ? getImageUrl(story.video) : undefined;
    const storyPlayer = useVideoPlayer(storyVideoUri ? { uri: storyVideoUri } : null, (player) => {
        player.muted = false;
        player.volume = 1;
        // Duck whatever else is playing (music, another app) rather than
        // talking over it at full volume.
        player.audioMixingMode = 'duckOthers';
        player.loop = false;
        player.timeUpdateEventInterval = 0.1;
    });
    const storyGroupsLengthRef = useRef(storyGroups.length);
    const storyGroupsRef = useRef(storyGroups);
    const handleNextStoryRef = useRef<(() => void) | null>(null);
    const onStoryViewedRef = useRef(onStoryViewed);
    const { showIfNeeded, isShowing: isAdShowing } = useInterstitialAdHelper();
    // Guards against a single advance being triggered twice (e.g. the progress
    // animation finishing while a video `playToEnd` event is still in flight),
    // which would skip a story or skip a whole user.
    const advanceLockRef = useRef(false);
    // The story a press-and-hold pause started on, so releasing the hold after the
    // story has moved on does not resume the old progress on the new story.
    const pausedStoryIdRef = useRef<string | null>(null);
    // True from the moment an interstitial is requested until it is actually
    // presented, so a slow ad load does not re-trigger on the next story.
    const adIsPendingRef = useRef(false);

    // Keep refs in sync so callbacks always read the latest values without
    // forcing effects to re-run on every parent render.
    useEffect(() => {
        storyGroupsRef.current = storyGroups;
        onStoryViewedRef.current = onStoryViewed;
        handleNextStoryRef.current = handleNextStory;
    });

    // Show a full-screen ad after the user has viewed about N stories.
    // The counter resets each time the viewer closes, so it only fires
    // during a single continuous viewing session.
    const INTERSTITIAL_STORY_INTERVAL = 5;

    // Reset to initial index when storyGroups changes (e.g., after deletion)
    useEffect(() => {
        // Only reset when the number of story groups changes (not on every open)
        if (storyGroups.length !== storyGroupsLengthRef.current) {
            storyGroupsLengthRef.current = storyGroups.length;
            
            if (storyGroups.length === 0) {
                // No stories left - close the viewer
                onClose();
                return;
            }
            // The current user may have been removed (deleted or expired).
            if (!group) {
                const fallbackId = storyGroups[0]?.user?._id ?? null;
                setCurrentGroupUserId(fallbackId);
                setCurrentGroupIndex(0);
                setCurrentStoryIndex(0);
                return;
            }
        }
        // Keep the cursor inside the current group when its story count shrinks
        // (a story expired or was deleted mid-session).
        const maxStoryIndex = (group?.stories.length ?? 0) - 1;
        if (maxStoryIndex >= 0 && currentStoryIndex > maxStoryIndex) {
            setCurrentStoryIndex(maxStoryIndex);
        }
    }, [storyGroups, group, currentStoryIndex, onClose]);

    // Start a fresh session when the viewer opens on a different user: snapshot the
    // current tray order so later re-sorts cannot disturb the running session.
    useEffect(() => {
        if (!visible) return;
        const startId =
            initialUserId ?? storyGroups[initialGroupIndex]?.user?._id ?? null;
        setSessionGroupIds(storyGroups.map(g => g.user?._id).filter((id): id is string => !!id));
        setCurrentGroupUserId(startId);
        setCurrentGroupIndex(
            startId ? Math.max(0, storyGroups.findIndex(g => g.user?._id === startId)) : initialGroupIndex
        );
        setCurrentStoryIndex(0);
    }, [initialUserId, initialGroupIndex, visible]);

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
        pausedStoryIdRef.current = story?._id ?? null;
        progressAnim.stopAnimation();
        storyPlayer.pause();
    };

    const handlePressOut = () => {
        // If the hold also advanced the story (e.g. a tap on the right half),
        // the new story already got a fresh timer from the driver effect —
        // resuming here would replay the previous story's progress on it.
        if (pausedStoryIdRef.current !== (story?._id ?? null)) {
            pausedStoryIdRef.current = null;
            return;
        }
        pausedStoryIdRef.current = null;
        if (showReactions || showViewersModal || isAdShowing) return;
        if (story?.video) {
            storyPlayer.play();
        } else {
            startProgressAnimation(currentValueRef.current);
        }
    };

    function handleNextStory() {
        // One advance per story: a duplicated trigger would silently skip the
        // next user's first story.
        if (advanceLockRef.current) return;
        const currentUserId = currentGroupUserId;
        if (group && currentStoryIndex < group.stories.length - 1) {
            advanceLockRef.current = true;
            setCurrentStoryIndex(prev => prev + 1);
            return;
        }
        // This user's stories are done: hand off to the next user in the
        // session order that still has an unexpired story. Walking the snapshot
        // (not the live array) keeps the sequence stable even as the tray
        // moves seen users to the back.
        const nextUserId = findNextSessionUserId(sessionGroupIds, currentUserId, storyGroupsRef.current, 1);
        if (nextUserId) {
            advanceLockRef.current = true;
            setCurrentGroupUserId(nextUserId);
            setCurrentGroupIndex(storyGroupsRef.current.findIndex(g => g.user?._id === nextUserId));
            setCurrentStoryIndex(0);
        } else {
            onClose();
        }
    }

    const startProgressAnimation = useCallback((fromValue?: number) => {
        if (showReactions || showViewersModal || isAdShowing) return; // Pause when reacting or viewing viewers
        const startValue = fromValue !== undefined ? fromValue : 0;
        progressAnim.setValue(startValue);
        Animated.timing(progressAnim, {
            toValue: 1,
            duration: (1 - startValue) * STORY_DURATION_MS, // remaining time
            easing: Easing.linear,
            useNativeDriver: false,
    }).start(({ finished }) => {
        if (finished) {
            handleNextStoryRef.current?.();
        }
    });
    }, [progressAnim, isAdShowing, showReactions, showViewersModal]);

    useEffect(() => {
        // A new story gets a new timer; drop the previous one so its completion
        // callback can never advance past the story now on screen.
        advanceLockRef.current = false;

        if (!visible || !story) return;
        const currentStory = group?.stories[currentStoryIndex];
        if (currentStory) {
            // Mark as viewed if not already viewed AND not the author
            const isAuthor = currentStory.author?._id === user?._id || currentStory.author?._id === user?.id;
            if (user && !isAuthor && !currentStory.viewers?.some((v: any) => v && v.user && v.user._id === user?._id)) {
                 storyAPI.viewStory(currentStory._id).then(() => {
                     onStoryViewedRef.current?.(currentStory._id);
                 }).catch(() => {});
            }
        }
        if (showReactions || showViewersModal || isAdShowing) {
            progressAnim.stopAnimation();
        } else if (currentStory?.video) {
            // Video story: progress is synced via timeUpdate listener and
            // advancement via playToEnd event
            progressAnim.setValue(0);
        } else {
            startProgressAnimation();
        }
    }, [visible, currentGroupUserId, currentStoryIndex, story?._id, startProgressAnimation, showReactions, showViewersModal, isAdShowing, user]);

    // Stop the timer when the viewer unmounts or is hidden, otherwise a pending
    // animation would advance (and re-render) a closed viewer.
    useEffect(() => {
        if (!visible) {
            progressAnim.stopAnimation();
        }
    }, [visible]);

    // Play / pause the video player and reset progress when the story's video changes
    useEffect(() => {
        if (!storyPlayer) return;
        if (visible && storyVideoUri && !showReactions && !showViewersModal && !isAdShowing) {
            progressAnim.setValue(0);
            storyPlayer.replay();
            storyPlayer.play();
        } else {
            // Also covers moving from a video story to an image story: the
            // player must be stopped, otherwise the old clip's audio and its
            // `playToEnd` event would carry over into the next story.
            storyPlayer.pause();
        }
    }, [visible, storyVideoUri, storyPlayer, showReactions, showViewersModal, isAdShowing]);

    // Advance to the next story when a video finishes playing
    useEventListener(storyPlayer, 'playToEnd', () => {
        if (visible && !showReactions && !showViewersModal && !isAdShowing) {
            handleNextStoryRef.current?.();
        }
    });

    // Sync the progress bar with the actual video playback position
    useEventListener(storyPlayer, 'timeUpdate', ({ currentTime }) => {
        if (visible && story?.video && !showReactions && !showViewersModal && !isAdShowing) {
            const duration = storyPlayer.duration;
            if (duration > 0) {
                progressAnim.setValue(currentTime / duration);
            }
        }
    });

    // Reset the per-session story counter whenever the viewer closes, so the
    // ad cadence only accumulates during a single continuous viewing session.
    useEffect(() => {
        if (!visible) {
            setStoriesViewedSinceAd(0);
            setAdShownForStory(false);
        }
    }, [visible]);

    // Fire a full-screen interstitial after the user has watched about N
    // stories. The ad pauses the auto-advance; once it closes, viewing
    // resumes naturally on the next tick.
    useEffect(() => {
        if (!visible || !story || isAdShowing) return;
        if (adShownForStory) return;
        if (storiesViewedSinceAd >= INTERSTITIAL_STORY_INTERVAL) {
            progressAnim.stopAnimation();
            const shown = showIfNeeded();
            if (shown) {
                // Keep the flag until the ad has actually been presented and
                // closed, otherwise a still-loading ad would retrigger here.
                adIsPendingRef.current = true;
                setAdShownForStory(true);
                // Reset the cadence now so the next ad is another N stories
                // away rather than firing again the moment this one closes.
                setStoriesViewedSinceAd(0);
            } else {
                // Not ready — reset the counter so it tries again on the next
                // story instead of blocking the flow.
                setStoriesViewedSinceAd(0);
            }
        }
    }, [visible, story, storiesViewedSinceAd, adShownForStory, isAdShowing, showIfNeeded]);

    // Re-arm the ad cadence once a presented interstitial finishes, so a long
    // viewing session gets another ad instead of firing at most one.
    useEffect(() => {
        if (!adShownForStory || !isAdShowing) return;
        adIsPendingRef.current = false;
    }, [adShownForStory, isAdShowing]);

    useEffect(() => {
        if (adShownForStory && !isAdShowing && !adIsPendingRef.current) {
            setAdShownForStory(false);
        }
    }, [adShownForStory, isAdShowing]);

    // Count stories actually consumed by the user. A story counts once its
    // id changes while the viewer is open — the progress-bar timer reaching
    // the end calls handleNextStory, which moves us here.
    const lastStoryIdRef = useRef<string | undefined>(undefined);
    useEffect(() => {
        if (!visible || !story) return;
        if (lastStoryIdRef.current !== undefined && lastStoryIdRef.current !== story._id) {
            setStoriesViewedSinceAd(prev => prev + 1);
        }
        lastStoryIdRef.current = story._id;
    }, [visible, story]);

    // Reset viewers modal when story changes or viewer is closed
    useEffect(() => {
        setShowViewersModal(false);
    }, [currentStoryIndex, currentGroupUserId, visible]);

    const handlePrevStory = () => {
        advanceLockRef.current = false;
        if (currentStoryIndex > 0) {
            setCurrentStoryIndex(prev => prev - 1);
            return;
        }
        // Jump to the last story of the nearest previous user that has one.
        const prevUserId = findNextSessionUserId(sessionGroupIds, currentGroupUserId, storyGroupsRef.current, -1);
        if (prevUserId) {
            const prevGroup = storyGroupsRef.current.find(g => g.user?._id === prevUserId);
            setCurrentGroupUserId(prevUserId);
            setCurrentGroupIndex(storyGroupsRef.current.findIndex(g => g.user?._id === prevUserId));
            setCurrentStoryIndex(Math.max(0, (prevGroup?.stories.length ?? 1) - 1));
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
        if (!group || !group.user) return;
        
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
            const hasSameReaction = story.reactions?.some((r: any) => r && r.user && r.user._id === (user?._id || '') && r.type === type);
            
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
            {story.video && getImageUrl(story.video) ? (
                <VideoView
                    key={storyVideoUri}
                    player={storyPlayer}
                    style={styles.media}
                    nativeControls={false}
                    contentFit="contain"
                    // A SurfaceView composites in its own window above the whole
                    // React Native view tree on Android, which would keep the
                    // caption overlay hidden behind the video.
                    surfaceType="textureView"
                />
            ) : story.image && getImageUrl(story.image) ? (
                <Image source={{ uri: getImageUrl(story.image) }} style={styles.media} />
            ) : null}
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
                <Pressable
                    style={{ flexDirection: 'row', alignItems: 'center' }}
                    onPress={() => {
                        if (group.user?._id !== user?._id) {
                            onClose();
                            router.push(`/user/${group.user._id}`);
                        }
                    }}
                >
                    <Image source={{ uri: getImageUrl(group.user?.profilePhoto) }} style={styles.avatar} />
                    <ThemedText style={styles.username}>{group.user?.username || 'User'}</ThemedText>
                </Pressable>
                <ThemedText style={styles.time}>{getRelativeTime(story.createdAt)}</ThemedText>
                {!isOwnStory && (
                    <Pressable onPress={handleMuteUser} style={styles.moreButton}>
                        <IconSymbol name="ellipsis" size={24} color={white} />
                    </Pressable>
                )}
                {isOwnStory && (
                    <Pressable onPress={handleDeleteStory} style={styles.deleteButton}>
                        <IconSymbol name="trash" size={20} color={white} />
                    </Pressable>
                )}
                <Pressable onPress={onClose} style={styles.closeButton}>
                    <IconSymbol name="x" size={24} color={white} />
                </Pressable>
            </View>

            {/* Navigation Gestures */}
            <View style={styles.navigationOverlay}>
                <Pressable style={styles.navButton} onPress={handlePrevStory} />
                <Pressable style={styles.navButton} onPress={handleNextStory} />
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
                <Pressable
                    style={[styles.viewersButton, { paddingBottom: insets.bottom + spacing.md }]}
                    onPress={() => setShowViewersModal(true)}
                >
                    <IconSymbol name="eye.fill" size={24} color={white} />
                    <ThemedText style={styles.viewersCount}>
                        {story.viewers?.length || 0}
                    </ThemedText>
                </Pressable>
            )}
        </ThemedView>
    );

    return (
        <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
            {showViewersModal || showReactions ? storyContent : (
                <Pressable style={styles.modalFill} onPressIn={handlePressIn} onPressOut={handlePressOut}>
                    {storyContent}
                </Pressable>
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
                        <Pressable
                            style={styles.reactButton}
                            onPress={() => setShowReactions(true)}
                        >
                            <IconSymbol name="heart" size={28} color={white} />
                        </Pressable>
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
    // The Modal renders this wrapper, so it must carry the full-screen height:
    // without it the inner `container` (flex: 1) collapses to zero height and
    // every absolutely-positioned child of that height — the caption overlay,
    // the poll — has no box to draw in.
    modalFill: {
        flex: 1,
    },
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
        ...StyleSheet.absoluteFill,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
        backgroundColor: 'rgba(0,0,0,0.3)',
        zIndex: 2,
        elevation: 2,
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
        zIndex: 3,
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
        zIndex: 3,
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
        ...StyleSheet.absoluteFill,
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
