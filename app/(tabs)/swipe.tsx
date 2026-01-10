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
import { FilterModal, FilterState } from '@/components/FilterModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSocket } from '@/utils/socket';

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
    const { user } = useAuth();
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
                const savedFilters = await AsyncStorage.getItem('discovery_filters');
                if (savedFilters) {
                    const parsedFilters = JSON.parse(savedFilters);
                    setFilters(parsedFilters);
                    fetchNearbyUsers(parsedFilters);
                } else {
                    fetchNearbyUsers();
                }
            } catch (error) {
                fetchNearbyUsers();
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
        if (currentProfile?._id && !albums[currentProfile._id]) {
            fetchUserAlbum(currentProfile._id);
        }
        setCurrentImageIndex(0); // Reset to first image when profile changes
    }, [currentProfile?._id]);

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

    const fetchNearbyUsers = async (filterParams?: FilterState) => {
        try {
            setIsLoading(true);
            const activeFilters = filterParams || filters;
            const response = await userAPI.getNearbyUsers(activeFilters);
            
            let filteredData = response.data;

            if (activeFilters.minAge) {
                const min = parseInt(activeFilters.minAge);
                if (!isNaN(min)) filteredData = filteredData.filter((p: any) => p.age >= min);
            }
            if (activeFilters.maxAge) {
                const max = parseInt(activeFilters.maxAge);
                if (!isNaN(max)) filteredData = filteredData.filter((p: any) => p.age <= max);
            }
            if (activeFilters.gender && activeFilters.gender.length > 0) {
                filteredData = filteredData.filter((p: any) => activeFilters.gender.includes(p.gender));
            }
            
            // Radius-based filtering
            if (activeFilters.latitude && activeFilters.longitude && activeFilters.radius) {
                filteredData = filteredData.filter((p: any) => {
                    if (!p.latitude || !p.longitude) return false; // Skip users without coords
                    const distance = getDistanceFromLatLonInKm(activeFilters.latitude!, activeFilters.longitude!, p.latitude, p.longitude);
                    return distance <= activeFilters.radius!;
                });
            } else if (activeFilters.location) {
                // Fallback to string matching if no coords
                filteredData = filteredData.filter((p: any) => p.location && p.location.toLowerCase().includes(activeFilters.location.toLowerCase()));
            }

            setProfiles(filteredData);
        } catch (error) {
            Alert.alert('Error', 'Could not load profiles');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchUserAlbum = async (userId: string) => {
        try {
            const response = await userAPI.getAlbum(userId);
            setAlbums(prev => ({ ...prev, [userId]: response.data || [] }));
        } catch (error) {
            console.error('Error fetching album:', error);
        }
    };

    const handleApplyFilters = async (newFilters: FilterState) => {
        setFilters(newFilters);
        fetchNearbyUsers(newFilters);
        try {
            await AsyncStorage.setItem('discovery_filters', JSON.stringify(newFilters));
        } catch (error) {
            console.error('Failed to save filters:', error);
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
                <ThemedText type="heading1">{activeFilterCount > 0 ? '🔍' : '✨'}</ThemedText>
                <ThemedText type="title">{activeFilterCount > 0 ? 'No Matches Found' : 'Discovery Finished'}</ThemedText>
                <ThemedText style={{ color: lightTextColor, textAlign: 'center', marginTop: spacing.sm }}>
                    {activeFilterCount > 0 ? 'Try adjusting your filters to see more people.' : 'Check back later for more people nearby.'}
                </ThemedText>
                <TouchableOpacity 
                    style={[styles.refreshButton, { backgroundColor: primaryColor }]} 
                    onPress={activeFilterCount > 0 ? () => setFilterVisible(true) : () => fetchNearbyUsers()}
                >
                    <ThemedText style={[styles.refreshButtonText, { color: white }]}>
                        {activeFilterCount > 0 ? 'Adjust Filters' : 'Refresh'}
                    </ThemedText>
                </TouchableOpacity>
            </ThemedView>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor }}>
            <View style={[styles.header, { borderBottomColor: borderColor }]}>
                <ThemedText style={[styles.brandText, { color: primaryColor }]}>Discovery</ThemedText>
                <TouchableOpacity style={[styles.iconButton, { backgroundColor: surfaceColor }]} onPress={() => setFilterVisible(true)}>
                    <IconSymbol name="slider.horizontal.3" size={24} color={lightTextColor} />
                    {activeFilterCount > 0 && (
                        <View style={[styles.filterBadge, { backgroundColor: primaryColor, borderColor: surfaceColor }]} />
                    )}
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
                    onPress={() => completeSwipe('left')}
                >
                    <IconSymbol name="x" size={30} color={lightTextColor} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.roundButton, { backgroundColor: surfaceColor, borderColor }]}
                    onPress={() => {
                        setCurrentImageIndex(0);
                        setCurrentIndex((prev) => prev + 1);
                    }}
                >
                    <IconSymbol name="chevron.right" size={30} color={textColor} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.roundButton, { backgroundColor: surfaceColor, borderColor }]}
                    onPress={() => completeSwipe('right')}
                >
                    <IconSymbol name="plus" size={30} color={primaryColor} />
                </TouchableOpacity>
            </View>

            <FilterModal
                visible={isFilterVisible}
                onClose={() => setFilterVisible(false)}
                onApply={handleApplyFilters}
                initialFilters={filters}
            />
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
        width: 10,
        height: 10,
        borderRadius: 5,
        borderWidth: 2,
    },
    onlineIndicator: {
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#4CAF50',
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
});
