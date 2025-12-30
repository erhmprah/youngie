// app/chat/[id].tsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, FlatList, TouchableOpacity, TextInput, Platform, KeyboardAvoidingView, ActivityIndicator, Alert, Image, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/contexts/AuthContext';
import { chatAPI, getImageUrl } from '@/utils/api';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, typography } from '@/constants/design-tokens';
import { joinChat, leaveChat, sendMessage as socketSendMessage, onMessageReceived, offMessageReceived, onUserTyping, offUserTyping, onUserStopTyping, offUserStopTyping, sendTypingStart, sendTypingStop } from '@/utils/socket';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';

interface User {
    _id: string;
    username: string;
    profilePhoto?: string;
}

interface ChatMessage {
     _id: string;
     sender: string | User; // Can be populated
     content: string | null;
     attachment?: {
         fileUrl: string;
         fileType: string;
         fileName: string;
         fileSize: number;
     };
     timestamp?: string;
     createdAt?: string; // For older messages
 }

interface Chat {
    _id:string;
    participants: User[];
    name?: string;
    messages?: ChatMessage[];
}

export default function ConversationScreen() {
    const { id: chatId } = useLocalSearchParams<{ id: string }>();
    const { user } = useAuth();
    const router = useRouter();
    const [chat, setChat] = useState<Chat | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [typingUser, setTypingUser] = useState<string | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const flatListRef = useRef<FlatList>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const backgroundColor = useThemeColor('background');
    const primaryColor = useThemeColor('primary');
    const textColor = useThemeColor('text');
    const lightTextColor = useThemeColor('lightText');
    const surfaceColor = useThemeColor('surface');
    const borderColor = useThemeColor('border');
    const white = useThemeColor('white');

    useEffect(() => {
        if (chatId) {
            joinChat(chatId);
            fetchMessages(chatId);

            onMessageReceived((newMessage) => {
                setMessages(prev => [...prev, newMessage]);
            });
            
            onUserTyping(({ username }) => {
                setTypingUser(username);
                if (typingTimeoutRef.current) {
                    clearTimeout(typingTimeoutRef.current);
                }
                typingTimeoutRef.current = setTimeout(() => {
                    setTypingUser(null);
                }, 3000) as unknown as NodeJS.Timeout;
            });
            
            onUserStopTyping(() => {
                setTypingUser(null);
                 if (typingTimeoutRef.current) {
                    clearTimeout(typingTimeoutRef.current);
                }
            });
        }

        return () => {
            if (chatId) {
                leaveChat(chatId);
                offMessageReceived();
                offUserTyping();
                offUserStopTyping();
                if (typingTimeoutRef.current) {
                    clearTimeout(typingTimeoutRef.current);
                }
            }
        };
    }, [chatId]);

    const fetchMessages = async (id: string) => {
        try {
            setIsLoading(true);
            const response = await chatAPI.getChat(id);
            setChat(response.data);
            setMessages(response.data?.messages || []);
        } catch (error: any) {
            console.error('Error fetching messages:', error);
            Alert.alert('Error', 'Failed to load messages');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSendMessage = () => {
        if (!message.trim() || !chatId || !user?._id) return;
        socketSendMessage(chatId, user._id, message.trim());
        setMessage('');
        sendTypingStop(chatId);
    };

    const handleTyping = (text: string) => {
        setMessage(text);
        if (chatId && user?.username) {
            if (text.length > 0) {
                sendTypingStart(chatId, user.username);
            } else {
                sendTypingStop(chatId);
            }
        }
    }

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Please grant permission to access your photos');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            allowsEditing: true,
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            await uploadAndSendAttachment(result.assets[0], 'image');
        }
    };

    const pickDocument = async () => {
        // For mobile, we'll use the image picker which can select various file types
        // On iOS/Android, this allows selecting documents, PDFs, etc.
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Please grant permission to access your files');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            allowsEditing: false,
            quality: 1, // Keep original quality for documents
        });

        if (!result.canceled && result.assets[0]) {
            const asset = result.assets[0];
            // Determine file type based on MIME type
            let fileType = 'document';
            if (asset.mimeType?.startsWith('image/')) {
                fileType = 'image';
            } else if (asset.mimeType?.startsWith('video/')) {
                fileType = 'video';
            } else if (asset.mimeType?.startsWith('audio/')) {
                fileType = 'audio';
            }
            // Everything else is treated as document

            await uploadAndSendAttachment(asset, fileType);
        }
    };

    const startRecording = async () => {
        try {
            const { status } = await Audio.requestPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission needed', 'Please grant permission to record audio');
                return;
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
                shouldDuckAndroid: true,
                playThroughEarpieceAndroid: false,
            });

            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );
            setRecording(recording);
            setIsRecording(true);
        } catch (err) {
            console.error('Failed to start recording', err);
        }
    };

    const stopRecording = async () => {
        if (!recording) return;

        setIsRecording(false);
        try {
            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();
            if (uri) {
                const response = await fetch(uri);
                const blob = await response.blob();
                const file = {
                    uri,
                    name: `audio-${Date.now()}.m4a`,
                    type: 'audio/m4a',
                    size: blob.size,
                } as any;
                await uploadAndSendAttachment(file, 'audio');
            }
        } catch (err) {
            console.error('Failed to stop recording', err);
        }
        setRecording(null);
    };

    const uploadAndSendAttachment = async (asset: any, fileType: string) => {
        try {
            const formData = new FormData();
            formData.append('attachment', {
                uri: asset.uri,
                name: asset.fileName || asset.name || `file-${Date.now()}`,
                type: asset.type || asset.mimeType || 'application/octet-stream',
            } as any);

            const response = await chatAPI.uploadAttachment(formData);

            const attachment = {
                fileUrl: response.data.fileUrl,
                fileType,
                fileName: asset.fileName || asset.name || `file-${Date.now()}`,
                fileSize: asset.fileSize || asset.size || 0,
            };

            socketSendMessage(chatId!, user!._id, '', attachment);
        } catch (error: any) {
            console.error('Error uploading attachment:', error);
            Alert.alert('Error', `Failed to upload attachment: ${error.message || 'Unknown error'}`);
        }
    };

    if (isLoading) {
        return (
            <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor}}>
                <ActivityIndicator size="large" color={primaryColor} />
            </View>
        )
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor }}>
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
                style={styles.container}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                <ThemedView style={[styles.activeHeader, { borderBottomColor: borderColor }]}>
                    <TouchableOpacity onPress={() => router.back()}>
                        <Ionicons name="chevron-back" size={24} color={primaryColor} />
                    </TouchableOpacity>
                     <View style={styles.headerTitle}>
                        <ThemedText type="title" style={{ fontFamily: typography.families.bold }}>
                            {chat?.isGroupChat ? (chat?.name || 'Group Chat') : (chat?.participants.find(p => p._id !== user?._id)?.username || 'Chat')}
                        </ThemedText>
                        {chat?.isGroupChat && (
                            <ThemedText style={[styles.participantsCount, { color: lightTextColor }]}>
                                {chat.participants.length} members
                            </ThemedText>
                        )}
                        {typingUser && <ThemedText style={styles.typingIndicator}>{typingUser} is typing...</ThemedText>}
                    </View>
                    <TouchableOpacity>
                        <Ionicons name="settings" size={24} color={primaryColor} />
                    </TouchableOpacity>
                </ThemedView>

                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={({ item }) => {
                        const sender = item.sender as User;
                        const isMe = sender._id === user?._id;
                        return (
                            <MessageItem
                                item={item}
                                isMe={isMe}
                                primaryColor={primaryColor}
                                white={white}
                                textColor={textColor}
                                lightTextColor={lightTextColor}
                            />
                        );
                    }}
                    keyExtractor={(item) => item._id}
                    contentContainerStyle={styles.messageList}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
                    onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
                    ListEmptyComponent={<ThemedText style={{textAlign: 'center', color: lightTextColor, marginTop: spacing.xl}}>No messages yet. Be the first to say hi!</ThemedText>}
                />

                <ThemedView style={[styles.inputArea, { borderTopColor: borderColor, backgroundColor }]}>
                    <TouchableOpacity style={styles.attachBtn} onPress={pickImage}>
                        <Ionicons name="image" size={24} color={lightTextColor} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.attachBtn} onPress={pickDocument}>
                        <Ionicons name="document-text" size={24} color={lightTextColor} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.attachBtn, isRecording && { backgroundColor: 'red', borderRadius: borderRadius.md }]}
                        onPress={isRecording ? stopRecording : startRecording}
                    >
                        <Ionicons name="mic" size={24} color={isRecording ? white : lightTextColor} />
                    </TouchableOpacity>
                    <TextInput
                        style={[styles.textInput, { backgroundColor: surfaceColor, borderColor: borderColor, color: textColor }]}
                        placeholder="Message..."
                        placeholderTextColor={lightTextColor}
                        value={message}
                        onChangeText={handleTyping}
                        multiline
                    />
                    <TouchableOpacity
                        style={[styles.sendCircle, { backgroundColor: primaryColor }, !message.trim() && { backgroundColor: lightTextColor }]}
                        disabled={!message.trim()}
                        onPress={handleSendMessage}
                    >
                        <Ionicons name="send" size={20} color={white} />
                    </TouchableOpacity>
                </ThemedView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

interface MessageItemProps {
    item: ChatMessage;
    isMe: boolean;
    primaryColor: string;
    white: string;
    textColor: string;
    lightTextColor: string;
}

const MessageItem: React.FC<MessageItemProps> = React.memo(({ item, isMe, primaryColor, white, textColor, lightTextColor }) => {
    const messageBubbleColor = isMe ? primaryColor : useThemeColor('surfaceLight');
    const messageTextColor = isMe ? white : textColor;
    const messageTimeColor = isMe ? white : lightTextColor;

    const renderAttachment = () => {
        if (!item.attachment) return null;

        const { fileUrl, fileType, fileName, fileSize } = item.attachment;
        const fullUrl = getImageUrl(fileUrl);

        if (!fullUrl) return null;

        switch (fileType) {
            case 'image':
                return (
                    <TouchableOpacity onPress={() => Linking.openURL(fullUrl)}>
                        <Image source={{ uri: fullUrl }} style={styles.attachmentImage} />
                    </TouchableOpacity>
                );
            case 'video':
                return (
                    <TouchableOpacity onPress={() => Linking.openURL(fullUrl)} style={styles.attachmentContainer}>
                        <Ionicons name="play-circle" size={24} color={messageTextColor} />
                        <ThemedText style={[styles.attachmentText, { color: messageTextColor }]}>
                            Video: {fileName}
                        </ThemedText>
                    </TouchableOpacity>
                );
            case 'audio':
                return (
                    <TouchableOpacity onPress={() => Linking.openURL(fullUrl)} style={styles.attachmentContainer}>
                        <Ionicons name="musical-notes" size={24} color={messageTextColor} />
                        <ThemedText style={[styles.attachmentText, { color: messageTextColor }]}>
                            Audio: {fileName}
                        </ThemedText>
                    </TouchableOpacity>
                );
            case 'document':
                return (
                    <TouchableOpacity onPress={() => Linking.openURL(fullUrl)} style={styles.attachmentContainer}>
                        <Ionicons name="document" size={24} color={messageTextColor} />
                        <ThemedText style={[styles.attachmentText, { color: messageTextColor }]}>
                            {fileName}
                        </ThemedText>
                    </TouchableOpacity>
                );
            default:
                return null;
        }
    };

    return (
        <ThemedView style={[styles.messageBubble, isMe ? styles.myMessage : styles.theirMessage, { backgroundColor: messageBubbleColor }]}>
            {item.content && (
                <ThemedText style={[styles.messageText, { color: messageTextColor }]}>
                    {item.content}
                </ThemedText>
            )}
            {renderAttachment()}
            <ThemedText style={[styles.messageTime, { color: messageTimeColor }]}>
                {new Date(item.createdAt || item.timestamp || Date.now()).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </ThemedText>
        </ThemedView>
    );
});

const styles = StyleSheet.create({
    container: { flex: 1 },
    activeHeader: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        paddingHorizontal: spacing.md, 
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
    },
    headerTitle: {
        alignItems: 'center',
    },
    typingIndicator: {
        fontSize: typography.sizes.caption,
        color: 'gray',
    },
    participantsCount: {
        fontSize: typography.sizes.caption,
        color: 'gray',
    },
    messageList: { padding: spacing.md, gap: spacing.sm },
    messageBubble: { maxWidth: '80%', padding: spacing.md, borderRadius: borderRadius.lg },
    theirMessage: { alignSelf: 'flex-start', borderBottomLeftRadius: borderRadius.sm },
    myMessage: { alignSelf: 'flex-end', borderBottomRightRadius: borderRadius.sm },
    messageText: { fontSize: typography.sizes.body1 },
    messageTime: { fontSize: typography.sizes.tiny, marginTop: spacing.xs, alignSelf: 'flex-end' },
    
    inputArea: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        padding: spacing.sm, 
        paddingBottom: Platform.OS === 'ios' ? spacing.lg : spacing.sm,
        borderTopWidth: 1,
    },
    attachBtn: { padding: spacing.xs },
    textInput: { 
        flex: 1, 
        borderRadius: borderRadius.lg, 
        paddingHorizontal: spacing.md, 
        paddingVertical: Platform.OS === 'ios' ? spacing.sm : 0, 
        marginHorizontal: spacing.sm,
        fontSize: typography.sizes.body1,
        maxHeight: 100,
        borderWidth: 1,
    },
    sendCircle: { width: 35, height: 35, borderRadius: borderRadius.round, justifyContent: 'center', alignItems: 'center' },
    attachmentImage: { width: 200, height: 200, borderRadius: borderRadius.md, marginVertical: spacing.xs },
    attachmentContainer: { flexDirection: 'row', alignItems: 'center', padding: spacing.sm, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: borderRadius.md, marginVertical: spacing.xs },
    attachmentText: { fontSize: typography.sizes.body2, marginLeft: spacing.sm, flex: 1 },
});