import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, TouchableOpacity, FlatList, ActivityIndicator, Alert, Image, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeColor } from '@/hooks/use-theme-color';
import { userAPI, postAPI, chatAPI, getImageUrl } from '@/utils/api';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { spacing, typography, borderRadius, shadows } from '@/constants/design-tokens';
import { ImageViewerModal } from '@/components/image-viewer-modal';

const { width } = Dimensions.get('window');

export default function UserProfileScreen() {
    const { id } = useLocalSearchParams();
    const { user: currentUser } = useAuth();
    const router = useRouter();

    const [userProfile, setUserProfile] = useState<any>(null);
    const [userPosts, setUserPosts] = useState<any[]>([]);
    const [userAlbum, setUserAlbum] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFriend, setIsFriend] = useState(false);
    const [activeTab, setActiveTab] = useState('posts');
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    const backgroundColor = useThemeColor('background');
    const primaryColor = useThemeColor('primary');
    const textColor = useThemeColor('text');
    const lightTextColor = useThemeColor('lightText');
    const cardBackgroundColor = useThemeColor('surface');
    const borderColor = useThemeColor('border');
    const white = useThemeColor('white');

    const fetchData = useCallback(async () => {
        if (!id || !currentUser?._id) return;
        setLoading(true);
        try {
            // Fetch target user profile, their posts, and current user's profile (to check friends list)
            const [profileResponse, postsResponse, albumResponse, currentUserResponse] = await Promise.all([
                userAPI.getProfile(id as string),
                postAPI.getUserPosts(id as string),
                userAPI.getAlbum(id as string).catch(() => ({ data: [] })),
                userAPI.getProfile(currentUser._id)
            ]);

            setUserProfile(profileResponse.data);
            setUserPosts(postsResponse.data);
            setUserAlbum(albumResponse.data || []);
            
            // Check friendship status using current user's up-to-date friend list
            const myFriends = currentUserResponse.data.friends || [];
            const isFriendStatus = myFriends.some((f: any) => 
                (typeof f === 'string' ? f : f._id) === id
            );
            setIsFriend(isFriendStatus);

        } catch (error) {
            console.error('Error fetching user profile:', error);
            Alert.alert('Error', 'Failed to load profile');
            router.back();
        } finally {
            setLoading(false);
        }
    }, [id, currentUser?._id, router]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleAddFriend = async () => {
        if (!currentUser?._id || !id) return;
        try {
            await userAPI.sendFriendRequest(currentUser._id, id as string);
            Alert.alert('Success', 'Friend request sent!');
        } catch (error: any) {
             if (error.response?.data?.msg === 'Friend request already sent') {
                 Alert.alert('Info', 'Friend request already sent.');
             } else {
                 Alert.alert('Error', error.response?.data?.msg || 'Failed to send friend request');
             }
        }
    };

    const handleUnfriend = async () => {
        if (!currentUser?._id || !id) return;
        
        Alert.alert(
            'Unfriend',
            `Are you sure you want to remove ${userProfile?.username} as a friend?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Unfriend',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await userAPI.unfriend(currentUser._id, id as string);
                            setIsFriend(false);
                            Alert.alert('Success', 'Friend removed');
                        } catch (error: any) {
                            console.error('Error unfriending:', error);
                            Alert.alert('Error', 'Failed to unfriend user');
                        }
                    }
                }
            ]
        );
    };

    const handleMessage = async () => {
        if (!currentUser?._id || !id) return;
        try {
            const response = await chatAPI.getUserChats(currentUser._id);
            const chats = response.data;
            const existingChat = chats.find((c: any) => 
                !c.isGroupChat && c.participants.some((p: any) => (p._id === id || p === id))
            );

            if (existingChat) {
                router.push(`/chat/${existingChat._id}`);
            } else {
                const newChatResponse = await chatAPI.createChat({
                    participants: [currentUser._id, id],
                    isGroupChat: false
                });
                router.push(`/chat/${newChatResponse.data._id}`);
            }
        } catch (error) {
            console.error('Error handling message:', error);
            Alert.alert('Error', 'Failed to open chat');
        }
    };

    const renderHeader = () => (
        <ThemedView style={styles.container}>
            <LinearGradient colors={[primaryColor + '20', 'transparent']} style={styles.headerBackground} />
            <View style={styles.headerContent}>
                <View style={styles.avatarWrapper}>
                    {userProfile?.profilePhoto ? (
                        <Image source={{ uri: getImageUrl(userProfile.profilePhoto) }} style={[styles.avatarImage, { borderColor: primaryColor }]} />
                    ) : (
                        <View style={[styles.avatarImage, { borderColor: primaryColor, backgroundColor: cardBackgroundColor, justifyContent: 'center', alignItems: 'center' }]}>
                            <IconSymbol name="person.fill" size={60} color={lightTextColor} />
                        </View>
                    )}
                </View>
                <ThemedText type="heading2" style={{ fontFamily: typography.families.bold }}>{userProfile?.username}</ThemedText>
                <ThemedText style={{ color: lightTextColor, marginBottom: spacing.md }}>{userProfile?.bio || 'No bio provided'}</ThemedText>

                <View style={[styles.statsBar, { backgroundColor: cardBackgroundColor, borderColor }]}>
                    <View style={[styles.statBox, { borderRightColor: borderColor }]}>
                        <ThemedText type="title" style={{ fontFamily: typography.families.bold, color: primaryColor }}>{userPosts.length}</ThemedText>
                        <ThemedText style={{ color: lightTextColor }}>Posts</ThemedText>
                    </View>
                    <View style={[styles.statBox, { borderRightColor: borderColor }]}>
                        <ThemedText type="title" style={{ fontFamily: typography.families.bold, color: primaryColor }}>{userProfile?.friends?.length || 0}</ThemedText>
                        <ThemedText style={{ color: lightTextColor }}>Friends</ThemedText>
                    </View>
                    <View style={styles.statBox}>
                        <ThemedText type="title" style={{ fontFamily: typography.families.bold, color: primaryColor }}>{userProfile?.matches?.length || 0}</ThemedText>
                        <ThemedText style={{ color: lightTextColor }}>Matches</ThemedText>
                    </View>
                </View>

                <View style={styles.actionRow}>
                    {isFriend ? (
                        <TouchableOpacity style={[styles.btnPrimary, { backgroundColor: cardBackgroundColor, borderWidth: 1, borderColor }]} onPress={handleUnfriend}>
                            <IconSymbol name="checkmark" size={20} color={textColor} />
                            <ThemedText style={{ color: textColor, fontFamily: typography.families.bold, marginLeft: spacing.xs }}>Friend</ThemedText>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity style={[styles.btnPrimary, { backgroundColor: primaryColor }]} onPress={handleAddFriend}>
                            <IconSymbol name="person.badge.plus" size={20} color={white} />
                            <ThemedText style={{ color: white, fontFamily: typography.families.bold, marginLeft: spacing.xs }}>Add Friend</ThemedText>
                        </TouchableOpacity>
                    )}
                    
                    <TouchableOpacity style={[styles.btnSecondary, { borderColor }]} onPress={handleMessage}>
                        <IconSymbol name="message.fill" size={20} color={textColor} />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={[styles.tabsContainer, { borderBottomColor: borderColor }]}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'posts' && { borderBottomColor: primaryColor }]}
                    onPress={() => setActiveTab('posts')}
                >
                    <IconSymbol name="grid" size={20} color={activeTab === 'posts' ? primaryColor : lightTextColor} />
                    <ThemedText style={[styles.tabText, { color: activeTab === 'posts' ? primaryColor : lightTextColor }]}>Posts</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'album' && { borderBottomColor: primaryColor }]}
                    onPress={() => setActiveTab('album')}
                >
                    <IconSymbol name="photo.fill" size={20} color={activeTab === 'album' ? primaryColor : lightTextColor} />
                    <ThemedText style={[styles.tabText, { color: activeTab === 'album' ? primaryColor : lightTextColor }]}>Album</ThemedText>
                </TouchableOpacity>
            </View>
        </ThemedView>
    );

    const renderItem = ({ item }: { item: any }) => {
        if (item.type === 'empty') {
            return (
                <View style={styles.emptyContainer}>
                    <IconSymbol name="camera" size={48} color={lightTextColor} />
                    <ThemedText style={[styles.emptyText, { color: textColor }]}>{activeTab === 'posts' ? 'No posts yet' : 'Empty Album'}</ThemedText>
                </View>
            );
        }

        if (activeTab === 'album') {
            return (
                <TouchableOpacity 
                    style={[styles.postItem, { borderColor }]}
                    onPress={() => setSelectedImage(getImageUrl(item.image) || null)}
                >
                    <Image source={{ uri: getImageUrl(item.image) }} style={styles.postThumbnail} />
                </TouchableOpacity>
            );
        }

        return (
            <TouchableOpacity style={[styles.postItem, { borderColor }]} onPress={() => router.push({ pathname: '/', params: { postId: item._id } })}>
                <Image source={{ uri: getImageUrl(item.image) }} style={styles.postThumbnail} />
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
    };

    if (loading) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={primaryColor} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor }}>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.navHeader}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <IconSymbol name="chevron.left" size={24} color={textColor} />
                </TouchableOpacity>
            </View>
            <FlatList
                data={activeTab === 'posts' ? (userPosts.length > 0 ? userPosts : [{ type: 'empty' }]) : (userAlbum.length > 0 ? userAlbum : [{ type: 'empty' }])}
                renderItem={renderItem}
                keyExtractor={(item, index) => item._id || `empty-${index}`}
                ListHeaderComponent={renderHeader}
                numColumns={3}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.postsGrid}
            />
            <ImageViewerModal visible={!!selectedImage} onClose={() => setSelectedImage(null)} imageUrl={selectedImage} />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    navHeader: { position: 'absolute', top: 10, left: 10, zIndex: 10 },
    backButton: { padding: spacing.sm, borderRadius: borderRadius.round, backgroundColor: 'rgba(0,0,0,0.1)' },
    headerBackground: { position: 'absolute', top: 0, left: 0, right: 0, height: 200 },
    headerContent: { alignItems: 'center', paddingTop: 40, paddingHorizontal: spacing.xl },
    avatarWrapper: { marginBottom: spacing.md, ...shadows.lg },
    avatarImage: { width: 120, height: 120, borderRadius: 60, borderWidth: 4 },
    statsBar: { flexDirection: 'row', borderRadius: borderRadius.lg, padding: spacing.md, width: '100%', marginBottom: spacing.lg, borderWidth: 1 },
    statBox: { flex: 1, alignItems: 'center', borderRightWidth: 1 },
    actionRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl, width: '100%' },
    btnPrimary: { flex: 1, height: 48, borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center', flexDirection: 'row' },
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
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 50 },
    emptyText: { marginTop: spacing.md, fontSize: typography.sizes.title, fontFamily: typography.families.bold },
});