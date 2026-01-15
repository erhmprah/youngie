// components/edit-profile-modal.tsx

import React, { useState, useEffect } from 'react';
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
    const [suggestions, setSuggestions] = useState<string[]>([]);

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
                interests: interests.split(',').map((s: string) => s.trim()).filter(Boolean),
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

    // Search location with debounce
    useEffect(() => {
        if (location.length < 3) {
            setSuggestions([]);
            return;
        }

        const timer = setTimeout(async () => {
            try {
                // Using OpenStreetMap Nominatim API (No API key required)
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&addressdetails=1&limit=5`,
                    { headers: { 'User-Agent': 'YoungieApp/1.0' } }
                );
                const data = await response.json();

                if (Array.isArray(data)) {
                    const places = data.map((item: any) => {
                        const addr = item.address;
                        const city = addr.city || addr.town || addr.village || addr.municipality || item.name;
                        const country = addr.country;
                        return city && country ? `${city}, ${country}` : item.display_name.split(',').slice(0, 2).join(',');
                    });
                    setSuggestions([...new Set(places)] as string[]);
                }
            } catch (error) {
                console.log('Location search error:', error);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [location]);

    const selectSuggestion = (city: string) => {
        setLocation(city);
        setSuggestions([]);
    };

    return (
        <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
            <ThemedView style={[styles.container, { backgroundColor }]} safe>
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
                    <View style={[styles.inputContainer, { zIndex: 1000 }]}>
                        <ThemedText style={styles.label}>Location</ThemedText>
                        <TextInput
                            style={[styles.input, { backgroundColor: inputBackgroundColor, borderColor: inputBorderColor, color: textColor }]}
                            value={location}
                            onChangeText={setLocation}
                            placeholder="Your location"
                            placeholderTextColor={lightTextColor}
                        />
                        {suggestions.length > 0 && (
                            <View style={[styles.suggestionsDropdown, { backgroundColor: inputBackgroundColor, borderColor: inputBorderColor }]}>
                                {suggestions.map((city, index) => (
                                    <TouchableOpacity key={index} style={styles.suggestionItem} onPress={() => selectSuggestion(city)}>
                                        <ThemedText>{city}</ThemedText>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
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
    suggestionsDropdown: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        borderWidth: 1,
        borderTopWidth: 0,
        borderBottomLeftRadius: borderRadius.md,
        borderBottomRightRadius: borderRadius.md,
        zIndex: 1000,
        marginTop: -2, // Overlap slightly with input border
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    suggestionItem: {
        padding: spacing.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#ccc',
    },
});
