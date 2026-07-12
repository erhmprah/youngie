// components/media-picker-button.tsx

import React, { useState } from 'react';
import { TouchableOpacity, View, Modal, StyleSheet, Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { ThemedView } from './themed-view';
import { ThemedText } from './themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { spacing, borderRadius, typography } from '@/constants/design-tokens';
import * as Haptics from 'expo-haptics';

export type MediaType = 'photo' | 'video' | 'audio';

export interface MediaPickerResult {
    uri: string;
    type: MediaType;
    fileName?: string;
    duration?: number; // For audio/video
}

interface MediaPickerButtonProps {
    onMediaSelected: (result: MediaPickerResult) => void;
    icon?: keyof typeof Ionicons.glyphMap;
    size?: number;
    disabled?: boolean;
    showAudioOption?: boolean;
    // For chat: allow switching between attach mode and mic mode
    isRecording?: boolean;
    onStartRecording?: () => void;
    onStopRecording?: () => void;
}

export function MediaPickerButton({ 
    onMediaSelected, 
    icon = 'add',
    size = 24,
    disabled = false,
    showAudioOption = true,
    isRecording = false,
    onStartRecording,
    onStopRecording
}: MediaPickerButtonProps) {
    const [showOptions, setShowOptions] = useState(false);
    
    const backgroundColor = useThemeColor('background');
    const surfaceColor = useThemeColor('surface');
    const textColor = useThemeColor('text');
    const primaryColor = useThemeColor('primary');
    const lightTextColor = useThemeColor('lightText');
    const borderColor = useThemeColor('border');

    const handlePress = async () => {
        if (disabled) return;
        
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setShowOptions(true);
    };

    const handleOptionSelect = async (option: MediaType) => {
        setShowOptions(false);
        
        try {
            if (option === 'photo') {
                await pickPhoto();
            } else if (option === 'video') {
                await pickVideo();
            } else if (option === 'audio') {
                // For audio, we'll trigger the recording callback
                if (onStartRecording) {
                    onStartRecording();
                }
            }
        } catch (error) {
            console.error('Media picker error:', error);
            Alert.alert('Error', 'Failed to access media. Please try again.');
        }
    };

    const pickPhoto = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Please grant permission to access photos');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 1,
        });

        if (!result.canceled && result.assets[0]) {
            const asset = result.assets[0];
            onMediaSelected({
                uri: asset.uri,
                type: 'photo',
                fileName: asset.fileName || `photo-${Date.now()}.jpg`,
            });
        }
    };

    const pickVideo = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Please grant permission to access videos');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
            allowsEditing: true,
            quality: 1,
            videoMaxDuration: 300, // 5 minutes max
        });

        if (!result.canceled && result.assets[0]) {
            const asset = result.assets[0];
            onMediaSelected({
                uri: asset.uri,
                type: 'video',
                fileName: asset.fileName || `video-${Date.now()}.mp4`,
                duration: asset.duration ?? undefined,
            });
        }
    };

    const handleRecordingComplete = (result: MediaPickerResult) => {
        onMediaSelected(result);
    };

    // Expose recording completion handler
    React.useEffect(() => {
        (window as any).__mediaPickerRecordingComplete = handleRecordingComplete;
        return () => {
            delete (window as any).__mediaPickerRecordingComplete;
        };
    }, []);

    return (
        <>
            <TouchableOpacity 
                onPress={handlePress}
                style={[styles.button, disabled && styles.buttonDisabled]}
                disabled={disabled}
            >
                <Ionicons name={icon} size={size} color={disabled ? lightTextColor : primaryColor} />
            </TouchableOpacity>

            <Modal
                visible={showOptions}
                transparent
                animationType="fade"
                onRequestClose={() => setShowOptions(false)}
            >
                <TouchableOpacity 
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowOptions(false)}
                >
                    <ThemedView style={[styles.optionsContainer, { backgroundColor: surfaceColor, borderColor }]}>
                        <ThemedText style={[styles.title, { color: textColor }]}>Choose Media Type</ThemedText>
                        
                        <TouchableOpacity 
                            style={[styles.option, { borderBottomColor: borderColor }]}
                            onPress={() => handleOptionSelect('photo')}
                        >
                            <View style={[styles.iconContainer, { backgroundColor: '#4A90E2' }]}>
                                <Ionicons name="camera" size={24} color="white" />
                            </View>
                            <View style={styles.optionText}>
                                <ThemedText style={[styles.optionTitle, { color: textColor }]}>Photo</ThemedText>
                                <ThemedText style={[styles.optionSubtitle, { color: lightTextColor }]}>Select from gallery</ThemedText>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={lightTextColor} />
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={[styles.option, { borderBottomColor: borderColor }]}
                            onPress={() => handleOptionSelect('video')}
                        >
                            <View style={[styles.iconContainer, { backgroundColor: '#E0245E' }]}>
                                <Ionicons name="videocam" size={24} color="white" />
                            </View>
                            <View style={styles.optionText}>
                                <ThemedText style={[styles.optionTitle, { color: textColor }]}>Video</ThemedText>
                                <ThemedText style={[styles.optionSubtitle, { color: lightTextColor }]}>Select from gallery</ThemedText>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={lightTextColor} />
                        </TouchableOpacity>

                        {showAudioOption && (
                            <TouchableOpacity 
                                style={styles.option}
                                onPress={() => handleOptionSelect('audio')}
                            >
                                <View style={[styles.iconContainer, { backgroundColor: '#8E44AD' }]}>
                                    <Ionicons name="mic" size={24} color="white" />
                                </View>
                                <View style={styles.optionText}>
                                    <ThemedText style={[styles.optionTitle, { color: textColor }]}>Audio</ThemedText>
                                    <ThemedText style={[styles.optionSubtitle, { color: lightTextColor }]}>Record a voice message</ThemedText>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color={lightTextColor} />
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity 
                            style={[styles.cancelButton, { borderTopColor: borderColor }]}
                            onPress={() => setShowOptions(false)}
                        >
                            <ThemedText style={{ color: primaryColor, fontWeight: '600' }}>Cancel</ThemedText>
                        </TouchableOpacity>
                    </ThemedView>
                </TouchableOpacity>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    button: {
        padding: spacing.sm,
        borderRadius: borderRadius.round,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    optionsContainer: {
        width: '85%',
        maxWidth: 340,
        borderRadius: borderRadius.lg,
        overflow: 'hidden',
        borderWidth: 1,
    },
    title: {
        fontSize: typography.sizes.title,
        fontFamily: typography.families.bold,
        textAlign: 'center',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
    },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: borderRadius.md,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    optionText: {
        flex: 1,
    },
    optionTitle: {
        fontSize: typography.sizes.body1,
        fontWeight: typography.weights.semibold,
    },
    optionSubtitle: {
        fontSize: typography.sizes.caption,
        marginTop: 2,
    },
    cancelButton: {
        paddingVertical: spacing.md,
        alignItems: 'center',
        borderTopWidth: StyleSheet.hairlineWidth,
    },
});
