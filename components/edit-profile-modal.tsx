// components/edit-profile-modal.tsx

import React, { useState } from 'react';
import { Modal, StyleSheet, View, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Switch } from 'react-native';
import { ThemedView } from './themed-view';
import { ThemedText } from './themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { spacing, borderRadius, typography } from '@/constants/design-tokens';
import { IconSymbol } from './ui/icon-symbol';

interface EditProfileModalProps {
    visible: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    initialData: any;
}

export function EditProfileModal({ visible, onClose, onSave, initialData }: EditProfileModalProps) {
    const [username, setUsername] = useState(initialData?.username || '');
    const [bio, setBio] = useState(initialData?.bio || '');
    const [location, setLocation] = useState(initialData?.location || '');
    const [interests, setInterests] = useState((initialData?.interests || []).join(', '));
    const [isPrivate, setIsPrivate] = useState(initialData?.isPrivate || false);
    const [isLoading, setIsLoading] = useState(false);

    const backgroundColor = useThemeColor('background');
    const textColor = useThemeColor('text');
    const primaryColor = useThemeColor('primary');
    const white = useThemeColor('white');
    const lightTextColor = useThemeColor('lightText');
    const inputBackgroundColor = useThemeColor('inputBackground');
    const inputBorderColor = useThemeColor('border');

    const handleSave = async () => {
        setIsLoading(true);
        try {
            await onSave({
                username,
                bio,
                location,
                interests: interests.split(',').map(s => s.trim()).filter(Boolean),
                isPrivate,
            });
            onClose();
        } catch (error) {
            console.error('Error saving profile:', error);
            Alert.alert('Error', 'Failed to save profile.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
            <ThemedView style={[styles.container, { backgroundColor }]}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose}>
                        <IconSymbol name="x" size={24} color={textColor} />
                    </TouchableOpacity>
                    <ThemedText style={{ fontSize: typography.sizes.title, fontFamily: typography.families.bold }}>Edit Profile</ThemedText>
                    <TouchableOpacity onPress={handleSave} disabled={isLoading}>
                        {isLoading ? <ActivityIndicator color={primaryColor} /> : <ThemedText style={{ color: primaryColor, fontSize: typography.sizes.title, fontFamily: typography.families.bold }}>Save</ThemedText>}
                    </TouchableOpacity>
                </View>

                <ScrollView style={styles.content}>
                    <View style={styles.inputContainer}>
                        <ThemedText style={styles.label}>Username</ThemedText>
                        <TextInput
                            style={[styles.input, { backgroundColor: inputBackgroundColor, borderColor: inputBorderColor, color: textColor }]}
                            value={username}
                            onChangeText={setUsername}
                            placeholder="Your username"
                            placeholderTextColor={lightTextColor}
                        />
                    </View>
                    <View style={styles.inputContainer}>
                        <ThemedText style={styles.label}>Bio</ThemedText>
                        <TextInput
                            style={[styles.input, styles.bioInput, { backgroundColor: inputBackgroundColor, borderColor: inputBorderColor, color: textColor }]}
                            value={bio}
                            onChangeText={setBio}
                            placeholder="Tell us about yourself"
                            placeholderTextColor={lightTextColor}
                            multiline
                        />
                    </View>
                    <View style={styles.inputContainer}>
                        <ThemedText style={styles.label}>Location</ThemedText>
                        <TextInput
                            style={[styles.input, { backgroundColor: inputBackgroundColor, borderColor: inputBorderColor, color: textColor }]}
                            value={location}
                            onChangeText={setLocation}
                            placeholder="Your location"
                            placeholderTextColor={lightTextColor}
                        />
                    </View>
                    <View style={styles.inputContainer}>
                        <ThemedText style={styles.label}>Interests</ThemedText>
                        <TextInput
                            style={[styles.input, { backgroundColor: inputBackgroundColor, borderColor: inputBorderColor, color: textColor }]}
                            value={interests}
                            onChangeText={setInterests}
                            placeholder="e.g., music, art, sports"
                            placeholderTextColor={lightTextColor}
                        />
                         <ThemedText style={{fontSize: typography.sizes.caption, color: lightTextColor}}>Separate interests with a comma</ThemedText>
                    </View>
                    <View style={styles.inputContainer}>
                        <View style={styles.switchRow}>
                            <ThemedText style={styles.label}>Private Profile</ThemedText>
                            <Switch
                                value={isPrivate}
                                onValueChange={setIsPrivate}
                                trackColor={{ false: inputBackgroundColor, true: primaryColor }}
                                thumbColor={white}
                            />
                        </View>
                        <ThemedText style={{ fontSize: typography.sizes.caption, color: lightTextColor }}>
                            When your profile is private, only people you approve can see your posts and stories. Existing followers won't be affected.
                        </ThemedText>
                    </View>
                </ScrollView>
            </ThemedView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    content: {
        padding: spacing.md,
    },
    inputContainer: {
        marginBottom: spacing.lg,
    },
    label: {
        fontSize: typography.sizes.body1,
        fontFamily: typography.families.medium,
        marginBottom: spacing.sm,
    },
    input: {
        borderWidth: 1,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        fontSize: typography.sizes.body1,
    },
    bioInput: {
        minHeight: 100,
        textAlignVertical: 'top',
    },
    switchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
});
