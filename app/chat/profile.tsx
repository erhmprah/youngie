import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Image, TouchableOpacity, ScrollView, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/contexts/AuthContext';
import { userAPI, getImageUrl, postAPI } from '@/utils/api';
import { EditProfileModal } from '@/components/edit-profile-modal';
import { spacing, borderRadius, typography } from '@/constants/design-tokens';
import { CustomAlert } from '@/utils/alert';

export default function ProfileScreen() {
    const router = useRouter();
    const { user, logout } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState({ postsCount: 0, friendsCount: 0 });
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

    const backgroundColor = useThemeColor('background');
    const surfaceColor = useThemeColor('surface');
    const textColor = useThemeColor('text');
    const lightTextColor = useThemeColor('lightText');
    const primaryColor = useThemeColor('primary');
    const borderColor = useThemeColor('border');
    const dangerColor = useThemeColor('error');

    const fetchStats = useCallback(async () => {
        if (!user?._id) return;
        try {
            const [profileRes, postsRes] = await Promise.all([
                userAPI.getProfile(user._id),
                postAPI.getUserPosts(user._id)
            ]);
            
            setStats({
                postsCount: postsRes.data.length || 0,
                friendsCount: profileRes.data.friends?.length || 0
            });
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    }, [user?._id]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchStats();
        setRefreshing(false);
    };

     const handleUpdateProfile = async (data: any) => {
         if (!user?._id) return;
         try {
             await userAPI.updateProfile(user._id, data);
             CustomAlert.success('Success', 'Profile updated successfully');
             fetchStats();
         } catch (error) {
             throw error;
         }
     };

    const handlePickImage = async () => {
        try {
            // Request permission to access media library
         const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
         if (status !== 'granted') {
             CustomAlert.warning('Permission Required', 'Please grant access to your photo library to upload a profile photo.');
             return;
         }
            
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

            if (!result.canceled && user?._id) {
                setIsUploadingPhoto(true);
                const formData = new FormData();
                const uri = result.assets[0].uri;
                const filename = uri.split('/').pop() || 'profile.jpg';
                const match = /\.(\w+)$/.exec(filename);
                const type = match ? `image/${match[1]}` : 'image/jpeg';

                formData.append('image', { uri, name: filename, type } as any);

                 await userAPI.uploadProfilePhoto(user._id, formData);
                 CustomAlert.success('Success', 'Profile photo updated');
                 fetchStats();
            }
         } catch (error) {
             CustomAlert.error('Error', 'Failed to upload profile photo');
         } finally {
            setIsUploadingPhoto(false);
        }
    };

     const handleLogout = () => {
         CustomAlert.show({
             type: 'confirm',
             title: 'Logout',
             message: 'Are you sure you want to logout?',
             buttons: [
                 { text: 'Cancel', style: 'cancel' },
                 { text: 'Logout', style: 'destructive', onPress: logout }
             ],
             dismissable: true
         });
     };

    if (!user) {
        return (
            <ThemedView style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color={primaryColor} />
            </ThemedView>
        );
    }

    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <View style={styles.header}>
                    <ThemedText type="title" style={styles.headerTitle}>Profile</ThemedText>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                        <TouchableOpacity onPress={() => router.push('/chat/favorites')}>
                            <IconSymbol name="bookmark" size={24} color={textColor} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => router.push('/settings' as any)}>
                            <IconSymbol name="settings" size={24} color={textColor} />
                        </TouchableOpacity>
                    </View>
                </View>

                <ScrollView 
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primaryColor} />}
                >
                    {/* Profile Header */}
                    <View style={styles.profileHeader}>
                        <TouchableOpacity onPress={handlePickImage} disabled={isUploadingPhoto} style={styles.avatarContainer}>
                            {user.profilePhoto ? (
                                <Image source={{ uri: getImageUrl(user.profilePhoto) }} style={styles.avatar} />
                            ) : (
                                <View style={[styles.avatarPlaceholder, { backgroundColor: surfaceColor }]}>
                                    <IconSymbol name="person.fill" size={40} color={lightTextColor} />
                                </View>
                            )}
                            <View style={[styles.editBadge, { backgroundColor: primaryColor }]}>
                                {isUploadingPhoto ? (
                                    <ActivityIndicator size="small" color="white" />
                                ) : (
                                    <IconSymbol name="camera" size={14} color="white" />
                                )}
                            </View>
                        </TouchableOpacity>

                        <ThemedText type="title" style={styles.username}>{user.username}</ThemedText>
                        {user.bio && <ThemedText style={styles.bio}>{user.bio}</ThemedText>}

                        <View style={styles.statsContainer}>
                            <View style={styles.statItem}>
                                <ThemedText type="body1" style={{ fontWeight: 'bold' }}>{stats.postsCount}</ThemedText>
                                <ThemedText style={styles.statLabel}>Posts</ThemedText>
                            </View>
                            <View style={[styles.statDivider, { backgroundColor: borderColor }]} />
                            <View style={styles.statItem}>
                                <ThemedText type="body1" style={{ fontWeight: 'bold' }}>{stats.friendsCount}</ThemedText>
                                <ThemedText style={styles.statLabel}>Friends</ThemedText>
                            </View>
                        </View>

                        <TouchableOpacity 
                            style={[styles.editButton, { borderColor }]} 
                            onPress={() => setIsEditing(true)}
                        >
                            <ThemedText style={{ fontWeight: '600' }}>Edit Profile</ThemedText>
                        </TouchableOpacity>
                    </View>

                    {/* Menu Items */}
                    <View style={styles.menuContainer}>
                        <TouchableOpacity 
                            style={[styles.menuItem, { borderBottomColor: borderColor }]}
                            onPress={() => router.push('/chat/favorites')}
                        >
                            <View style={[styles.menuIcon, { backgroundColor: surfaceColor }]}>
                                <IconSymbol name="bookmark.fill" size={20} color={primaryColor} />
                            </View>
                            <ThemedText style={styles.menuText}>Favorites</ThemedText>
                            <IconSymbol name="chevron.right" size={20} color={lightTextColor} />
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={[styles.menuItem, { borderBottomColor: borderColor }]}
                            onPress={() => { /* Navigate to friends list */ }}
                        >
                            <View style={[styles.menuIcon, { backgroundColor: surfaceColor }]}>
                                <IconSymbol name="person.2.fill" size={20} color={primaryColor} />
                            </View>
                            <ThemedText style={styles.menuText}>Friends</ThemedText>
                            <IconSymbol name="chevron.right" size={20} color={lightTextColor} />
                        </TouchableOpacity>

                         <TouchableOpacity 
                            style={[styles.menuItem, { borderBottomColor: borderColor }]}
                            onPress={handleLogout}
                        >
                            <View style={[styles.menuIcon, { backgroundColor: surfaceColor }]}>
                                <IconSymbol name="lock" size={20} color={dangerColor} />
                            </View>
                            <ThemedText style={[styles.menuText, { color: dangerColor }]}>Log Out</ThemedText>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </SafeAreaView>

            <EditProfileModal
                visible={isEditing}
                onClose={() => setIsEditing(false)}
                onSave={handleUpdateProfile}
                initialData={user}
            />
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    safeArea: { flex: 1 },
    center: { justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
    headerTitle: { fontSize: typography.sizes.heading2, fontFamily: typography.families.bold },
    scrollContent: { paddingBottom: spacing.xl },
    profileHeader: { alignItems: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.lg },
    avatarContainer: { position: 'relative', marginBottom: spacing.md },
    avatar: { width: 100, height: 100, borderRadius: 50 },
    avatarPlaceholder: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center' },
    editBadge: { position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'white' },
    username: { fontSize: typography.sizes.heading3, fontFamily: typography.families.bold, marginBottom: spacing.xs },
    bio: { textAlign: 'center', marginBottom: spacing.lg, opacity: 0.8, paddingHorizontal: spacing.xl },
    statsContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg, width: '100%', justifyContent: 'center' },
    statItem: { alignItems: 'center', paddingHorizontal: spacing.xl },
    statDivider: { width: 1, height: 24 },
    statLabel: { fontSize: typography.sizes.caption, opacity: 0.6 },
    editButton: { paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, borderRadius: borderRadius.full, borderWidth: 1 },
    menuContainer: { marginTop: spacing.md, paddingHorizontal: spacing.lg },
    menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
    menuIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
    menuText: { flex: 1, fontSize: typography.sizes.body1, fontWeight: '500' },
});