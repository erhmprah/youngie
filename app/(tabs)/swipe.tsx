// app/(tabs)/swipe.tsx

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { StyleSheet, View, TouchableOpacity, Animated, PanResponder, Dimensions, Image, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/contexts/AuthContext';
import { userAPI, getImageUrl } from '@/utils/api';
import { useThemeColor } from '@/hooks/use-theme-color';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { spacing, borderRadius, typography, shadows } from '@/constants/design-tokens';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

export default function SwipeScreen() {
    const { user } = useAuth();
    const router = useRouter();
    const [profiles, setProfiles] = useState<any[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    const pan = useRef(new Animated.ValueXY()).current;

    const backgroundColor = useThemeColor('background');
    const primaryColor = useThemeColor('primary');
    const textColor = useThemeColor('text');
    const lightTextColor = useThemeColor('lightText');
    const white = useThemeColor('white');
    const surfaceColor = useThemeColor('surface');
    const borderColor = useThemeColor('border');

    useEffect(() => {
        fetchNearbyUsers();
    }, []);

    const currentProfile = profiles[currentIndex];

    const completeSwipe = async (direction: 'left' | 'right') => {
        const x = direction === 'right' ? width * 1.5 : -width * 1.5;
        Animated.timing(pan, {
            toValue: { x, y: 0 },
            duration: 300,
            useNativeDriver: false,
        }).start(async () => {
            pan.setValue({ x: 0, y: 0 });

            if (direction === 'right' && currentProfile && user?._id) {
                try {
                    await userAPI.sendFriendRequest(user._id, currentProfile._id);
                    Alert.alert('✅', 'Friend request sent!', [
                        { text: 'Continue', onPress: () => setCurrentIndex((prev) => prev + 1) }
                    ]);
                } catch (error: any) {
                    console.error('Friend request error:', error);
                    Alert.alert('Error', error.response?.data?.msg || 'Failed to send friend request');
                    setCurrentIndex((prev) => prev + 1);
                }
            } else {
                setCurrentIndex((prev) => prev + 1);
            }
        });
    };

    const panResponder = useMemo(() =>
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
            onPanResponderRelease: (e, { dx, dy }) => {
                if (dx > 120) {
                    completeSwipe('right');
                } else if (dx < -120) {
                    completeSwipe('left');
                } else if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
                    if (currentProfile?._id) {
                        router.push(`/user/${currentProfile._id}`);
                    }
                    Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
                } else {
                    Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
                }
            },
        }), [currentProfile, completeSwipe, pan, router]
    );

    const fetchNearbyUsers = async () => {
        try {
            setIsLoading(true);
            const response = await userAPI.getNearbyUsers();
            setProfiles(response.data);
        } catch (error) {
            Alert.alert('Error', 'Could not load profiles');
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <ThemedView style={styles.centerContainer}>
                <ActivityIndicator size="large" color={primaryColor} />
            </ThemedView>
        );
    }

    if (!currentProfile) {
        return (
            <ThemedView style={styles.centerContainer}>
                <ThemedText type="heading1">✨</ThemedText>
                <ThemedText type="title">Discovery Finished</ThemedText>
                <ThemedText style={{ color: lightTextColor, textAlign: 'center', marginTop: spacing.sm }}>Check back later for more people nearby.</ThemedText>
                <TouchableOpacity style={[styles.refreshButton, { backgroundColor: primaryColor }]} onPress={fetchNearbyUsers}>
                    <ThemedText style={[styles.refreshButtonText, { color: white }]}>Refresh</ThemedText>
                </TouchableOpacity>
            </ThemedView>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor }}>
            <View style={[styles.header, { borderBottomColor: borderColor }]}>
                <ThemedText style={[styles.brandText, { color: primaryColor }]}>Discovery</ThemedText>
                <TouchableOpacity style={[styles.iconButton, { backgroundColor: surfaceColor }]} >
                    <IconSymbol name="settings" size={24} color={lightTextColor} />
                </TouchableOpacity>
            </View>

            <View style={styles.cardStack}>
                {profiles[currentIndex + 1] && (
                    <ThemedView style={[styles.card, styles.nextCard, { backgroundColor: surfaceColor, ...shadows.md }]} />
                )}

                <Animated.View
                    style={[
                        styles.card,
                        {
                            backgroundColor: surfaceColor,
                            ...shadows.md,
                            transform: [
                                ...pan.getTranslateTransform(),
                                {
                                    rotate: pan.x.interpolate({
                                        inputRange: [-200, 0, 200],
                                        outputRange: ['-10deg', '0deg', '10deg'],
                                    }),
                                },
                            ],
                        },
                    ]}
                    {...panResponder.panHandlers}
                >
                    {currentProfile.profilePhoto ? (
                        <Image
                            source={{ uri: getImageUrl(currentProfile.profilePhoto) }}
                            style={styles.cardImage}
                        />
                    ) : (
                        <View style={[styles.cardImage, { backgroundColor: surfaceColor, justifyContent: 'center', alignItems: 'center' }]}>
                            <IconSymbol name="person.fill" size={120} color={lightTextColor} />
                        </View>
                    )}

                    <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.9)']}
                        style={styles.gradient}
                    >
                        <View style={styles.infoContainer}>
                            <View style={styles.nameRow}>
                                <ThemedText style={[styles.nameText, { color: white }]}>
                                    {currentProfile.username}, {currentProfile.age}
                                </ThemedText>
                                <View style={styles.verifiedBadge}>
                                    <IconSymbol name="heart.fill" size={typography.sizes.body1} color={primaryColor} />
                                </View>
                            </View>

                            <View style={styles.locationRow}>
                                <IconSymbol name="settings" size={typography.sizes.body2} color={white} />
                                <ThemedText style={[styles.locationText, { color: white }]}>{currentProfile.location || 'Nearby'}</ThemedText>
                            </View>

                            <ThemedText numberOfLines={2} style={[styles.bioText, { color: white }]}>
                                {currentProfile.bio || "No bio provided."}
                            </ThemedText>

                            <View style={styles.tagContainer}>
                                {currentProfile.interests?.slice(0, 3).map((item: string, i: number) => (
                                    <View key={i} style={[styles.tag, { borderColor: white }]}>
                                        <ThemedText style={[styles.tagText, { color: white }]}>{item}</ThemedText>
                                    </View>
                                ))}
                            </View>
                        </View>
                    </LinearGradient>
                </Animated.View>
            </View>

            <View style={styles.footer}>
                <TouchableOpacity 
                    style={[styles.roundButton, { backgroundColor: surfaceColor, borderColor }]} 
                    onPress={() => completeSwipe('left')}
                >
                    <IconSymbol name="x" size={30} color={lightTextColor} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.roundButton, { backgroundColor: surfaceColor, borderColor }]}
                    onPress={() => completeSwipe('right')}
                >
                    <IconSymbol name="plus" size={30} color={primaryColor} />
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        height: 60,
        borderBottomWidth: 1,
    },
    brandText: { fontSize: typography.sizes.heading2, fontFamily: typography.families.bold },
    iconButton: { padding: spacing.sm, borderRadius: borderRadius.md },
    cardStack: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.md },
    card: {
        width: width - spacing.md * 2,
        height: '100%',
        borderRadius: borderRadius.xl,
        overflow: 'hidden',
        position: 'absolute',
    },
    nextCard: {
        transform: [{ scale: 0.94 }, { translateY: spacing.md }],
        zIndex: -1,
        opacity: 0.5,
    },
    cardImage: { width: '100%', height: '100%', position: 'absolute' },
    gradient: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: '50%',
        justifyContent: 'flex-end',
        padding: spacing.lg,
    },
    infoContainer: { marginBottom: spacing.sm },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    nameText: { fontSize: typography.sizes.heading3, fontFamily: typography.families.bold },
    verifiedBadge: { marginTop: spacing.xxs },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs, marginTop: spacing.xs },
    locationText: { fontSize: typography.sizes.body2 },
    bioText: { opacity: 0.8, marginTop: spacing.sm, lineHeight: 20 },
    tagContainer: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.md, flexWrap: 'wrap' },
    tag: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xxs,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
    },
    tagText: { fontSize: typography.sizes.caption, fontFamily: typography.families.medium },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing.xl,
        paddingVertical: spacing.lg,
    },
    roundButton: {
        width: 64,
        height: 64,
        borderRadius: borderRadius.round,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
        ...shadows.md,
    },
    refreshButton: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: borderRadius.xl, marginTop: spacing.lg },
    refreshButtonText: { fontSize: typography.sizes.title, fontFamily: typography.families.bold },
});
