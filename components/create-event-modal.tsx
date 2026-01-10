import React, { useState } from 'react';
import { Modal, StyleSheet, View, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { ThemedView } from './themed-view';
import { ThemedText } from './themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { spacing, borderRadius, typography, shadows } from '@/constants/design-tokens';
import { IconSymbol } from './ui/icon-symbol';
import { communityAPI } from '@/utils/api';

interface CreateEventModalProps {
    visible: boolean;
    onClose: () => void;
    communityId: string;
    onCreate: () => void;
}

export function CreateEventModal({ visible, onClose, communityId, onCreate }: CreateEventModalProps) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [date, setDate] = useState('');
    const [type, setType] = useState<'voice' | 'game' | 'meetup' | 'other'>('other');
    const [isLoading, setIsLoading] = useState(false);

    const backgroundColor = useThemeColor('background');
    const textColor = useThemeColor('text');
    const primaryColor = useThemeColor('primary');
    const lightTextColor = useThemeColor('lightText');
    const inputBackgroundColor = useThemeColor('inputBackground');
    const inputBorderColor = useThemeColor('inputBorder');
    const white = useThemeColor('white');

    const handleCreate = async () => {
        if (!title.trim() || !description.trim() || !date.trim()) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        const timestamp = Date.parse(date);
        if (isNaN(timestamp)) {
            Alert.alert('Error', 'Invalid date format. Please use YYYY-MM-DD HH:MM');
            return;
        }

        setIsLoading(true);
        try {
            // Assuming communityAPI.createEvent exists
            await communityAPI.createEvent(communityId, {
                title,
                description,
                date: new Date(date).toISOString(), // Basic validation, ideally use a DatePicker
                type
            });
            Alert.alert('Success', 'Event scheduled!');
            onCreate();
            onClose();
            setTitle('');
            setDescription('');
            setDate('');
            setType('other');
        } catch (error: any) {
            console.error('Error creating event:', error);
            Alert.alert('Error', 'Failed to schedule event. Ensure date format is YYYY-MM-DD HH:MM');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
            <ThemedView style={[styles.container, { backgroundColor }]}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose}>
                        <IconSymbol name="xmark" size={24} color={textColor} />
                    </TouchableOpacity>
                    <ThemedText style={styles.title}>Schedule Event</ThemedText>
                    <TouchableOpacity onPress={handleCreate} disabled={isLoading}>
                        {isLoading ? <ActivityIndicator color={primaryColor} /> : <ThemedText style={{ color: primaryColor, fontFamily: typography.families.bold }}>Save</ThemedText>}
                    </TouchableOpacity>
                </View>

                <ScrollView style={styles.content}>
                    <View style={styles.inputGroup}>
                        <ThemedText style={styles.label}>Event Title</ThemedText>
                        <TextInput style={[styles.input, { backgroundColor: inputBackgroundColor, borderColor: inputBorderColor, color: textColor }]} value={title} onChangeText={setTitle} placeholder="e.g. Weekly Game Night" placeholderTextColor={lightTextColor} />
                    </View>

                    <View style={styles.inputGroup}>
                        <ThemedText style={styles.label}>Description</ThemedText>
                        <TextInput style={[styles.input, styles.textArea, { backgroundColor: inputBackgroundColor, borderColor: inputBorderColor, color: textColor }]} value={description} onChangeText={setDescription} placeholder="What's happening?" placeholderTextColor={lightTextColor} multiline />
                    </View>

                    <View style={styles.inputGroup}>
                        <ThemedText style={styles.label}>Date & Time (YYYY-MM-DD HH:MM)</ThemedText>
                        <TextInput style={[styles.input, { backgroundColor: inputBackgroundColor, borderColor: inputBorderColor, color: textColor }]} value={date} onChangeText={setDate} placeholder="2023-12-31 20:00" placeholderTextColor={lightTextColor} />
                    </View>

                    <View style={styles.inputGroup}>
                        <ThemedText style={styles.label}>Event Type</ThemedText>
                        <View style={styles.typeContainer}>
                            {['voice', 'game', 'meetup', 'other'].map((t) => (
                                <TouchableOpacity 
                                    key={t} 
                                    style={[
                                        styles.typeButton, 
                                        { backgroundColor: type === t ? primaryColor : inputBackgroundColor, borderColor: inputBorderColor }
                                    ]}
                                    onPress={() => setType(t as any)}
                                >
                                    <ThemedText style={{ color: type === t ? white : textColor, textTransform: 'capitalize' }}>{t}</ThemedText>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </ScrollView>
            </ThemedView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
    title: { fontSize: typography.sizes.title, fontFamily: typography.families.bold },
    content: { padding: spacing.lg },
    inputGroup: { marginBottom: spacing.lg },
    label: { marginBottom: spacing.sm, fontFamily: typography.families.medium },
    input: { borderWidth: 1, borderRadius: borderRadius.md, padding: spacing.md, fontSize: typography.sizes.body1 },
    textArea: { height: 100, textAlignVertical: 'top' },
    typeContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    typeButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1 },
});