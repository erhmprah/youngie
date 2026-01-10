import React, { useState, useEffect } from 'react';
import { Modal, View, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedView } from './themed-view';
import { ThemedText } from './themed-text';
import { IconSymbol } from './ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { userAPI, getImageUrl } from '@/utils/api';
import { spacing, borderRadius, typography } from '@/constants/design-tokens';

interface User {
    _id: string;
    username: string;
    profilePhoto?: string;
}

interface UserTaggingModalProps {
    visible: boolean;
    onClose: () => void;
    onTagsSelected: (selectedUsers: User[]) => void;
    initialSelectedUsers?: User[];
}

export function UserTaggingModal({ visible, onClose, onTagsSelected, initialSelectedUsers = [] }: UserTaggingModalProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<User[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<User[]>(initialSelectedUsers);
    const [loading, setLoading] = useState(false);

    const backgroundColor = useThemeColor('background');
    const textColor = useThemeColor('text');
    const surfaceColor = useThemeColor('surface');
    const primaryColor = useThemeColor('primary');
    const lightTextColor = useThemeColor('lightText');
    const borderColor = useThemeColor('border');

    useEffect(() => {
        if (visible) {
            setSelectedUsers(initialSelectedUsers);
            setQuery('');
            setResults([]);
        }
    }, [visible, initialSelectedUsers]);

    const handleSearch = async (text: string) => {
        setQuery(text);
        if (text.length < 2) {
            setResults([]);
            return;
        }

        setLoading(true);
        try {
            const response = await userAPI.searchUsers(text);
            setResults(response.data);
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleUser = (user: User) => {
        if (selectedUsers.find(u => u._id === user._id)) {
            setSelectedUsers(prev => prev.filter(u => u._id !== user._id));
        } else {
            setSelectedUsers(prev => [...prev, user]);
        }
    };

    const handleDone = () => {
        onTagsSelected(selectedUsers);
        onClose();
    };

    const renderItem = ({ item }: { item: User }) => {
        const isSelected = selectedUsers.some(u => u._id === item._id);
        return (
            <TouchableOpacity style={[styles.userRow, { borderBottomColor: borderColor }]} onPress={() => toggleUser(item)}>
                {item.profilePhoto ? (
                    <Image source={{ uri: getImageUrl(item.profilePhoto) }} style={styles.avatar} />
                ) : (
                    <View style={[styles.avatar, { backgroundColor: surfaceColor, justifyContent: 'center', alignItems: 'center' }]}>
                        <IconSymbol name="person.fill" size={20} color={lightTextColor} />
                    </View>
                )}
                <ThemedText style={styles.username}>{item.username}</ThemedText>
                {isSelected && (
                    <IconSymbol name="checkmark" size={20} color={primaryColor} />
                )}
            </TouchableOpacity>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <ThemedView style={styles.container}>
                <SafeAreaView edges={['top']} style={{ flex: 1 }}>
                    <View style={[styles.header, { borderBottomColor: borderColor }]}>
                        <TouchableOpacity onPress={onClose}>
                            <ThemedText style={{ color: lightTextColor }}>Cancel</ThemedText>
                        </TouchableOpacity>
                        <ThemedText type="subtitle" style={{ fontWeight: 'bold' }}>Tag People</ThemedText>
                        <TouchableOpacity onPress={handleDone}>
                            <ThemedText style={{ color: primaryColor, fontWeight: 'bold' }}>Done</ThemedText>
                        </TouchableOpacity>
                    </View>

                    <View style={[styles.searchContainer, { backgroundColor: surfaceColor }]}>
                        <IconSymbol name="magnifyingglass" size={20} color={lightTextColor} />
                        <TextInput
                            style={[styles.input, { color: textColor }]}
                            placeholder="Search users..."
                            placeholderTextColor={lightTextColor}
                            value={query}
                            onChangeText={handleSearch}
                            autoCapitalize="none"
                        />
                    </View>

                    {selectedUsers.length > 0 && (
                        <View style={styles.selectedContainer}>
                            <FlatList
                                data={selectedUsers}
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                keyExtractor={item => item._id}
                                renderItem={({ item }) => (
                                    <TouchableOpacity style={[styles.chip, { backgroundColor: primaryColor }]} onPress={() => toggleUser(item)}>
                                        <ThemedText style={{ color: 'white', marginRight: 4, fontSize: 14 }}>{item.username}</ThemedText>
                                        <IconSymbol name="x" size={14} color="white" />
                                    </TouchableOpacity>
                                )}
                            />
                        </View>
                    )}

                    {loading ? (
                        <ActivityIndicator style={{ marginTop: 20 }} color={primaryColor} />
                    ) : (
                        <FlatList
                            data={results}
                            keyExtractor={item => item._id}
                            renderItem={renderItem}
                            contentContainerStyle={styles.list}
                            keyboardShouldPersistTaps="handled"
                        />
                    )}
                </SafeAreaView>
            </ThemedView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.md,
        borderBottomWidth: 1,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        margin: spacing.md,
        padding: spacing.sm,
        borderRadius: borderRadius.md,
    },
    input: {
        flex: 1,
        marginLeft: spacing.sm,
        fontSize: typography.sizes.body1,
        paddingVertical: 4,
    },
    list: {
        paddingHorizontal: spacing.md,
    },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: spacing.md,
    },
    username: {
        flex: 1,
        fontSize: typography.sizes.body1,
        fontFamily: typography.families.medium,
    },
    selectedContainer: {
        paddingHorizontal: spacing.md,
        marginBottom: spacing.sm,
        height: 40,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        marginRight: 8,
    },
});