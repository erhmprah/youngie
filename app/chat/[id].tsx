import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, TextInput, FlatList, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/contexts/AuthContext';
import { chatAPI, getImageUrl } from '@/utils/api';
import { getSocket } from '@/utils/socket';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { spacing, borderRadius, typography } from '@/constants/design-tokens';

interface Message {
  _id: string;
  sender: {
    _id: string;
    username: string;
    profilePhoto?: string;
  };
  content: string;
  createdAt: string;
  isAnonymous?: boolean;
  chat: string;
}

interface Chat {
  _id:string;
  name: string;
  participants: any[];
  messages: Message[];
  relatedCommunity?: any;
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const router = useRouter();
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  const backgroundColor = useThemeColor('background');
  const primaryColor = useThemeColor('primary');
  const textColor = useThemeColor('text');
  const lightTextColor = useThemeColor('lightText');
  const surfaceColor = useThemeColor('surface');
  const white = useThemeColor('white');
  const myMessageColor = useThemeColor('primary');
  const otherMessageColor = useThemeColor('surface');

  useEffect(() => {
    const fetchChat = async () => {
      try {
        const response = await chatAPI.getChat(id as string);
        setChat(response.data);
        setMessages(response.data.messages || []);
        chatAPI.markAsRead(id as string); // Mark as read when opening
      } catch (error) {
        console.error('Failed to fetch chat:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchChat();

    const socket = getSocket();
    if (socket) {
      socket.emit('joinChat', id);

      const handleNewMessage = (message: Message) => {
        if (message.chat === id) {
          setMessages(prevMessages => [...prevMessages, message]);
          chatAPI.markAsRead(id as string); // Mark as read if receiving while open
        }
      };

      socket.on('newMessage', handleNewMessage);

      return () => {
        socket.off('newMessage', handleNewMessage);
        socket.emit('leaveChat', id);
      };
    }
  }, [id]);

  useEffect(() => {
    if (messages.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const handleSend = async () => {
    if (newMessage.trim() === '') return;

    const messageData = {
      content: newMessage,
      isAnonymous: chat?.relatedCommunity ? isAnonymous : false,
    };

    try {
      await chatAPI.sendMessage(id as string, messageData);
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMyMessage = item.sender._id === user?._id;
    
    // Handle anonymous display logic client-side for real-time messages
    const showAnonymous = item.isAnonymous && !isMyMessage;
    const displayName = showAnonymous ? 'Anonymous' : item.sender.username;
    const displayPhoto = showAnonymous ? undefined : item.sender.profilePhoto;

    return (
      <View style={[styles.messageContainer, isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer]}>
        {!isMyMessage && (
          <View style={[styles.avatarContainer, { backgroundColor: surfaceColor }]}>
            {!showAnonymous && displayPhoto ? (
              <Image source={{ uri: getImageUrl(displayPhoto) }} style={styles.avatar} />
            ) : (
              <IconSymbol name="person.fill" size={18} color={lightTextColor} />
            )}
          </View>
        )}
        <View style={[styles.bubble, { backgroundColor: isMyMessage ? myMessageColor : otherMessageColor }]}>
          {!isMyMessage && (
            <ThemedText style={[styles.username, { color: primaryColor }]}>
              {displayName}
            </ThemedText>
          )}
          <ThemedText style={{ color: isMyMessage ? white : textColor }}>{item.content}</ThemedText>
          <ThemedText style={[styles.timestamp, { color: isMyMessage ? white + '99' : lightTextColor }]}>
            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </ThemedText>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return <ActivityIndicator style={{ flex: 1 }} size="large" color={primaryColor} />;
  }

  const chatName = chat?.relatedCommunity?.name || chat?.name || chat?.participants.filter(p => p._id !== user?._id).map(p => p.username).join(', ');
  const chatImage = chat?.relatedCommunity?.image || chat?.participants.find(p => p._id !== user?._id)?.profilePhoto;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor }}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        <ThemedView style={styles.container}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: surfaceColor }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <IconSymbol name="chevron.left" size={28} color={textColor} />
            </TouchableOpacity>
            {chatImage && <Image source={{ uri: getImageUrl(chatImage) }} style={styles.headerAvatar} />}
            <ThemedText type="title" style={styles.headerTitle} numberOfLines={1}>{chatName}</ThemedText>
          </View>

          {/* Messages */}
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />

          {/* Input */}
          <View style={[styles.inputContainer, { backgroundColor: surfaceColor, borderTopColor: backgroundColor }]}>
            {chat?.relatedCommunity && (
              <TouchableOpacity onPress={() => setIsAnonymous(!isAnonymous)} style={styles.anonToggle}>
                <IconSymbol name="eyeglasses" size={24} color={isAnonymous ? primaryColor : lightTextColor} />
              </TouchableOpacity>
            )}
            <TextInput
              style={[styles.input, { color: textColor, backgroundColor }]}
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder="Type a message..."
              placeholderTextColor={lightTextColor}
              multiline
            />
            <TouchableOpacity onPress={handleSend} style={[styles.sendButton, { backgroundColor: primaryColor }]}>
              <IconSymbol name="arrow.up" size={20} color={white} />
            </TouchableOpacity>
          </View>
        </ThemedView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1 },
  backButton: { paddingRight: spacing.md },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: spacing.md },
  headerTitle: { flex: 1, fontFamily: typography.families.bold },
  listContent: { padding: spacing.md },
  messageContainer: { flexDirection: 'row', marginBottom: spacing.md, maxWidth: '80%' },
  myMessageContainer: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  otherMessageContainer: { alignSelf: 'flex-start' },
  avatarContainer: { width: 36, height: 36, borderRadius: 18, marginRight: spacing.sm, justifyContent: 'center', alignItems: 'center', alignSelf: 'flex-end' },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  bubble: { padding: spacing.md, borderRadius: borderRadius.lg },
  username: { fontFamily: typography.families.bold, marginBottom: spacing.xs, fontSize: typography.sizes.caption },
  timestamp: { fontSize: 10, marginTop: spacing.xs, alignSelf: 'flex-end', opacity: 0.7 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderTopWidth: 1 },
  anonToggle: { padding: spacing.sm },
  input: { flex: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.xl, maxHeight: 100, fontSize: typography.sizes.body1, marginHorizontal: spacing.sm },
  sendButton: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
});