import React, { useState } from 'react';
import { Modal, StyleSheet, View, TextInput, TouchableOpacity, ActivityIndicator, Alert, Image, Switch } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { spacing, borderRadius, typography } from '@/constants/design-tokens';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { communityAPI } from '@/utils/api';

interface CreateCommunityModalProps {
    visible: boolean;
    onClose: () => void;
    onCreate?: () => void;
}

export function CreateCommunityModal({ visible, onClose, onCreate }: CreateCommunityModalProps) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [image, setImage] = useState<string | null>(null);
    const [requiresApproval, setRequiresApproval] = useState(true);
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const backgroundColor = useThemeColor('background');
    const textColor = useThemeColor('text');
    const primaryColor = useThemeColor('primary');
    const lightTextColor = useThemeColor('lightText');

    const handlePickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled) {
            setImage(result.assets[0].uri);
        }
    };

    const handleCreate = async () => {
        if (!name.trim() || !description.trim()) {
            Alert.alert('Error', 'Please provide a name and description.');
            return;
        }

        setIsLoading(true);
        try {
            let uploadedImageUrl = undefined;
            if (image) {
                const response = await fetch(image);
                const blob = await response.blob();
                const base64 = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.readAsDataURL(blob);
                });
                const uploadResponse = await communityAPI.uploadImageBase64({
                    imageData: base64,
                    filename: `comm-${Date.now()}.jpg`,
                });
                uploadedImageUrl = uploadResponse.imageUrl;
            }

            await communityAPI.create({
                name,
                description,
                image: uploadedImageUrl,
                requiresApproval,
                isAnonymous,
            });

            Alert.alert('Success', 'Community created!');
            onCreate?.();
            onClose();
            // Reset form
            setName('');
            setDescription('');
            setImage(null);
            setIsAnonymous(false);
        } catch (error: any) {
            console.error('Error creating community:', error);
            Alert.alert('Error', error.response?.data?.msg || 'Failed to create community.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
            <ThemedView style={[styles.container, { backgroundColor }]} safe>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose}>
                        <IconSymbol name="x" size={24} color={textColor} />
                    </TouchableOpacity>
                    <ThemedText style={styles.title}>Create Community</ThemedText>
                    <TouchableOpacity onPress={handleCreate} disabled={isLoading}>
                        {isLoading ? <ActivityIndicator color={primaryColor} /> : <ThemedText style={{ color: primaryColor, fontFamily: typography.families.bold }}>Create</ThemedText>}
                    </TouchableOpacity>
                </View>

                <View style={styles.content}>
                    <TouchableOpacity onPress={handlePickImage} style={styles.imagePicker}>
                        {image ? (
                            <Image source={{ uri: image }} style={styles.previewImage} />
                        ) : (
                            <View style={[styles.placeholderImage, { borderColor: lightTextColor }]}>
                                <IconSymbol name="camera" size={32} color={lightTextColor} />
                                <ThemedText style={{ color: lightTextColor, marginTop: spacing.xs }}>Add Cover</ThemedText>
                            </View>
                        )}
                    </TouchableOpacity>

                    <TextInput style={[styles.input, { color: textColor, fontSize: typography.sizes.heading2 }]} placeholder="Community Name" placeholderTextColor={lightTextColor} value={name} onChangeText={setName} />
                    <TextInput style={[styles.input, { color: textColor, height: 100, textAlignVertical: 'top' }]} placeholder="Description..." placeholderTextColor={lightTextColor} value={description} onChangeText={setDescription} multiline />

                    <View style={styles.switchContainer}>
                        <ThemedText>Require Approval to Join</ThemedText>
                        <Switch value={requiresApproval} onValueChange={setRequiresApproval} trackColor={{ false: '#767577', true: primaryColor }} />
                    </View>

                    <View style={styles.switchContainer}>
                        <ThemedText>Create as Anonymous</ThemedText>
                        <Switch value={isAnonymous} onValueChange={setIsAnonymous} trackColor={{ false: '#767577', true: primaryColor }} />
                    </View>
                </View>
            </ThemedView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
    title: { fontSize: typography.sizes.title, fontFamily: typography.families.bold },
    content: { padding: spacing.lg },
    imagePicker: { alignItems: 'center', marginBottom: spacing.lg },
    previewImage: { width: 120, height: 120, borderRadius: 60 },
    placeholderImage: { width: 120, height: 120, borderRadius: 60, borderWidth: 1, justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed' },
    input: { fontSize: typography.sizes.body1, marginBottom: spacing.lg, padding: spacing.sm },
    switchContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md },
});