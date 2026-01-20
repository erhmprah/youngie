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
import { userAPI, postAPI, chatAPI, getImageUrl } from '@/utils/api';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { spacing, typography, borderRadius, shadows } from '@/constants/design-tokens';
import { ImageViewerModal } from '@/components/image-viewer-modal';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

export default function ProfileScreen() {
    const [activeTab, setActiveTab] = useState('posts');
    const [favoritedPosts, setFavoritedPosts] = useState<any[]>([]);
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [stats, setStats] = useState([
        { label: 'Posts', value: '0' },
        { label: 'Friends', value: '0' },
        { label: 'Matches', value: '0' },
    ]);
    const [userPosts, setUserPosts] = useState<any[]>([]);
    const [friends, setFriends] = useState<any[]>([]);
    const [album, setAlbum] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const { user, logout, updateUser } = useAuth();
    const router = useRouter();

    const backgroundColor = useThemeColor('background');
    const primaryColor = useThemeColor('primary');
    const textColor = useThemeColor('text');
    const lightTextColor = useThemeColor('lightText');
    const cardBackgroundColor = useThemeColor('surface');
    const borderColor = useThemeColor('border');
    const white = useThemeColor('white');
    const errorColor = useThemeColor('error');

    const fetchProfileData = useCallback(async () => {
        if (!user?._id) return;
        setLoading(true);
        try {
            const [statsResponse, postsResponse, albumResponse] = await Promise.all([
                userAPI.getProfile(user._id),
                postAPI.getUserPosts(user._id),
                userAPI.getAlbum(user._id).catch(() => ({ data: [] })),
            ]);
            const userData = statsResponse.data;
            const postsData = Array.isArray(postsResponse.data) ? postsResponse.data : [];
            const totalLikes = postsData.reduce((sum: number, post: any) => sum + (post.likes?.length || 0), 0);
            setStats([
                { label: 'Posts', value: String(userData.posts?.length || 0) },
                { label: 'Friends', value: String(userData.friends?.length || 0) },
                { label: 'Likes', value: String(totalLikes) },
            ]);
            setFriends(userData.friends || []);
            setUserPosts(postsData);
            setAlbum(albumResponse.data || []);
        } catch (error: any) {
            console.error('Error fetching profile data:', error);
            if (error.response?.status === 401) {
                try {
                    await logout();

                } catch (logoutErr) {

                    console.error('Error during logout:', logoutErr);

                }

                Alert.alert('Session Expired', 'Please log in again');

            } else {

                Alert.alert('Error', 'Failed to load profile data');

            }

        } finally {
            setLoading(false);
        }
    }, [user?._id]);

    useFocusEffect(
        useCallback(() => {
            fetchProfileData();
        }, [fetchProfileData])
    );

    const handleEditProfile = async (profileData: any) => {
        if (!user?._id) return;
        try {
            await userAPI.updateProfile(user._id, profileData);
            updateUser(profileData);
            setIsEditModalVisible(false);
            Alert.alert('Success', 'Profile updated successfully');
            fetchProfileData();
        } catch (error: any) {
            console.error('Error updating profile:', error);
            Alert.alert('Error', error.response?.data?.msg || 'Failed to update profile');
        }
    };

    const handleProfilePhotoUpload = async () => {
        if (!user?._id) return;
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
                const response = await userAPI.uploadProfilePhotoBase64(user._id, {
                    imageData: `data:image/jpeg;base64,${base64}`,
                    filename
                }) as any;
                if (response.profilePhoto) {
                    updateUser({ profilePhoto: response.profilePhoto });
                    Alert.alert('Success', 'Profile photo updated successfully');
                    fetchProfileData();
                }
            } catch (error) {
                console.error('Profile photo upload error:', error);
                Alert.alert('Error', 'Failed to upload profile photo');
            }
        }
    };

    const handleAddPhotoToAlbum = async () => {
        if (!user?._id) return;
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
                await userAPI.uploadAlbumPhoto(user._id, {
                    imageData: `data:image/jpeg;base64,${base64}`,
                    filename
                });
                Alert.alert('Success', 'Photo added to album');
                fetchProfileData();
            } catch (error) {
                console.error('Album upload error:', error);
                Alert.alert('Error', 'Failed to upload photo');
            }
        }
    };

    const handleDeleteAlbumPhoto = async (photoId: string) => {
        if (!user?._id) return;
        Alert.alert('Delete Photo', 'Are you sure you want to delete this photo?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await userAPI.deleteAlbumPhoto(user._id, photoId);
                        setAlbum(prev => prev.filter(p => p._id !== photoId));
                    } catch (error) {
                        Alert.alert('Error', 'Failed to delete photo');
                    }
                }
            }
        ]);
    };

    const handleMessage = async (friendId: string) => {
        if (!user?._id) return;
        try {
            const response = await chatAPI.getUserChats(user._id);
            const chats = response.data;
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
            console.error('Error handling message:', error);
            Alert.alert('Error', 'Failed to open chat');
        }
    };

    const handleUnfriend = async (friendId: string, username: string) => {
        if (!user?._id) return;

        Alert.alert(
            'Unfriend',
            `Are you sure you want to remove ${username} as a friend?`,
            [
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
                            console.error('Error unfriending:', error);
                            Alert.alert('Error', 'Failed to unfriend user');
                        }
                    }
                }
            ]
        );
    };

    const handleBlock = async (friendId: string, username: string) => {
        if (!user?._id) return;

        Alert.alert(
            'Block User',
            `Are you sure you want to block ${username}? This will remove them from your friends and prevent them from contacting you.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Block',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await userAPI.blockUser(user._id, friendId);
                            setFriends(prev => prev.filter(f => f._id !== friendId));
                            setStats(prev => prev.map(s => s.label === 'Friends' ? { ...s, value: String(Math.max(0, parseInt(s.value) - 1)) } : s));
                            Alert.alert('Success', `${username} has been blocked`);
                        } catch (error) {
                            console.error('Error blocking user:', error);
                            Alert.alert('Error', 'Failed to block user');
                        }
                    }
                }
            ]
        );
    };

    const renderHeader = () => (
        <ThemedView style={styles.container}>
            <LinearGradient colors={[primaryColor + '20', 'transparent']} style={styles.headerBackground} />
            <View style={styles.headerContent}>
                <View style={styles.avatarWrapper}>
                    <TouchableOpacity onPress={handleProfilePhotoUpload}>
                        <Image source={{ uri: getImageUrl(user?.profilePhoto) }} style={[styles.avatarImage, { borderColor: primaryColor }]} />
                        <View style={[styles.editBadge, { backgroundColor: primaryColor, borderColor: white }]}>
                            <IconSymbol name="camera" size={18} color={white} />
                        </View>
                    </TouchableOpacity>
                </View>
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
                        <View style={styles.detailRow}>
                            <IconSymbol name="star.fill" size={16} color={lightTextColor} />
                            <ThemedText style={{ color: lightTextColor, fontSize: typography.sizes.body2 }}>{user.interests.join(', ')}</ThemedText>
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
                        <IconSymbol name="heart.fill" size={20} color={textColor} />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.btnSecondary, { borderColor }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/settings'); }}>
                        <IconSymbol name="settings" size={20} color={textColor} />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.btnSecondary, { borderColor }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); logout(); }}>
                        <IconSymbol name="logout" size={20} color={textColor} />
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
        </ThemedView>
    );

    const getData = () => {
        if (activeTab === 'posts') {
            return userPosts.length > 0 ? userPosts : [{ type: 'empty' }];
        } else if (activeTab === 'friends') {
            return friends.length > 0 ? friends : [{ type: 'empty' }];
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
                return (
                    <View style={styles.emptyContainer}>
                        <IconSymbol name="person.2" size={48} color={lightTextColor} />
                        <ThemedText style={[styles.emptyText, { color: textColor }]}>No friends yet</ThemedText>
                        <ThemedText style={[styles.emptySubtext, { color: lightTextColor }]}>Start connecting with people!</ThemedText>
                    </View>
                );
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
                <TouchableOpacity style={[styles.postItem, { borderColor }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push({ pathname: '/', params: { postId: item._id } }); }}>
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
            return (
                <TouchableOpacity 
                    style={[styles.friendItem, { backgroundColor: cardBackgroundColor, borderColor }]}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/user/${item._id}`); }}
                >
                    {item.profilePhoto ? (
                        <Image source={{ uri: getImageUrl(item.profilePhoto) }} style={styles.friendAvatar} />
                    ) : (
                        <View style={[styles.friendAvatar, { backgroundColor: cardBackgroundColor, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: borderColor }]}>
                            <IconSymbol name="person.fill" size={24} color={lightTextColor} />
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
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedImage(getImageUrl(item.image) || null); }}
                >
                    <Image source={{ uri: getImageUrl(item.image) }} style={styles.postThumbnail} />
                </TouchableOpacity>
            );
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor }}>
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
            <EditProfileModal visible={isEditModalVisible} onClose={() => setIsEditModalVisible(false)} onSave={handleEditProfile} initialData={user} />
            <ImageViewerModal visible={!!selectedImage} onClose={() => setSelectedImage(null)} imageUrl={selectedImage} />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    headerBackground: { position: 'absolute', top: 0, left: 0, right: 0, height: 200 },
    headerContent: { alignItems: 'center', paddingTop: 40, paddingHorizontal: spacing.xl },
    avatarWrapper: { marginBottom: spacing.md, ...shadows.lg },
    avatarImage: { width: 120, height: 120, borderRadius: 60, borderWidth: 4 },
    editBadge: { position: 'absolute', bottom: 5, right: 5, width: 32, height: 32, borderRadius: 16, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
    profileDetails: { gap: spacing.xs, marginBottom: spacing.md },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    statsBar: { flexDirection: 'row', borderRadius: borderRadius.lg, padding: spacing.md, width: '100%', marginBottom: spacing.lg, borderWidth: 1 },
    statBox: { flex: 1, alignItems: 'center', borderRightWidth: 1 },
    actionRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
    btnPrimary: { flex: 1, height: 48, borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center' },
    btnSecondary: { width: 48, height: 48, borderRadius: borderRadius.md, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
    tabsContainer: { flexDirection: 'row', borderBottomWidth: 1, marginBottom: spacing.md },
    tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md, borderBottomWidth: 2, borderBottomColor: 'transparent', gap: spacing.sm },
    tabText: { fontSize: typography.sizes.body2, fontFamily: typography.families.medium },
    postsGrid: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
    postItem: { flex: 1/3, aspectRatio: 1, margin: 1, borderRadius: borderRadius.sm, overflow: 'hidden', borderWidth: 1 },
    postThumbnail: { width: '100%', height: '100%' },
    postOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', padding: spacing.sm },
    postStats: { flexDirection: 'row', justifyContent: 'space-between' },
    stat: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    statText: { fontSize: typography.sizes.caption, fontFamily: typography.families.bold },
    friendsList: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
    friendItem: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, marginBottom: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1 },
    friendTouchable: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    friendAvatar: { width: 50, height: 50, borderRadius: 25, marginRight: spacing.md },
    friendInfo: { flex: 1 },
    messageBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 50 },
    emptyText: { marginTop: spacing.md, fontSize: typography.sizes.title, fontFamily: typography.families.bold },
    emptySubtext: { marginTop: spacing.xs, fontSize: typography.sizes.body2, textAlign: 'center', opacity: 0.6 },
});
