// app/(tabs)/profile.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, FlatList, ActivityIndicator, Alert, Image, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { EditProfileModal } from '@/components/edit-profile-modal';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useThemeColor } from '@/hooks/use-theme-color';
import { CustomAlert } from '@/utils/alert';
import { userAPI, postAPI, chatAPI, getImageUrl } from '@/utils/api';
import { verticalScale } from '@/utils/scale';
import { cachedUserAPI, cachedPostAPI } from '@/utils/cachedApi';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SkeletonProfile, SkeletonGrid } from '@/components/ui/skeleton';
import { spacing, typography, borderRadius, shadows, sizes } from '@/constants/design-tokens';
import { ImageViewerModal } from '@/components/image-viewer-modal';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

export default function ProfileScreen() {
    const [activeTab, setActiveTab] = useState('posts');
    const [friendRequestTab, setFriendRequestTab] = useState<'friends' | 'sent' | 'received'>('friends');
    const [favoritedPosts, setFavoritedPosts] = useState<any[]>([]);
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [stats, setStats] = useState([
        { label: 'Posts', value: '0' },
        { label: 'Friends', value: '0' },
        { label: 'Matches', value: '0' },
    ]);
    const [userPosts, setUserPosts] = useState<any[]>([]);
    const [friends, setFriends] = useState<any[]>([]);
    const [sentRequests, setSentRequests] = useState<any[]>([]);
    const [receivedRequests, setReceivedRequests] = useState<any[]>([]);
    const [album, setAlbum] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
    const { user, logout, updateUser } = useAuth();
    const router = useRouter();

    const backgroundColor = useThemeColor('background');
    const primaryColor = useThemeColor('primary');
    const textColor = useThemeColor('text');
    const lightTextColor = useThemeColor('lightText');
    const cardBackgroundColor = useThemeColor('surface');
    const borderColor = useThemeColor('border');
    const white = useThemeColor('white');
    const userId = user?._id;
    const errorColor = useThemeColor('error');

    const fetchProfileData = useCallback(async () => {
        if (!userId) {
            setLoading(false);
            return;
        }
        setLoading(true);
        
        // Create a timeout to prevent infinite loading
        const timeoutId = setTimeout(() => {
            console.log('Profile fetch timeout - setting loading to false');
            setLoading(false);
        }, 15000); // 15 second timeout
        
        try {
            // Use cached API for profile and posts with error handling
            const [statsResponse, postsResponse, albumResponse, sentRequestsResponse, receivedRequestsResponse] = await Promise.all([
                cachedUserAPI.getProfile(userId, true).catch((err) => {
                    console.error('getProfile error:', err);
                    return { data: { posts: [], friends: [] } };
                }),
                cachedPostAPI.getUserPosts(userId, 1, 20, true).catch((err) => {
                    console.error('getUserPosts error:', err);
                    return { data: [] };
                }),
                userAPI.getAlbum(userId).catch(() => ({ data: [] })),
                userAPI.getSentFriendRequests().catch(() => ({ data: [] })),
                userAPI.getIncomingFriendRequests().catch(() => ({ data: [] })),
            ]);
            
            // Clear timeout since we got a response
            clearTimeout(timeoutId);
            
            const userData = statsResponse.data;
            // Handle both array and object response formats for posts
            const postsResponseData = postsResponse.data?.posts || postsResponse.data || [];
            const postsData = Array.isArray(postsResponseData) ? postsResponseData : [];
            const totalLikes = postsData.reduce((sum: number, post: any) => sum + (post.likes?.length || 0), 0);
            setStats([
                { label: 'Posts', value: String(userData.posts?.length || 0) },
                { label: 'Friends', value: String(userData.friends?.length || 0) },
                { label: 'Likes', value: String(totalLikes) },
            ]);
            setFriends(userData.friends || []);
            setUserPosts(postsData);
            setAlbum(albumResponse.data?.data || []);
            setSentRequests(sentRequestsResponse.data || []);
            setReceivedRequests(receivedRequestsResponse.data || []);
        } catch (error: any) {
            // Clear timeout on error
            clearTimeout(timeoutId);
            console.error('fetchProfileData error:', error);
             if (error.response?.status === 401) {
                 try {
                     await logout();
                 } catch (logoutErr) {
                     console.error('Logout error:', logoutErr);
                 }
                 CustomAlert.error('Session Expired', 'Please log in again');
             } else {
                 CustomAlert.error('Error', 'Failed to load profile data');
             }
        } finally {
            clearTimeout(timeoutId);
            setLoading(false);
        }
    }, [userId, logout]);

    const isMountedRef = React.useRef(true);
    const hasFetchedRef = React.useRef(false);
    
    useFocusEffect(
        useCallback(() => {
            isMountedRef.current = true;
            
            // Only fetch if we have a userId and haven't fetched yet
            if (userId && !hasFetchedRef.current) {
                hasFetchedRef.current = true;
                fetchProfileData();
            } else if (!userId) {
                // If no userId, allow re-fetch when it becomes available
                hasFetchedRef.current = false;
                setLoading(false);
            } else {
                // UserId is available but already fetched, refresh data
                fetchProfileData();
            }
            
            return () => {
                isMountedRef.current = false;
            };
        }, [fetchProfileData, userId])
    );

    const handleEditProfile = async (profileData: any) => {
        if (!user?._id) return;
        try {
            CustomAlert.loading('Updating profile...', 'Please wait');
            await userAPI.updateProfile(user._id, profileData);
            updateUser(profileData);
            setIsEditModalVisible(false);
            CustomAlert.success('Success', 'Profile updated successfully');
            fetchProfileData();
        } catch (error: any) {
            CustomAlert.error('Error', error.response?.data?.msg || 'Failed to update profile');
        }
    };

    const handleProfilePhotoUpload = async () => {
        if (!user?._id) return;
        
        // Request permission to access media library
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            CustomAlert.error('Permission Required', 'Please grant access to your photo library to upload a profile photo.');
            return;
        }
        
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
        });

        if (!result.canceled) {
            const uri = result.assets[0].uri;
            const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
            const filename = `profile-photo-${Date.now()}.jpg`;

            try {
                CustomAlert.loading('Uploading photo...', 'Please wait');
                const response = await userAPI.uploadProfilePhotoBase64(user._id, {
                    imageData: `data:image/jpeg;base64,${base64}`,
                    filename
                }) as any;
                if (response.profilePhoto) {
                    updateUser({ profilePhoto: response.profilePhoto });
                    CustomAlert.success('Success', 'Profile photo updated successfully');
                    fetchProfileData();
                }            } catch (error) {
                CustomAlert.error('Error', 'Failed to upload profile photo');
            }
        }
    };

    const handleCoverPhotoUpload = async () => {
        if (!user?._id) return;
        
        // Request permission to access media library
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            CustomAlert.error('Permission Required', 'Please grant access to your photo library to upload a cover photo.');
            return;
        }
        
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [2, 1],
            quality: 0.7,
        });

        if (!result.canceled) {
            const uri = result.assets[0].uri;
            const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
            const filename = `cover-photo-${Date.now()}.jpg`;

            try {
                CustomAlert.loading('Uploading cover photo...', 'Please wait');
                const response = await userAPI.uploadCoverPhotoBase64(user._id, {
                    imageData: `data:image/jpeg;base64,${base64}`,
                    filename
                }) as any;
                if (response.coverPhoto) {
                    updateUser({ coverPhoto: response.coverPhoto });
                    CustomAlert.success('Success', 'Cover photo updated successfully');
                    fetchProfileData();
                }
            } catch (error) {
                CustomAlert.error('Error', 'Failed to upload cover photo');
            }
        }
    };

    const handleAddPhotoToAlbum = async () => {
        if (!user?._id) return;
        
        // Request permission to access media library
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            CustomAlert.error('Permission Required', 'Please grant access to your photo library to upload photos.');
            return;
        }
        
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.8,
        });

        if (!result.canceled) {
            const uri = result.assets[0].uri;
            const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
            const filename = `album-photo-${Date.now()}.jpg`;

            try {
                CustomAlert.loading('Uploading photo...', 'Please wait');
                await userAPI.uploadAlbumPhoto(user._id, {
                    imageData: `data:image/jpeg;base64,${base64}`,
                    filename
                });
                CustomAlert.success('Success', 'Photo added to album');
                fetchProfileData();
            } catch (error) {
                CustomAlert.error('Error', 'Failed to upload photo');
            }
        }
    };

    const handleDeleteAlbumPhoto = async (photoId: string) => {
        if (!user?._id) return;
        CustomAlert.confirm(
            'Delete Photo',
            'Are you sure you want to delete this photo?',
            async () => {
                try {
                    CustomAlert.loading('Deleting photo...', 'Please wait');
                    await userAPI.deleteAlbumPhoto(user._id, photoId);
                    setAlbum(prev => prev.filter(p => p._id !== photoId));
                    CustomAlert.success('Deleted', 'Photo has been deleted');
                } catch (error) {
                    CustomAlert.error('Error', 'Failed to delete photo');
                }
            }
        );
    };

    const handleMessage = async (friendId: string) => {
        if (!user?._id) return;
        try {
            const response = await chatAPI.getUserChats(user._id, 1, 50);
            const chats = response.data.data || [];
            // Check for existing 1-on-1 chat
            const existingChat = chats.find((c: any) => 
                !c.isGroupChat && c.participants.some((p: any) => (p._id === friendId || p === friendId))
            );

            if (existingChat) {
                router.push(`/chat/${existingChat._id}`);
            } else {
                const newChatResponse = await chatAPI.createChat({
                    participants: [user._id, friendId],
                    isGroupChat: false
                });
                router.push(`/chat/${newChatResponse.data._id}`);
            }
         } catch (error) {
             CustomAlert.error('Error', 'Failed to open chat');
         }
    };

    const handleUnfriend = async (friendId: string, username: string) => {
        if (!user?._id) return;

        CustomAlert.show({
            type: 'confirm',
            title: 'Unfriend',
            message: `Are you sure you want to remove ${username} as a friend?`,
            buttons: [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Unfriend',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await userAPI.unfriend(user._id, friendId);
                            setFriends(prev => prev.filter(f => f._id !== friendId));
                            setStats(prev => prev.map(s => s.label === 'Friends' ? { ...s, value: String(Math.max(0, parseInt(s.value) - 1)) } : s));
                        } catch (error) {
                            CustomAlert.error('Error', 'Failed to unfriend user');
                        }
                    }
                }
            ],
            dismissable: true
        });
    };

    const handleBlock = async (friendId: string, username: string) => {
        if (!user?._id) return;

        CustomAlert.show({
            type: 'confirm',
            title: 'Block User',
            message: `Are you sure you want to block ${username}? This will remove them from your friends and prevent them from contacting you.`,
            buttons: [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Block',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await userAPI.blockUser(user._id, friendId);
                            setFriends(prev => prev.filter(f => f._id !== friendId));
                            setStats(prev => prev.map(s => s.label === 'Friends' ? { ...s, value: String(Math.max(0, parseInt(s.value) - 1)) } : s));
                            CustomAlert.success('Success', `${username} has been blocked`);
                        } catch (error) {
                            CustomAlert.error('Error', 'Failed to block user');
                        }
                    }
                }
            ],
            dismissable: true
        });
    };

    const handleCancelRequest = async (requestId: string, username: string) => {
        if (!user?._id) return;

        CustomAlert.show({
            type: 'confirm',
            title: 'Cancel Request',
            message: `Are you sure you want to cancel your friend request to ${username}?`,
            buttons: [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Cancel Request',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await userAPI.cancelFriendRequest(user._id, requestId);
                            setSentRequests(prev => prev.filter(r => r._id !== requestId));
                            CustomAlert.success('Success', 'Friend request cancelled');
                        } catch (error) {
                            CustomAlert.error('Error', 'Failed to cancel friend request');
                        }
                    }
                }
            ],
            dismissable: true
        });
    };

    const handleAcceptRequest = async (requestId: string, username: string) => {
        if (!user?._id) return;

        try {
            await userAPI.acceptFriendRequest(user._id, requestId);
            setReceivedRequests(prev => prev.filter(r => r._id !== requestId));
            setFriends(prev => [...prev, { _id: requestId, username, profilePhoto: null }]);
            setStats(prev => prev.map(s => s.label === 'Friends' ? { ...s, value: String(parseInt(s.value) + 1) } : s));
            CustomAlert.success('Success', `You are now friends with ${username}`);
        } catch (error: any) {
            CustomAlert.error('Friend Limit Reached', error?.response?.data?.msg || 'Failed to accept friend request');
        }
    };

    const handleDeclineRequest = async (requestId: string, username: string) => {
        if (!user?._id) return;

        CustomAlert.show({
            type: 'confirm',
            title: 'Decline Request',
            message: `Are you sure you want to decline the friend request from ${username}?`,
            buttons: [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Decline',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await userAPI.ignoreFriendRequest(user._id, requestId);
                            setReceivedRequests(prev => prev.filter(r => r._id !== requestId));
                            CustomAlert.success('Success', 'Friend request declined');
                        } catch (error) {
                            CustomAlert.error('Error', 'Failed to decline friend request');
                        }
                    }
                }
            ],
            dismissable: true
        });
    };

    const renderHeader = () => {
        return (
            <ThemedView style={styles.container}>
                <View style={styles.coverPhotoContainer}>
                    {user?.coverPhoto ? (
                        <Image source={{ uri: getImageUrl(user.coverPhoto) }} style={styles.coverPhoto} />
                    ) : (
                        <LinearGradient colors={[primaryColor + '20', primaryColor + '10']} style={styles.coverPhotoPlaceholder} />
                    )}
                    <TouchableOpacity style={styles.coverPhotoEditButton} onPress={handleCoverPhotoUpload}>
                        <IconSymbol name="camera" size={20} color={white} />
                    </TouchableOpacity>
                    
                    {/* Profile Photo Overlapping Cover Photo */}
                    <View style={styles.avatarWrapperAbsolute}>
                        <TouchableOpacity 
                            onPress={() => {
                                const profilePhotoUrl: string | null = user?.profilePhoto ? getImageUrl(user.profilePhoto) ?? null : null;
                                setSelectedImage(profilePhotoUrl);
                            }}
                            onLongPress={handleProfilePhotoUpload}
                            delayLongPress={500}
                        >
                            {user?.profilePhoto ? (
                                <Image 
                                    source={{ uri: getImageUrl(user?.profilePhoto) }} 
                                    style={[styles.avatarImage, { borderColor: primaryColor }]} 
                                    resizeMode="cover"
                                />
                            ) : (
                                <View style={[styles.avatarPlaceholder, { borderColor: primaryColor, backgroundColor: cardBackgroundColor }]}>
                                    <IconSymbol name="person.fill" size={sizes.iconXLarge} color={lightTextColor} />
                                </View>
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.editBadge, { backgroundColor: primaryColor, borderColor: white }]}
                            onPress={handleProfilePhotoUpload}
                        >
                            <IconSymbol name="camera" size={18} color={white} />
                        </TouchableOpacity>
                    </View>
                </View>
                
                <View style={styles.headerContent}>
                    <ThemedText type="heading2" style={{ fontFamily: typography.families.bold }}>{user?.username}</ThemedText>
                    <ThemedText style={{ color: lightTextColor, marginBottom: spacing.md }}>{user?.bio}</ThemedText>

                    <View style={styles.profileDetails}>
                        {user?.location && user.location.trim() && (
                            <View style={styles.detailRow}>
                                <IconSymbol name="location" size={16} color={lightTextColor} />
                                <ThemedText style={{ color: lightTextColor, fontSize: typography.sizes.body2 }}>{user.location}</ThemedText>
                            </View>
                        )}
                        {user?.gender && (
                            <View style={styles.detailRow}>
                                <IconSymbol name="person.fill" size={16} color={lightTextColor} />
                                <ThemedText style={{ color: lightTextColor, fontSize: typography.sizes.body2, textTransform: 'capitalize' }}>{user.gender}</ThemedText>
                            </View>
                        )}
                        {user?.birthYear && (
                            <View style={styles.detailRow}>
                                <IconSymbol name="calendar" size={16} color={lightTextColor} />
                                <ThemedText style={{ color: lightTextColor, fontSize: typography.sizes.body2 }}>{new Date().getFullYear() - user.birthYear} years old</ThemedText>
                            </View>
                        )}
                        {user?.interests && user.interests.length > 0 && (
                            <View style={[styles.detailRow, { alignItems: 'flex-start' }]}>
                                <IconSymbol name="star.fill" size={16} color={lightTextColor} style={{ marginTop: spacing.xxs }} />
                                <View style={styles.interestChips}>
                                    {user.interests.map((interest: string, index: number) => (
                                        <View key={index} style={[styles.interestChip, { backgroundColor: primaryColor }]}>
                                            <ThemedText style={[styles.interestChipText, { color: white }]}>{interest}</ThemedText>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}
                    </View>

                    <View style={[styles.statsBar, { backgroundColor: cardBackgroundColor, borderColor }]}>
                        {stats.map((stat, i) => (
                            <View key={i} style={[styles.statBox, i !== stats.length - 1 && { borderRightColor: borderColor }]}>
                                <ThemedText type="title" style={{ fontFamily: typography.families.bold, color: primaryColor }}>{stat.value}</ThemedText>
                                <ThemedText style={{ color: lightTextColor }}>{stat.label}</ThemedText>
                            </View>
                        ))}
                    </View>

                    <View style={styles.actionRow}>
                        {activeTab === 'album' ? (
                            <TouchableOpacity style={[styles.btnPrimary, { backgroundColor: primaryColor }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); handleAddPhotoToAlbum(); }}>
                                <ThemedText style={{ color: white, fontFamily: typography.families.bold }}>Add Photo</ThemedText>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity style={[styles.btnPrimary, { backgroundColor: primaryColor }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setIsEditModalVisible(true); }}>
                                <ThemedText style={{ color: white, fontFamily: typography.families.bold }}>Edit Profile</ThemedText>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity style={[styles.btnSecondary, { borderColor }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/chat/favorites'); }}>
                            <IconSymbol name="heart.fill" size={sizes.actionIconSize} color={textColor} />
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.btnSecondary, { borderColor }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/settings'); }}>
                            <IconSymbol name="settings" size={sizes.actionIconSize} color={textColor} />
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.btnSecondary, { borderColor }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); logout(); }}>
                            <IconSymbol name="logout" size={sizes.actionIconSize} color={textColor} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Tabs */}
                <View style={[styles.tabsContainer, { borderBottomColor: borderColor }]}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'posts' && { borderBottomColor: primaryColor }]}
                        onPress={() => { Haptics.selectionAsync(); setActiveTab('posts'); }}
                    >
                        <IconSymbol name="grid" size={20} color={activeTab === 'posts' ? primaryColor : lightTextColor} />
                        <ThemedText style={[styles.tabText, { color: activeTab === 'posts' ? primaryColor : lightTextColor }]}>Posts</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'friends' && { borderBottomColor: primaryColor }]}
                        onPress={() => { Haptics.selectionAsync(); setActiveTab('friends'); }}
                    >
                        <IconSymbol name="person.2.fill" size={20} color={activeTab === 'friends' ? primaryColor : lightTextColor} />
                        <ThemedText style={[styles.tabText, { color: activeTab === 'friends' ? primaryColor : lightTextColor }]}>Friends</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'album' && { borderBottomColor: primaryColor }]}
                        onPress={() => { Haptics.selectionAsync(); setActiveTab('album'); }}
                    >
                        <IconSymbol name="photo.fill" size={20} color={activeTab === 'album' ? primaryColor : lightTextColor} />
                        <ThemedText style={[styles.tabText, { color: activeTab === 'album' ? primaryColor : lightTextColor }]}>Album</ThemedText>
                    </TouchableOpacity>
                </View>

                {/* Friend Request Sub-tabs */}
                {activeTab === 'friends' && (
                    <View style={[styles.friendSubTabs, { borderBottomColor: borderColor }]}>
                        <TouchableOpacity
                            style={[styles.subTab, friendRequestTab === 'friends' && { borderBottomColor: primaryColor }]}
                            onPress={() => { Haptics.selectionAsync(); setFriendRequestTab('friends'); }}
                        >
                            <ThemedText style={[styles.subTabText, { color: friendRequestTab === 'friends' ? primaryColor : lightTextColor }]}>Friends ({friends.length})</ThemedText>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.subTab, friendRequestTab === 'sent' && { borderBottomColor: primaryColor }]}
                            onPress={() => { Haptics.selectionAsync(); setFriendRequestTab('sent'); }}
                        >
                            <ThemedText style={[styles.subTabText, { color: friendRequestTab === 'sent' ? primaryColor : lightTextColor }]}>Sent ({sentRequests.length})</ThemedText>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.subTab, friendRequestTab === 'received' && { borderBottomColor: primaryColor }]}
                            onPress={() => { Haptics.selectionAsync(); setFriendRequestTab('received'); }}
                        >
                            <ThemedText style={[styles.subTabText, { color: friendRequestTab === 'received' ? primaryColor : lightTextColor }]}>Received ({receivedRequests.length})</ThemedText>
                        </TouchableOpacity>
                    </View>
                )}
            </ThemedView>
        );
    };

    const getData = () => {
        if (activeTab === 'posts') {
            return userPosts.length > 0 ? userPosts : [{ type: 'empty' }];
        } else if (activeTab === 'friends') {
            if (friendRequestTab === 'friends') {
                return friends.length > 0 ? friends : [{ type: 'empty' }];
            } else if (friendRequestTab === 'sent') {
                return sentRequests.length > 0 ? sentRequests : [{ type: 'empty' }];
            } else {
                return receivedRequests.length > 0 ? receivedRequests : [{ type: 'empty' }];
            }
        } else {
            return album.length > 0 ? album : [{ type: 'empty' }];
        }
    };

    const renderItem = ({ item }: { item: any }) => {
        if (item.type === 'empty') {
            if (activeTab === 'posts') {
                return (
                    <View style={styles.emptyContainer}>
                        <IconSymbol name="camera" size={48} color={lightTextColor} />
                        <ThemedText style={[styles.emptyText, { color: textColor }]}>No posts yet</ThemedText>
                        <ThemedText style={[styles.emptySubtext, { color: lightTextColor }]}>Share your first post!</ThemedText>
                    </View>
                );
            } else if (activeTab === 'friends') {
                if (friendRequestTab === 'friends') {
                    return (
                        <View style={styles.emptyContainer}>
                            <IconSymbol name="person.2" size={48} color={lightTextColor} />
                            <ThemedText style={[styles.emptyText, { color: textColor }]}>No friends yet</ThemedText>
                            <ThemedText style={[styles.emptySubtext, { color: lightTextColor }]}>Start connecting with people!</ThemedText>
                        </View>
                    );
                } else if (friendRequestTab === 'sent') {
                    return (
                        <View style={styles.emptyContainer}>
                            <IconSymbol name="paperplane" size={48} color={lightTextColor} />
                            <ThemedText style={[styles.emptyText, { color: textColor }]}>No sent requests</ThemedText>
                            <ThemedText style={[styles.emptySubtext, { color: lightTextColor }]}>Send friend requests to connect!</ThemedText>
                        </View>
                    );
                } else {
                    return (
                        <View style={styles.emptyContainer}>
                            <IconSymbol name="person.badge.plus" size={48} color={lightTextColor} />
                            <ThemedText style={[styles.emptyText, { color: textColor }]}>No received requests</ThemedText>
                            <ThemedText style={[styles.emptySubtext, { color: lightTextColor }]}>When someone sends you a request, it will appear here!</ThemedText>
                        </View>
                    );
                }
            } else {
                return (
                    <View style={styles.emptyContainer}>
                        <IconSymbol name="photo" size={48} color={lightTextColor} />
                        <ThemedText style={[styles.emptyText, { color: textColor }]}>Empty Album</ThemedText>
                        <TouchableOpacity onPress={handleAddPhotoToAlbum} style={{ marginTop: spacing.md }}>
                            <ThemedText style={{ color: primaryColor, fontFamily: typography.families.bold }}>Add your first photo</ThemedText>
                        </TouchableOpacity>
                    </View>
                );
            }
        }

        if (activeTab === 'posts') {
            return (
                <TouchableOpacity style={[styles.postItem, { borderColor }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/post/${item._id}`); }}>
                    <Image source={{ uri: getImageUrl(item.images?.[0] || item.image) }} style={styles.postThumbnail} />
                    <View style={styles.postOverlay}>
                        <View style={styles.postStats}>
                            <View style={styles.stat}>
                                <IconSymbol name="heart.fill" size={16} color={white} />
                                <ThemedText style={[styles.statText, { color: white }]}>{item.likes?.length || 0}</ThemedText>
                            </View>
                            <View style={styles.stat}>
                                <IconSymbol name="message.fill" size={16} color={white} />
                                <ThemedText style={[styles.statText, { color: white }]}>{item.comments?.length || 0}</ThemedText>
                            </View>
                        </View>
                    </View>
                </TouchableOpacity>
            );
        } else if (activeTab === 'friends') {
            // Handle sent requests
            if (friendRequestTab === 'sent') {
                return (
                    <View style={[styles.friendItem, { backgroundColor: cardBackgroundColor, borderColor }]}>
                        {item.profilePhoto ? (
                            <Image source={{ uri: getImageUrl(item.profilePhoto) }} style={styles.friendAvatar} />
                        ) : (
                            <View style={[styles.friendAvatar, { backgroundColor: cardBackgroundColor, justifyContent: 'center', alignItems: 'center', borderWidth: sizes.dividerWidth, borderColor: borderColor }]}>
                                <IconSymbol name="person.fill" size={sizes.iconLarge} color={lightTextColor} />
                            </View>
                        )}
                        <View style={styles.friendInfo}>
                            <ThemedText style={{ fontFamily: typography.families.bold, fontSize: typography.sizes.body1 }}>{item.username}</ThemedText>
                            <ThemedText style={{ color: lightTextColor, fontSize: typography.sizes.caption }}>Request sent</ThemedText>
                        </View>
                        <TouchableOpacity 
                            style={[styles.cancelBtn, { backgroundColor: errorColor || '#FF3B30' }]} 
                            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); handleCancelRequest(item._id || item.recipient?._id || item.recipient, item.username || item.recipient?.username || 'User'); }}
                        >
                            <ThemedText style={{ color: white, fontSize: typography.sizes.caption, fontFamily: typography.families.medium }}>Cancel</ThemedText>
                        </TouchableOpacity>
                    </View>
                );
            }
            // Handle received requests
            if (friendRequestTab === 'received') {
                return (
                    <View style={[styles.friendItem, { backgroundColor: cardBackgroundColor, borderColor }]}>
                        {item.profilePhoto ? (
                            <Image source={{ uri: getImageUrl(item.profilePhoto) }} style={styles.friendAvatar} />
                        ) : (
                            <View style={[styles.friendAvatar, { backgroundColor: cardBackgroundColor, justifyContent: 'center', alignItems: 'center', borderWidth: sizes.dividerWidth, borderColor: borderColor }]}>
                                <IconSymbol name="person.fill" size={sizes.iconLarge} color={lightTextColor} />
                            </View>
                        )}
                        <View style={styles.friendInfo}>
                            <ThemedText style={{ fontFamily: typography.families.bold, fontSize: typography.sizes.body1 }}>{item.username || item.sender?.username || 'User'}</ThemedText>
                            <ThemedText style={{ color: lightTextColor, fontSize: typography.sizes.caption }}>Wants to connect</ThemedText>
                        </View>
                        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                            <TouchableOpacity 
                                style={[styles.acceptBtn, { backgroundColor: primaryColor }]} 
                                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); handleAcceptRequest(item._id || item.sender?._id || item.sender, item.username || item.sender?.username || 'User'); }}
                            >
                                <IconSymbol name="checkmark" size={18} color={white} />
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.declineBtn, { backgroundColor: errorColor || '#FF3B30' }]} 
                                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); handleDeclineRequest(item._id || item.sender?._id || item.sender, item.username || item.sender?.username || 'User'); }}
                            >
                                <IconSymbol name="xmark" size={18} color={white} />
                            </TouchableOpacity>
                        </View>
                    </View>
                );
            }
            // Handle friends list
            return (
                <TouchableOpacity 
                    style={[styles.friendItem, { backgroundColor: cardBackgroundColor, borderColor }]}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/user/${item._id}`); }}
                >
                    {item.profilePhoto ? (
                        <Image source={{ uri: getImageUrl(item.profilePhoto) }} style={styles.friendAvatar} />
                    ) : (
                        <View style={[styles.friendAvatar, { backgroundColor: cardBackgroundColor, justifyContent: 'center', alignItems: 'center', borderWidth: sizes.dividerWidth, borderColor: borderColor }]}>
                            <IconSymbol name="person.fill" size={sizes.iconLarge} color={lightTextColor} />
                        </View>
                    )}
                    <View style={styles.friendInfo}>
                        <ThemedText style={{ fontFamily: typography.families.bold, fontSize: typography.sizes.body1 }}>{item.username}</ThemedText>
                        <ThemedText style={{ color: lightTextColor, fontSize: typography.sizes.caption }}>{item.bio || 'No bio'}</ThemedText>
                    </View>
                    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                        <TouchableOpacity style={[styles.messageBtn, { backgroundColor: primaryColor }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); handleMessage(item._id); }}>
                            <IconSymbol name="message.fill" size={20} color={white} />
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.messageBtn, { backgroundColor: errorColor || '#FF3B30' }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); handleUnfriend(item._id, item.username); }}>
                            <IconSymbol name="person.remove" size={18} color={white} />
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.messageBtn, { backgroundColor: '#8E8E93' }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); handleBlock(item._id, item.username); }}>
                            <IconSymbol name="person.slash" size={18} color={white} />
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            );
        } else {
            return (
                <TouchableOpacity 
                    style={[styles.postItem, { borderColor }]} 
                    onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); handleDeleteAlbumPhoto(item._id); }}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedImage(getImageUrl(item.image) ?? null); setSelectedPhotoId(item._id); }}
                >
                    <Image source={{ uri: getImageUrl(item.image) }} style={styles.postThumbnail} />
                </TouchableOpacity>
            );
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor }}>
            {loading ? (
                <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
                    <SkeletonProfile />
                    <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
                        <SkeletonGrid columns={3} rows={4} itemHeight={100} />
                    </View>
                </ScrollView>
            ) : (
                <FlatList
                    data={getData()}
                    renderItem={renderItem}
                    keyExtractor={(item, index) => item._id || `empty-${index}`}
                    ListHeaderComponent={renderHeader}
                    key={activeTab}
                    numColumns={activeTab === 'friends' ? 1 : 3}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={activeTab === 'posts' ? styles.postsGrid : styles.friendsList}
                />
            )}
            <EditProfileModal visible={isEditModalVisible} onClose={() => setIsEditModalVisible(false)} onSave={handleEditProfile} initialData={user} />
            <ImageViewerModal 
                visible={!!selectedImage} 
                onClose={() => { setSelectedImage(null); setSelectedPhotoId(null); }} 
                imageUrl={selectedImage} 
                onDelete={selectedPhotoId ? () => handleDeleteAlbumPhoto(selectedPhotoId) : null} 
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    coverPhotoContainer: { width: '100%', height: verticalScale(180), position: 'relative' },
    coverPhoto: { width: '100%', height: '100%', resizeMode: 'cover' },
    avatarWrapperAbsolute: { 
        position: 'absolute', 
        bottom: -sizes.profilePhoto / 2, 
        left: '50%', 
        transform: [{ translateX: -sizes.profilePhoto / 2 }], 
        ...shadows.lg 
    },
    coverPhotoPlaceholder: { width: '100%', height: '100%' },
    coverPhotoEditButton: { position: 'absolute', bottom: spacing.md, right: spacing.md, width: sizes.iconLarge, height: sizes.iconLarge, borderRadius: sizes.iconLarge / 2, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    headerBackground: { position: 'absolute', top: 0, left: 0, right: 0, height: verticalScale(200) },
    headerContent: { alignItems: 'center', paddingTop: sizes.profilePhoto / 2 + spacing.lg, paddingHorizontal: spacing.xl },
    avatarWrapper: { marginBottom: spacing.md, ...shadows.lg },
    avatarImage: { width: sizes.profilePhoto, height: sizes.profilePhoto, borderRadius: sizes.profilePhoto / 2, borderWidth: sizes.borderWidth },
    avatarPlaceholder: { width: sizes.profilePhoto, height: sizes.profilePhoto, borderRadius: sizes.profilePhoto / 2, borderWidth: sizes.borderWidth, justifyContent: 'center', alignItems: 'center', backgroundColor: '#E0E0E0' },
    editBadge: { position: 'absolute', bottom: spacing.xs, right: spacing.xs, width: sizes.iconMedium, height: sizes.iconMedium, borderRadius: sizes.iconMedium / 2, borderWidth: sizes.borderWidth, justifyContent: 'center', alignItems: 'center' },
    profileDetails: { gap: spacing.xs, marginBottom: spacing.md },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    interestChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, flex: 1 },
    interestChip: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xxs,
        borderRadius: borderRadius.lg,
    },
    interestChipText: { fontSize: typography.sizes.caption, fontFamily: typography.families.medium },
    statsBar: { flexDirection: 'row', borderRadius: borderRadius.lg, padding: spacing.md, width: '100%', marginBottom: spacing.lg, borderWidth: sizes.dividerWidth },
    statBox: { flex: 1, alignItems: 'center', borderRightWidth: sizes.dividerWidth },
    actionRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
    btnPrimary: { flex: 1, height: sizes.buttonHeight, borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center' },
    btnSecondary: { width: sizes.actionIcon, height: sizes.actionIcon, borderRadius: borderRadius.md, borderWidth: sizes.dividerWidth, justifyContent: 'center', alignItems: 'center' },
    tabsContainer: { flexDirection: 'row', borderBottomWidth: sizes.dividerWidth, marginBottom: spacing.md },
    tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md, borderBottomWidth: sizes.borderWidth, borderBottomColor: 'transparent', gap: spacing.sm },
    tabText: { fontSize: typography.sizes.body2, fontFamily: typography.families.medium },
    friendSubTabs: { flexDirection: 'row', borderBottomWidth: sizes.dividerWidth, marginBottom: spacing.sm, marginHorizontal: spacing.md },
    subTab: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderBottomWidth: sizes.borderWidth, borderBottomColor: 'transparent' },
    subTabText: { fontSize: typography.sizes.caption, fontFamily: typography.families.medium },
    postsGrid: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
    postItem: { flex: 1/3, aspectRatio: 1, margin: spacing.xxs, borderRadius: borderRadius.sm, overflow: 'hidden', borderWidth: sizes.dividerWidth },
    postThumbnail: { width: '100%', height: '100%' },
    postOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', padding: spacing.sm },
    postStats: { flexDirection: 'row', justifyContent: 'space-between' },
    stat: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    statText: { fontSize: typography.sizes.caption, fontFamily: typography.families.bold },
    friendsList: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
    friendItem: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, marginBottom: spacing.sm, borderRadius: borderRadius.md, borderWidth: sizes.dividerWidth },
    friendTouchable: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    friendAvatar: { width: sizes.iconLarge + 4, height: sizes.iconLarge + 4, borderRadius: (sizes.iconLarge + 4) / 2, marginRight: spacing.md },
    friendInfo: { flex: 1 },
    messageBtn: { width: sizes.iconLarge, height: sizes.iconLarge, borderRadius: sizes.iconLarge / 2, justifyContent: 'center', alignItems: 'center' },
    cancelBtn: { paddingHorizontal: spacing.md, height: verticalScale(36), borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center' },
    acceptBtn: { width: sizes.iconMedium, height: sizes.iconMedium, borderRadius: sizes.iconMedium / 2, justifyContent: 'center', alignItems: 'center' },
    declineBtn: { width: sizes.iconMedium, height: sizes.iconMedium, borderRadius: sizes.iconMedium / 2, justifyContent: 'center', alignItems: 'center' },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 50 },
    emptyText: { marginTop: spacing.md, fontSize: typography.sizes.title, fontFamily: typography.families.bold },
    emptySubtext: { marginTop: spacing.xs, fontSize: typography.sizes.body2, textAlign: 'center', opacity: 0.6 },
});
