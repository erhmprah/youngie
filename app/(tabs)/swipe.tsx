// app/(tabs)/swipe.tsx

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { StyleSheet, View, TouchableOpacity, Animated, PanResponder, Dimensions, Image, ActivityIndicator, Alert, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/contexts/AuthContext';
import { userAPI, getImageUrl } from '@/utils/api';
import { useThemeColor } from '@/hooks/use-theme-color';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { spacing, borderRadius, typography, shadows } from '@/constants/design-tokens';
import { useRouter, useFocusEffect } from 'expo-router';
import { FilterModal, FilterState } from '@/components/FilterModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSocket } from '@/utils/socket';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

export default function SwipeScreen() {
    const { user, logout } = useAuth();
    const router = useRouter();
    const [profiles, setProfiles] = useState<any[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [albums, setAlbums] = useState<{[key: string]: any[]}>({});
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [isFilterVisible, setFilterVisible] = useState(false);
    const [filters, setFilters] = useState<FilterState>({
        minAge: '',
        maxAge: '',
        gender: [],
        location: ''
    });
    const [currentPage, setCurrentPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [viewMode, setViewMode] = useState<'swipe' | 'grid'>('swipe');

    const pan = useRef(new Animated.ValueXY()).current;

    const backgroundColor = useThemeColor('background');
    const primaryColor = useThemeColor('primary');
    const textColor = useThemeColor('text');
    const lightTextColor = useThemeColor('lightText');
    const white = useThemeColor('white');
    const surfaceColor = useThemeColor('surface');
    const borderColor = useThemeColor('border');

    useEffect(() => {
        const loadFilters = async () => {
            try {
                console.log('👤 User in swipe component:', user);
                const savedFilters = await AsyncStorage.getItem('discovery_filters');
                if (savedFilters) {
                    const parsedFilters = JSON.parse(savedFilters);
                    setFilters(parsedFilters);
                    fetchNearbyUsers(parsedFilters, 0, false);
                } else {
                    fetchNearbyUsers({ minAge: '', maxAge: '', gender: [], location: '' }, 0, false);
                }
            } catch (error) {
                console.error('Error loading filters:', error);
                fetchNearbyUsers({ minAge: '', maxAge: '', gender: [], location: '' }, 0, false);
            }
        };
        loadFilters();
    }, []);

    useEffect(() => {
        const socket = getSocket();

        const handleStatusChange = (data: { userId: string; isOnline: boolean }) => {
            setProfiles((prev) => prev.map((p) => (p._id === data.userId ? { ...p, isOnline: data.isOnline } : p)));
        };

        if (socket) {
            socket.on('user_status_change', handleStatusChange);
        }

        return () => {
            if (socket) {
                socket.off('user_status_change', handleStatusChange);
            }
        };
    }, []);

    useEffect(() => {
        if (profiles[currentIndex]?._id && !albums[profiles[currentIndex]._id]) {
            fetchUserAlbum(profiles[currentIndex]._id);
        }
        setCurrentImageIndex(0); // Reset to first image when profile changes
    }, [profiles[currentIndex]?._id]);

    useEffect(() => {
        if (currentIndex >= profiles.length - 5 && hasMore && !loadingMore && !isLoading) {
            fetchNearbyUsers(undefined, currentPage + 1, true);
        }
    }, [currentIndex, profiles.length, hasMore, loadingMore, isLoading, currentPage]);

    useFocusEffect(
        useCallback(() => {
            // Refetch profiles when screen comes into focus to exclude sent requests
            fetchNearbyUsers(undefined, 0, false);
        }, [])
    );

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filters.minAge) count++;
        if (filters.maxAge) count++;
        if (filters.gender.length > 0) count++;
        if (filters.location) count++;
        return count;
    }, [filters]);

    const currentProfile = profiles[currentIndex];

    const currentImages = useMemo(() => {
        if (!currentProfile) return [];
        const album = albums[currentProfile._id] || [];
        const images = [];
        if (currentProfile.profilePhoto) {
            images.push({ uri: getImageUrl(currentProfile.profilePhoto), type: 'profile' });
        }
        album.forEach((photo: any) => {
            images.push({ uri: getImageUrl(photo.image), type: 'album' });
        });
        return images;
    }, [currentProfile, albums]);

    const currentImage = currentImages[currentImageIndex] || null;

    const nextImage = () => {
        setCurrentImageIndex(prev => (prev + 1) % currentImages.length);
    };

    const prevImage = () => {
        setCurrentImageIndex(prev => (prev - 1 + currentImages.length) % currentImages.length);
    };

    const completeSwipe = async (direction: 'left' | 'right') => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const x = direction === 'right' ? width * 1.5 : -width * 1.5;
        Animated.timing(pan, {
            toValue: { x, y: 0 },
            duration: 300,
            useNativeDriver: false,
        }).start(async () => {
            pan.setValue({ x: 0, y: 0 });

            setCurrentImageIndex(0); // Reset image index when swiping
            if (direction === 'right' && currentProfile && user?._id) {
                try {
                    await userAPI.sendFriendRequest(user._id, currentProfile._id);
                    setProfiles(prev => prev.filter(p => p._id !== currentProfile._id));
                    Alert.alert('✅', 'Friend request sent!', [
                        { text: 'Continue' }
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

    const fetchNearbyUsers = async (filterParams?: FilterState, page: number = 0, append: boolean = false) => {
        try {
            if (!append) {
                setIsLoading(true);
            } else {
                setLoadingMore(true);
            }
            const activeFilters = filterParams || filters;
            console.log('🔍 Fetching nearby users with filters:', activeFilters, 'page:', page);
            const response = await userAPI.getNearbyUsers({ ...activeFilters, page, limit: 20 });
            console.log('✅ API response:', response.data);

            const { users, hasMore: newHasMore } = response.data;

            if (append) {
                setProfiles(prev => [...prev, ...users]);
            } else {
                setProfiles(users);
            }
            setHasMore(newHasMore);
            setCurrentPage(page);
        } catch (error: any) {
            console.error('❌ Error fetching nearby users:', error);
            console.error('Error details:', error.response?.data || error.message);
            Alert.alert('Error', 'Could not load profiles');
        } finally {
            setIsLoading(false);
            setLoadingMore(false);
        }
    };

    const fetchUserAlbum = async (userId: string) => {
        try {
            const response = await userAPI.getAlbum(userId);
            setAlbums(prev => ({ ...prev, [userId]: response.data || [] }));
        } catch (error: any) {
            console.error('Error fetching album:', error);
            if (error.response?.status === 401) {
                try {
                    await logout();
                } catch (logoutErr) {
                    console.error('Error during logout:', logoutErr);
                }
            }
        }
    };

    const handleApplyFilters = async (newFilters: FilterState) => {
        setFilters(newFilters);
        setCurrentPage(0);
        setHasMore(true);
        fetchNearbyUsers(newFilters, 0, false);
        try {
            await AsyncStorage.setItem('discovery_filters', JSON.stringify(newFilters));
        } catch (error) {
            console.error('Failed to save filters:', error);
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor }}>
            <View style={[styles.header, { borderBottomColor: borderColor }]}>
                <ThemedText style={[styles.brandText, { color: primaryColor }]}>Discovery</ThemedText>
                <View style={styles.headerButtons}>
                    <TouchableOpacity style={[styles.iconButton, { backgroundColor: surfaceColor }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setViewMode(viewMode === 'swipe' ? 'grid' : 'swipe'); }}>
                        <IconSymbol name={viewMode === 'swipe' ? 'square.grid.2x2' : 'rectangle.stack'} size={24} color={lightTextColor} />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.iconButton, { backgroundColor: surfaceColor }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setFilterVisible(true); }}>
                        <IconSymbol name="slider.horizontal.3" size={24} color={lightTextColor} />
                        {activeFilterCount > 0 && (
                            <View style={[styles.filterBadge, { backgroundColor: primaryColor, borderColor: surfaceColor }]} />
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            {viewMode === 'swipe' ? (
                <>
                    {isLoading ? (
                        <ThemedView style={styles.centerContainer}>
                            <ActivityIndicator size="large" color={primaryColor} />
                        </ThemedView>
                    ) : !currentProfile ? (
                        <ThemedView style={styles.centerContainer}>
                            <ThemedText type="heading1">{activeFilterCount > 0 ? '🔍' : '✨'}</ThemedText>
                            <ThemedText type="title">{activeFilterCount > 0 ? 'No Matches Found' : 'Discovery Finished'}</ThemedText>
                            <ThemedText style={{ color: lightTextColor, textAlign: 'center', marginTop: spacing.sm }}>
                                {activeFilterCount > 0 ? 'Try adjusting your filters to see more people.' : 'Check back later for more people nearby.'}
                            </ThemedText>
                            <TouchableOpacity
                                style={[styles.refreshButton, { backgroundColor: primaryColor }]}
                                onPress={activeFilterCount > 0 ? () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setFilterVisible(true); } : () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setCurrentPage(0); setHasMore(true); fetchNearbyUsers(undefined, 0, false); }}
                            >
                                <ThemedText style={[styles.refreshButtonText, { color: white }]}>
                                    {activeFilterCount > 0 ? 'Adjust Filters' : 'Refresh'}
                                </ThemedText>
                            </TouchableOpacity>
                        </ThemedView>
                    ) : (
                        <>
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
                                    <View style={styles.imageContainer}>
                                        {currentImage ? (
                                            <Image source={{ uri: currentImage.uri }} style={styles.cardImage} />
                                        ) : (
                                            <View style={[styles.cardImage, { backgroundColor: surfaceColor, justifyContent: 'center', alignItems: 'center' }]}>
                                                <IconSymbol name="person.fill" size={120} color={lightTextColor} />
                                            </View>
                                        )}
                                        {currentImages.length > 1 && (
                                            <>
                                                <TouchableOpacity style={styles.leftTapArea} onPress={prevImage} />
                                                <TouchableOpacity style={styles.rightTapArea} onPress={nextImage} />
                                            </>
                                        )}
                                        {currentImages.length > 1 && (
                                            <View style={styles.imageIndicator}>
                                                {currentImages.map((_, index) => (
                                                    <View
                                                        key={index}
                                                        style={[
                                                            styles.indicatorDot,
                                                            { backgroundColor: index === currentImageIndex ? primaryColor : lightTextColor }
                                                        ]}
                                                    />
                                                ))}
                                            </View>
                                        )}
                                    </View>

                                    <LinearGradient
                                        colors={['transparent', 'rgba(0,0,0,0.9)']}
                                        style={styles.gradient}
                                    >
                                        <View style={styles.infoContainer}>
                                            <View style={styles.nameRow}>
                                                <ThemedText style={[styles.nameText, { color: white }]}>
                                                    {currentProfile.username}, {currentProfile.age}
                                                </ThemedText>
                                                {currentProfile.isOnline && (
                                                    <View style={styles.onlineIndicator} />
                                                )}
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
                                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); completeSwipe('left'); }}
                                >
                                    <IconSymbol name="x" size={30} color={lightTextColor} />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.roundButton, { backgroundColor: surfaceColor, borderColor }]}
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        setCurrentImageIndex(0);
                                        setCurrentIndex((prev) => prev + 1);
                                    }}
                                >
                                    <IconSymbol name="chevron.right" size={30} color={textColor} />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.roundButton, { backgroundColor: surfaceColor, borderColor }]}
                                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); completeSwipe('right'); }}
                                >
                                    <IconSymbol name="plus" size={30} color={primaryColor} />
                                </TouchableOpacity>
                            </View>
                        </>
                    )}
                </>
            ) : (
                <GridView
                    profiles={profiles}
                    isLoading={isLoading}
                    hasMore={hasMore}
                    loadingMore={loadingMore}
                    onLoadMore={() => fetchNearbyUsers(undefined, currentPage + 1, true)}
                    onProfilePress={(profile) => router.push(`/user/${profile._id}`)}
                    activeFilterCount={activeFilterCount}
                    onAdjustFilters={() => setFilterVisible(true)}
                    onRefresh={() => { setCurrentPage(0); setHasMore(true); fetchNearbyUsers(undefined, 0, false); }}
                    primaryColor={primaryColor}
                    white={white}
                    lightTextColor={lightTextColor}
                    surfaceColor={surfaceColor}
                    borderColor={borderColor}
                />
            )}

            <FilterModal
                visible={isFilterVisible}
                onClose={() => setFilterVisible(false)}
                onApply={handleApplyFilters}
                initialFilters={filters}
            />
        </SafeAreaView>
    );
}

const GridView = ({
    profiles,
    isLoading,
    hasMore,
    loadingMore,
    onLoadMore,
    onProfilePress,
    activeFilterCount,
    onAdjustFilters,
    onRefresh,
    primaryColor,
    white,
    lightTextColor,
    surfaceColor,
    borderColor
}: {
    profiles: any[];
    isLoading: boolean;
    hasMore: boolean;
    loadingMore: boolean;
    onLoadMore: () => void;
    onProfilePress: (profile: any) => void;
    activeFilterCount: number;
    onAdjustFilters: () => void;
    onRefresh: () => void;
    primaryColor: string;
    white: string;
    lightTextColor: string;
    surfaceColor: string;
    borderColor: string;
}) => {
    const renderProfileCard = ({ item }: { item: any }) => (
        <TouchableOpacity
            style={[styles.gridCard, { backgroundColor: surfaceColor, borderColor }]}
            onPress={() => onProfilePress(item)}
        >
            <View style={styles.gridImageContainer}>
                {item.profilePhoto ? (
                    <Image source={{ uri: getImageUrl(item.profilePhoto) }} style={styles.gridImage} />
                ) : (
                    <View style={[styles.gridImage, { backgroundColor: surfaceColor, justifyContent: 'center', alignItems: 'center' }]}>
                        <IconSymbol name="person.fill" size={60} color={lightTextColor} />
                    </View>
                )}
            </View>
            <View style={styles.gridInfo}>
                <View style={styles.gridNameRow}>
                    <ThemedText style={[styles.gridNameText, { color: lightTextColor }]}>
                        {item.username}, {item.age}
                    </ThemedText>
                    {item.isOnline && <View style={styles.onlineIndicator} />}
                </View>
                <ThemedText style={[styles.gridLocationText, { color: lightTextColor }]}>
                    {item.location || 'Nearby'}
                </ThemedText>
            </View>
        </TouchableOpacity>
    );

    if (isLoading) {
        return (
            <ThemedView style={styles.centerContainer}>
                <ActivityIndicator size="large" color={primaryColor} />
            </ThemedView>
        );
    }

    if (profiles.length === 0) {
        return (
            <ThemedView style={styles.centerContainer}>
                <ThemedText type="heading1">{activeFilterCount > 0 ? '🔍' : '✨'}</ThemedText>
                <ThemedText type="title">{activeFilterCount > 0 ? 'No Matches Found' : 'Discovery Finished'}</ThemedText>
                <ThemedText style={{ color: lightTextColor, textAlign: 'center', marginTop: spacing.sm }}>
                    {activeFilterCount > 0 ? 'Try adjusting your filters to see more people.' : 'Check back later for more people nearby.'}
                </ThemedText>
                <TouchableOpacity
                    style={[styles.refreshButton, { backgroundColor: primaryColor }]}
                    onPress={activeFilterCount > 0 ? onAdjustFilters : onRefresh}
                >
                    <ThemedText style={[styles.refreshButtonText, { color: white }]}>
                        {activeFilterCount > 0 ? 'Adjust Filters' : 'Refresh'}
                    </ThemedText>
                </TouchableOpacity>
            </ThemedView>
        );
    }

    return (
        <FlatList
            data={profiles}
            renderItem={renderProfileCard}
            keyExtractor={(item) => item._id}
            numColumns={2}
            contentContainerStyle={styles.gridContainer}
            onEndReached={hasMore ? onLoadMore : undefined}
            onEndReachedThreshold={0.5}
            ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color={primaryColor} style={styles.loadingMore} /> : null}
        />
    );
};

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
    headerButtons: { flexDirection: 'row', gap: spacing.sm },
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
    imageContainer: { width: '100%', height: '100%', position: 'relative' },
    leftTapArea: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '50%', zIndex: 10 },
    rightTapArea: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '50%', zIndex: 10 },
    imageIndicator: { position: 'absolute', bottom: 20, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 },
    indicatorDot: { width: 8, height: 8, borderRadius: 4 },
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
    filterBadge: {
        position: 'absolute',
        top: 6,
        right: 6,
    },
    gridContainer: { padding: spacing.md },
    gridCard: {
        flex: 1,
        margin: spacing.xs,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        overflow: 'hidden',
        ...shadows.sm,
    },
    gridImageContainer: { aspectRatio: 1 },
    gridImage: { width: '100%', height: '100%' },
    gridInfo: { padding: spacing.sm },
    gridNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    gridNameText: { fontSize: typography.sizes.body1, fontFamily: typography.families.bold },
    gridLocationText: { fontSize: typography.sizes.caption, marginTop: spacing.xxs },
    loadingMore: { marginVertical: spacing.lg },
    onlineIndicator: {
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#4CAF50',
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
});
