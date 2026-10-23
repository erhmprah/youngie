import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { StyleSheet, View, TextInput, FlatList, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Image, Alert, Text , Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { VideoView, useVideoPlayer } from 'expo-video';
import { AudioModule, setAudioModeAsync, requestRecordingPermissionsAsync, createAudioPlayer, RecordingPresets } from 'expo-audio';
import type { AudioRecorder, AudioPlayer, AudioStatus } from 'expo-audio';
import { useLocalSearchParams, useRouter, useFocusEffect, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/contexts/AuthContext';
import { chatAPI, getImageUrl } from '@/utils/api';
import { toUserCopy } from '@/utils/error-messages';
import { cachedChatAPI } from '@/utils/cachedApi';
import { getSocket, joinChat, leaveChat, sendMessage, sendTypingStart, sendTypingStop, onMessageReceived, offMessageReceived, onMessagesRead, offMessagesRead, onUserTyping, offUserTyping, onUserStopTyping, offUserStopTyping } from '@/utils/socket';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ChatSettingsModal } from '@/components/chat-settings-modal';
import { MediaPreviewModal } from '@/components/media-preview-modal';
import { MediaPickerButton, MediaPickerResult } from '@/components/media-picker-button';
import { spacing, borderRadius, typography } from '@/constants/design-tokens';
import { Swipeable, RectButton } from 'react-native-gesture-handler';

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
   isDeleted?: boolean;
   readBy?: string[];
    replyTo?: {
      _id: string;
      sender: {
        username: string;
      };
      content: string;
      attachment?: {
        fileName: string;
        url: string;
        type: string;
        size: number;
        duration?: number;
      } | string;
    };
   attachment?: {
     fileName: string;
     url: string;
     type: string;
     size: number;
     duration?: number;
   } | string;
    isSending?: boolean;
    sendError?: boolean;
    messageType?: 'text' | 'call';
    callType?: 'voice' | 'video';
    callStatus?: 'missed' | 'declined' | 'completed' | 'cancelled';
    callDuration?: number;
  }

interface User {
   _id: string;
   username: string;
   avatar?: string;
   profilePhoto?: string;
   isOnline?: boolean;
   lastSeen?: string;
}

interface Chat {
   _id:string;
   name: string;
   participants: any[];
   messages: Message[];
   relatedCommunity?: any;
   isGroupChat?: boolean;
}

const InlineVideoPreview = ({ 
  uri, 
  containerStyle, 
  contentStyle, 
  showPlayIcon = true, 
  playIconSize = 24, 
  playIconStyle, 
  autoPlay = false,
  playIconColor = '#fff'
}: { 
  uri: string; 
  containerStyle: any; 
  contentStyle?: any; 
  showPlayIcon?: boolean; 
  playIconSize?: number; 
  playIconStyle?: any;
  autoPlay?: boolean;
  playIconColor?: string;
}) => {
  const player = useVideoPlayer({ uri });
  useEffect(() => {
    if (autoPlay) {
      player.play();
    }
  }, [player, uri, autoPlay]);
  return (
    <View style={containerStyle}>
      <VideoView player={player} style={contentStyle} contentFit="cover" nativeControls={false} />
      {showPlayIcon && (
        <View style={playIconStyle}>
          <IconSymbol name="play.fill" size={playIconSize} color={playIconColor} />
        </View>
      )}
    </View>
  );
};

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const router = useRouter();
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagePage, setMessagePage] = useState(1);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [messageToForward, setMessageToForward] = useState<Message | null>(null);
  const [showMessageOptionsModal, setShowMessageOptionsModal] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [deleteMessageData, setDeleteMessageData] = useState<Message | null>(null);
  const [userChats, setUserChats] = useState<any[]>([]);
  const [forwardSearchText, setForwardSearchText] = useState('');
  const [attachment, setAttachment] = useState<any>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [imageErrors, setImageErrors] = useState<Map<string, boolean>>(new Map());
  const [showMediaPreview, setShowMediaPreview] = useState(false);
  const [selectedMediaAttachment, setSelectedMediaAttachment] = useState<any>(null);
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState<string>('');
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<AudioRecorder | null>(null);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [audioStatus, setAudioStatus] = useState<Record<string, any>>({});
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const highlightedMessageTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [nowTick, setNowTick] = useState<number>(Date.now());

  // Format last seen time to show relative time (e.g., "2 hours ago", "Yesterday")
  const formatLastSeen = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 60) {
      return 'Last seen just now';
    } else if (diffMinutes < 60) {
      return `Last seen ${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `Last seen ${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffDays === 1) {
      return 'Last seen yesterday';
    } else if (diffDays < 7) {
      return `Last seen ${diffDays} days ago`;
    } else {
      // For older dates, show the actual date
      return `Last seen ${date.toLocaleDateString()}`;
    }
  };

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const swipeRefs = useRef(new Map<string, Swipeable>());
  const soundRefs = useRef(new Map<string, AudioPlayer>());
  const recordingRef = useRef<AudioRecorder | null>(null);
  const statusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRecordingDesired = useRef(false);
  const [meteringLevels, setMeteringLevels] = useState<number[]>([]);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const previewSound = useRef<AudioPlayer | null>(null);
  const [previewStatus, setPreviewStatus] = useState<any>(null);

  const releasePlayer = useCallback((player: AudioPlayer | null) => {
    if (!player) return;
    const sub = (player as any).__statusSub || (player as any).__previewSub;
    if (sub) {
      try { sub.remove(); } catch (e) { }
      (player as any).__statusSub = null;
      (player as any).__previewSub = null;
    }
    try { player.pause(); } catch (e) { }
    try { player.seekTo(0); } catch (e) { }
    try { player.remove(); } catch (e) { }
  }, []);

  // Stop every audio player (message playback + unsent recording preview).
  // Audio must not survive closing the chat or navigating away.
  const stopAllAudioPlayback = useCallback(() => {
    if (previewSound.current) {
      releasePlayer(previewSound.current);
      previewSound.current = null;
    }
    soundRefs.current.forEach((sound) => releasePlayer(sound));
    soundRefs.current.clear();
    setPlayingAudio(null);
    setPreviewStatus(null);
    setAudioStatus({});
  }, [releasePlayer]);

  // The chat screen stays mounted inside the navigation stack, so unmount
  // cleanup alone never runs when the user navigates away.
  useFocusEffect(
    useCallback(() => {
      return () => {
        stopAllAudioPlayback();
      };
    }, [stopAllAudioPlayback])
  );

  const backgroundColor = useThemeColor('background');
  const primaryColor = useThemeColor('primary');
  const textColor = useThemeColor('text');
  const lightTextColor = useThemeColor('lightText');
  const surfaceColor = useThemeColor('surface');
  const white = useThemeColor('white');
  const errorColor = useThemeColor('error');
  const myMessageColor = useThemeColor('primary');
  const otherMessageColor = useThemeColor('surface');

  const getFontSize = () => {
    switch (fontSize) {
      case 'small':
        return typography.sizes.body2;
      case 'large':
        return typography.sizes.heading4;
      case 'medium':
      default:
        return typography.sizes.body1;
    }
  };

  const formatDuration = (millis: number) => {
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatCallDuration = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const renderCallLog = (item: Message) => {
    const isMyMessage = item.sender._id === user?._id;
    const incoming = !isMyMessage;
    const status = item.callStatus;
    const duration = item.callDuration || 0;

    let label: string;
    if (status === 'completed') {
      label = (incoming ? 'Incoming voice call' : 'Outgoing voice call') + (duration > 0 ? ` · ${formatCallDuration(duration)}` : '');
    } else if (status === 'missed') {
      label = incoming ? 'Missed voice call' : 'Outgoing voice call';
    } else if (status === 'declined') {
      label = incoming ? 'You declined the call' : 'Call declined';
    } else {
      label = incoming ? 'Incoming voice call' : 'Cancelled voice call';
    }

    const isFailure = status === 'missed' || status === 'declined';
    const iconName = isFailure ? 'phone.down.fill' : 'phone.fill';
    const iconColor = isFailure ? errorColor : primaryColor;

    return (
      <View style={styles.callLogContainer}>
        <View style={[styles.callLogPill, { backgroundColor: surfaceColor }]}>
          <IconSymbol name={iconName} size={16} color={iconColor} />
          <ThemedText style={[styles.callLogText, { color: isFailure ? errorColor : textColor }]}>
            {label}
          </ThemedText>
          <ThemedText style={[styles.callLogTime, { color: lightTextColor }]}>
            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </ThemedText>
        </View>
      </View>
    );
  };

  const styles = createStyles({
    primaryColor,
    white,
    surfaceColor,
    textColor,
    lightTextColor,
    myMessageColor,
    otherMessageColor,
    backgroundColor,
  });

  useEffect(() => {
    const fetchChat = async () => {
      try {
        const response = await chatAPI.getChat(id as string, 1, 20);
        setChat(response.data);
        setMessages(response.data.messages || []);
        setMessagePage(1);
        setHasMoreMessages(response.data.messagesPagination?.hasNextPage || false);
        cachedChatAPI.markAsRead(id as string); // Mark as read when opening
      } catch (error) {
      } finally {
        setIsLoading(false);
      }
    };

    const fetchUserChats = async () => {
      try {
        const response = await chatAPI.getUserChats(user?._id || '', 1, 20);
        setUserChats(response.data.data || []);
      } catch (error) {
      }
    };

    fetchChat();
    if (user?._id) fetchUserChats();

    // Join the chat room via socket
    joinChat(id as string);
    const handleNewMessage = (message: Message) => {
      if (message.chat === id) {
        setMessages(prevMessages => {
          // Check if this replaces a temporary message (server echoes tempId as _id)
          const tempIndex = prevMessages.findIndex(msg => msg._id === message._id && msg._id.startsWith('temp-'));
          if (tempIndex !== -1) {
            const newMessages = [...prevMessages];
            newMessages[tempIndex] = message;
            return newMessages;
          }

          // Fallback: replace a temporary message by sender + content (handles media-only messages)
          const existingIndex = prevMessages.findIndex(msg =>
            msg._id.startsWith('temp-') &&
            msg.sender._id === message.sender._id &&
            (msg.content || '') === (message.content || '')
          );
          if (existingIndex !== -1) {
            const newMessages = [...prevMessages];
            newMessages[existingIndex] = message;
            return newMessages;
          }

          // Prevent duplicate messages from being added (same _id already present)
          if (prevMessages.some(msg => msg._id === message._id)) {
            return prevMessages;
          }

          // Add as new message
          return [...prevMessages, message];
        });
        cachedChatAPI.markAsRead(id as string); // Mark as read if receiving while open
      }
    };

    // Listen for new messages
    onMessageReceived(handleNewMessage);

    const handleMessageDeleted = (data: { messageId: string; chatId: string }) => {
      if (data.chatId === id) {
        setMessages(prevMessages => prevMessages.map(msg =>
          msg._id === data.messageId ? { ...msg, content: 'Message deleted', isDeleted: true } : msg
        ));
      }
    };

    const handleMessagesRead = (data: { userId: string; chatId: string }) => {
      if (data.chatId === id) {
        // Update readBy for messages
        setMessages(prevMessages => prevMessages.map(msg =>
          msg.sender._id === user?._id && !msg.readBy?.includes(data.userId) ? { ...msg, readBy: [...(msg.readBy || []), data.userId] } : msg
        ));
      }
    };

    onMessagesRead(handleMessagesRead);

    // Typing listeners
    const handleUserTyping = (data: { username: string }) => {
      setIsTyping(true);
      setTypingUser(data.username);
    };

    const handleUserStopTyping = () => {
      setIsTyping(false);
      setTypingUser('');
    };

    onUserTyping(handleUserTyping);
    onUserStopTyping(handleUserStopTyping);

    const socket = getSocket();
    const handleStatusChange = (data: { userId: string; isOnline: boolean; lastSeen: string }) => {
      setChat(prev => {
        if (!prev) return null;
        return {
          ...prev,
          participants: prev.participants.map(p => 
            p._id === data.userId 
              ? { ...p, isOnline: data.isOnline, lastSeen: data.lastSeen }
              : p
          )
        };
      });
    };

    if (socket) {
      socket.on('user_status_change', handleStatusChange);
    }

    return () => {
      offMessageReceived();
      offMessagesRead();
      offUserTyping();
      offUserStopTyping();
      if (socket) {
        socket.off('user_status_change', handleStatusChange);
      }
      leaveChat(id as string);

      // Clean up all audio players to prevent leaks and background playback
      stopAllAudioPlayback();
      
      // Clean up typing timeout if pending
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }

      // Clean up highlighted message timeout if pending
      if (highlightedMessageTimeout.current) {
        clearTimeout(highlightedMessageTimeout.current);
        highlightedMessageTimeout.current = null;
      }
    };
  }, [id]);

  const loadOlderMessages = useCallback(async () => {
    if (loadingOlder || !hasMoreMessages) return;
    setLoadingOlder(true);
    try {
      const nextPage = messagePage + 1;
      const response = await chatAPI.getChat(id as string, nextPage, 20);
      const older = response.data.messages || [];
      setMessages(prev => [...older, ...prev]);
      setMessagePage(nextPage);
      setHasMoreMessages(response.data.messagesPagination?.hasNextPage || false);
    } catch (error) {
    } finally {
      setLoadingOlder(false);
    }
  }, [id, messagePage, hasMoreMessages, loadingOlder]);

  // Periodically re-render so the "last seen X minutes ago" text stays current
  // while the user is viewing the chat.
  useEffect(() => {
    const interval = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages]);

  useEffect(() => {
    const loadFontSize = async () => {
      if (user?._id && chat?._id) {
        try {
          const settingsKey = `chat_settings_${user._id}_${chat._id}`;
          const settings = await AsyncStorage.getItem(settingsKey);
          if (settings) {
            const parsed = JSON.parse(settings);
            setFontSize(parsed.fontSize || 'medium');
          }
        } catch (error) {
        }
      }
    };

    if (chat?._id) {
      loadFontSize();
    }
  }, [chat?._id, user?._id]);

  const handleRetrySend = async (message: Message) => {
    // Reset error state
    setMessages(prevMessages => prevMessages.map(msg =>
      msg._id === message._id ? { ...msg, isSending: true, sendError: false } : msg
    ));

    try {
      // Extract data from the message
      const messageData = {
        content: message.content,
        isAnonymous: message.isAnonymous,
        replyTo: message.replyTo?._id,
        attachment: message.attachment
      };

      // Send via REST API
      await cachedChatAPI.sendMessage(id as string, messageData);

      // Emit via socket
      sendMessage(id as string, user!._id, message.content, message.replyTo?._id, message.isAnonymous, message.attachment);

      // Mark as sent
      setMessages(prevMessages => prevMessages.map(msg =>
        msg._id === message._id ? { ...msg, isSending: false } : msg
      ));
    } catch (error) {
      setMessages(prevMessages => prevMessages.map(msg =>
        msg._id === message._id ? { ...msg, isSending: false, sendError: true } : msg
      ));
    }
  };

  const handleSend = async () => {
    if ((newMessage.trim() === '' && !attachment) || !user?._id) return;

    // Capture current state values before clearing them
    const currentAttachment = attachment;
    const currentMessageContent = newMessage;
    const currentReplyTo = replyTo;
    const currentIsAnonymous = chat?.relatedCommunity ? isAnonymous : false;

    // Determine type for local display and upload
    let type = currentAttachment?.mimeType;
    if (currentAttachment && !type) {
      if (currentAttachment.type && currentAttachment.type.includes('/')) {
        type = currentAttachment.type;
      } else {
        const uriParts = currentAttachment.uri.split('.');
        const ext = uriParts[uriParts.length - 1]?.toLowerCase();
        if (ext === 'png') type = 'image/png';
        else if (ext === 'gif') type = 'image/gif';
        else if (ext === 'jpg' || ext === 'jpeg') type = 'image/jpeg';
        else if (ext === 'mp4') type = 'video/mp4';
        else if (ext === 'mov') type = 'video/quicktime';
        else if (ext === 'm4a') type = 'audio/m4a';
        else type = currentAttachment.type === 'video' ? 'video/mp4' : 'image/jpeg';
      }
    }

    // Create temporary message for immediate display
    const tempId = `temp-${Date.now()}`;
    const tempMessage: Message = {
      _id: tempId,
      sender: {
        _id: user._id,
        username: user.username,
        profilePhoto: user.profilePhoto,
      },
      content: currentMessageContent,
      createdAt: new Date().toISOString(),
      isAnonymous: currentIsAnonymous,
      chat: id as string,
      replyTo: currentReplyTo ? {
        _id: currentReplyTo._id,
        sender: { username: currentReplyTo.sender.username },
        content: currentReplyTo.content,
        attachment: currentReplyTo.attachment
      } : undefined,
      attachment: currentAttachment ? {
        url: currentAttachment.uri,
        fileName: currentAttachment.fileName || 'media',
        type: type || 'image/jpeg',
        size: currentAttachment.fileSize || 0,
        duration: currentAttachment.duration
      } : undefined,
      isSending: true,
    };

    // Immediately add message to local state
    setMessages(prevMessages => [...prevMessages, tempMessage]);

    // Clear input immediately
    setNewMessage('');
    setReplyTo(null);
    setAttachment(null);
    if (previewSound.current) {
      releasePlayer(previewSound.current);
      previewSound.current = null;
    }
    setPreviewStatus(null);

    let attachmentData = null;

    if (currentAttachment) {
      setIsUploading(true);
      try {
        const formData = new FormData();

        const ext = (type || '').split('/')[1] === 'quicktime' ? 'mov' : ((type || '').split('/')[1] || 'jpg');
        const name = currentAttachment.fileName || `media-${Date.now()}.${ext}`;

        let uri = currentAttachment.uri;
        if (Platform.OS === 'android' && !uri.startsWith('file://')) {
            uri = `file://${uri}`;
        }

        formData.append('file', {
          uri,
          name,
          type,
        } as any);

        const response = await chatAPI.uploadAttachment(formData, {
          onUploadProgress: (progressEvent: any) => {
            if (progressEvent.total) {
              const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setUploadProgress(percentCompleted);
            }
          },
        });
        attachmentData = response.data;
      } catch (error) {
        Alert.alert('Error', 'Failed to upload media');
        setUploadProgress(0);
        setIsUploading(false);
        // Mark message as having send error
        setMessages(prevMessages => prevMessages.map(msg =>
          msg._id === tempId ? { ...msg, isSending: false, sendError: true } : msg
        ));
        return;
      }
    }

    const messageData = {
      content: currentMessageContent,
      isAnonymous: currentIsAnonymous,
      replyTo: currentReplyTo ? currentReplyTo._id : undefined,
      attachment: attachmentData || undefined,
    };

    try {
      // Send via REST API for persistence
      await cachedChatAPI.sendMessage(id as string, messageData);

      // Also emit via socket for real-time updates to other users
      sendMessage(id as string, user._id, currentMessageContent, currentReplyTo?._id, messageData.isAnonymous, attachmentData, tempId);

      // Mark as sent successfully and clear input
      setMessages(prevMessages => prevMessages.map(msg =>
        msg._id === tempId ? { ...msg, isSending: false } : msg
      ));
      setUploadProgress(0);
      setIsUploading(false);
    } catch (error) {
      // Mark message as having send error instead of removing it
      setMessages(prevMessages => prevMessages.map(msg =>
        msg._id === tempId ? { ...msg, isSending: false, sendError: true } : msg
      ));
    }
  };

  const handleReply = (message: Message) => {
    setReplyTo(message);
  };

  const handleReplyPress = (messageId: string) => {
    if (highlightedMessageTimeout.current) {
      clearTimeout(highlightedMessageTimeout.current);
    }

    const targetIndex = messages.findIndex(msg => msg._id === messageId);
    if (targetIndex !== -1) {
      flatListRef.current?.scrollToIndex({
        index: targetIndex,
        animated: true,
        viewPosition: 0.5,
      });
      setHighlightedMessageId(messageId);
      highlightedMessageTimeout.current = setTimeout(() => {
        setHighlightedMessageId(null);
      }, 2000);
    }
  };

  const handleDelete = async (message: Message, deleteType: 'me' | 'everyone' = 'me') => {
    try {
      await chatAPI.deleteMessage(id as string, message._id, deleteType);
      setMessages(prevMessages => prevMessages.map(msg =>
        msg._id === message._id ? { ...msg, content: 'Message deleted', isDeleted: true } : msg
      ));
    } catch (error) {
      setMessages(prevMessages => prevMessages.map(msg =>
        msg._id === message._id ? { ...msg, content: 'Message deleted', isDeleted: true } : msg
      ));
    }
  };

  const showDeleteOptions = (message: Message) => {
    const isSent = message.sender._id === user?._id;
    const otherParticipant = chat?.participants?.find((p: any) => p._id !== user?._id);
    const isRead = otherParticipant && message.readBy?.some((id: string) => id === otherParticipant._id);

    if (isSent) {
      const canDeleteForEveryone = !isRead;
      if (canDeleteForEveryone) {
        setDeleteMessageData(message);
        setShowDeleteConfirmModal(true);
      } else {
        setDeleteMessageData(message);
        setShowDeleteConfirmModal(true);
      }
    } else {
      setDeleteMessageData(message);
      setShowDeleteConfirmModal(true);
    }
  };

  const handleForward = (message: Message) => {
    setMessageToForward(message);
    setShowForwardModal(true);
  };

  const showMessageOptions = (message: Message) => {
    if (message.isDeleted) return;
    setSelectedMessage(message);
    setShowMessageOptionsModal(true);
  };

  const pickMedia = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant permission to access media library');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: false,
      quality: 1,
      videoMaxDuration: 300, // 5 minutes max
    });
    if (!result.canceled) {
      setAttachment(result.assets[0]);
    }
  };

  // Handle unified media picker selection
  const handleMediaSelected = async (result: MediaPickerResult) => {
    if (result.type === 'photo' || result.type === 'video') {
      // Set the attachment directly
      setAttachment({
        uri: result.uri,
        fileName: result.fileName,
        type: result.type === 'photo' ? 'image/jpeg' : 'video/mp4',
      });
    }
    // For audio, the recording is handled separately via the recording callbacks
  };

  const startRecording = async () => {
    if (isRecording) return;

    if (previewSound.current) {
      releasePlayer(previewSound.current);
      previewSound.current = null;
      setPreviewStatus(null);
    }

    // Stop any playing audio messages to prevent conflicts
    if (playingAudio) {
      const sound = soundRefs.current.get(playingAudio);
      if (sound) {
        try { await sound.pause(); } catch (e) { }
      }
      setPlayingAudio(null);
    }

    const previousAttachment = attachment;
    setAttachment(null);
    isRecordingDesired.current = true;
    if (recordingRef.current) {
      try {
        await recordingRef.current.stop();
        recordingRef.current.release();
      } catch (error) {
      }
      recordingRef.current = null;
      setRecording(null);
    }
    try {
      const { status } = await requestRecordingPermissionsAsync();
      console.log('Audio permission status:', status);
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant permission to record audio');
        isRecordingDesired.current = false;
        setAttachment(previousAttachment);
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        interruptionMode: 'duckOthers',
        shouldRouteThroughEarpiece: false,
        allowsBackgroundRecording: true,
      });
      console.log('Audio mode set successfully');

      const recorder = new AudioModule.AudioRecorder({
        ...RecordingPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      });
      await recorder.prepareToRecordAsync();

      statusIntervalRef.current = setInterval(() => {
        const status = recorder.getStatus();
        if (status.isRecording) {
          if (status.metering !== undefined) setMeteringLevels(prev => [...prev.slice(-40), status.metering || -160]);
          setRecordingDuration(status.durationMillis);
        }
      }, 100);

      recorder.record();
      console.log('Recording created successfully');

      if (!isRecordingDesired.current) {
        if (statusIntervalRef.current) {
          clearInterval(statusIntervalRef.current);
          statusIntervalRef.current = null;
        }
        try {
          await recorder.stop();
          recorder.release();
        } catch (error) {
          // Ignore error if stopped too quickly
        }
        setAttachment(previousAttachment);
        return;
      }

      recordingRef.current = recorder;
      setRecording(recorder);
      setIsRecording(true);
    } catch (error: any) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', toUserCopy(error, 'We could not start recording. Please try again.'));
      isRecordingDesired.current = false;
      setIsRecording(false);
      setRecording(null);
      recordingRef.current = null;
      setAttachment(previousAttachment);
    }
  };

  const stopRecording = async () => {
    isRecordingDesired.current = false;
    if (statusIntervalRef.current) {
      clearInterval(statusIntervalRef.current);
      statusIntervalRef.current = null;
    }
    const currentRecording = recordingRef.current;
    if (!currentRecording) return;

    try {
      const duration = currentRecording.getStatus().durationMillis;

      // If recording is too short (e.g. < 500ms), discard it
      if (duration < 500) {
        try {
          await currentRecording.stop();
          currentRecording.release();
        } catch (error) {
          // Ignore "no valid audio data" error
        }
        recordingRef.current = null;
        setMeteringLevels([]);
        setRecordingDuration(0);
        setRecording(null);
        setIsRecording(false);
        return;
      }

      await currentRecording.stop();
      const uri = currentRecording.uri;
      currentRecording.release();
      recordingRef.current = null;
      setMeteringLevels([]);
      setRecordingDuration(0);
      setRecording(null);
      setIsRecording(false);

      if (uri) {
        // Create attachment object for the audio file
        const audioAttachment = {
          uri,
          fileName: `audio-${Date.now()}.m4a`,
          type: 'audio/m4a',
          fileSize: 0, // Will be set after upload
          duration,
        };
        setAttachment(audioAttachment);
      }
    } catch (error) {
      setIsRecording(false);
      recordingRef.current = null;
      setMeteringLevels([]);
      setRecordingDuration(0);
      setRecording(null);
    }
  };

  const playAudio = async (attachment: any, messageId: string) => {
    try {
      // Stop any currently playing audio
      if (playingAudio && playingAudio !== messageId) {
        const currentSound = soundRefs.current.get(playingAudio);
        if (currentSound) {
          releasePlayer(currentSound);
          soundRefs.current.delete(playingAudio);
          setAudioStatus(prev => {
            const next = { ...prev };
            delete next[playingAudio];
            return next;
          });
        }
      }

      let player = soundRefs.current.get(messageId);
      if (!player) {
        const rawUrl = attachment.url || attachment.uri;
        const normalizedUrl = rawUrl ? rawUrl.replace(/\\/g, '/') : '';
        const isLocalFile = /^(file|content):/.test(normalizedUrl);
        const isFullUrl = /^(http|https):/.test(normalizedUrl);

        const uri = (isLocalFile || isFullUrl)
          ? normalizedUrl
          : getImageUrl(normalizedUrl.startsWith('/') ? normalizedUrl : `/${normalizedUrl}`);

        if (!uri) throw new Error('Invalid audio URL');
        const created = createAudioPlayer({ uri });
        player = created;
        soundRefs.current.set(messageId, created);

        const onStatus = (status: AudioStatus) => {
          setAudioStatus(prev => ({ ...prev, [messageId]: status }));
          if (status.didJustFinish) {
            setPlayingAudio(null);
            created.seekTo(0);
          }
        };
        (created as any).__statusSub = created.addListener('playbackStatusUpdate', onStatus);
      }

      const status = player.currentStatus;
      if (status.playing) {
        player.pause();
        setPlayingAudio(null);
      } else {
        if (status.isLoaded && status.duration > 0 && status.currentTime >= status.duration) {
          player.seekTo(0);
        }
        player.play();
        setPlayingAudio(messageId);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to play audio');
    }
  };

  const handleVoiceCall = () => {
    const name = chat?.relatedCommunity?.name || chat?.name || chat?.participants.filter(p => p._id !== user?._id).map(p => p.username).join(', ') || 'Chat';
    const image = chat?.relatedCommunity?.image || chat?.participants.find(p => p._id !== user?._id)?.profilePhoto || '';

    router.push({
      pathname: '/chat/voice-call',
      params: { chatId: id as string, name, image }
    });
  };

  const togglePreviewPlayback = () => {
    if (!attachment || !attachment.uri) return;

    try {
      // Ensure audio mode is configured for playback
      setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: 'duckOthers',
        allowsRecording: false,
        shouldPlayInBackground: false,
        shouldRouteThroughEarpiece: false,
      });

      if (previewSound.current) {
        const status = previewSound.current.currentStatus;
        if (status.isLoaded) {
          if (status.playing) {
            previewSound.current.pause();
          } else {
            if (status.duration > 0 && status.currentTime >= status.duration) {
              previewSound.current.seekTo(0);
            }
            previewSound.current.play();
          }
          return;
        }
      }

      const player = createAudioPlayer({ uri: attachment.uri });
      previewSound.current = player;

      const onStatus = (status: AudioStatus) => {
        setPreviewStatus(status);
        if (status.isLoaded && status.didJustFinish) {
          player.seekTo(0);
        }
      };
      (player as any).__previewSub = player.addListener('playbackStatusUpdate', onStatus);
      player.play();
    } catch (error) {
    }
  };

  const renderRightActions = (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>, message: Message, close: () => void) => {
    const trans = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [0, 80],
      extrapolate: 'clamp',
    });
    return (
      <TouchableOpacity onPress={() => { handleReply(message); close(); }}>
        <Animated.View style={[styles.rightAction, { transform: [{ translateX: trans }] }]}>
          <IconSymbol name="arrowshape.turn.up.left" size={24} color={white} />
          <ThemedText style={styles.rightActionText}>Reply</ThemedText>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  const renderLeftActions = (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>, message: Message, close: () => void) => {
    const trans = dragX.interpolate({
      inputRange: [0, 80],
      outputRange: [-80, 0],
      extrapolate: 'clamp',
    });

    // Only show delete for own messages
    if (message.sender._id !== user?._id) {
      return (
        <TouchableOpacity onPress={() => { handleForward(message); close(); }}>
          <Animated.View style={[styles.leftAction, { transform: [{ translateX: trans }] }]}>
            <IconSymbol name="arrowshape.turn.up.right" size={24} color={white} />
            <ThemedText style={styles.leftActionText}>Forward</ThemedText>
          </Animated.View>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity onPress={() => { showDeleteOptions(message); close(); }}>
        <Animated.View style={[styles.leftAction, styles.deleteAction, { transform: [{ translateX: trans }] }]}>
          <IconSymbol name="trash" size={24} color={white} />
          <ThemedText style={styles.leftActionText}>Delete</ThemedText>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  const handleMediaPreview = (attachmentData: any, resolvedUrl?: string) => {
    // If a resolved URL is provided, use it as the uri
    if (resolvedUrl) {
        attachmentData = { ...attachmentData, uri: resolvedUrl };
    }
    setSelectedMediaAttachment(attachmentData);
    setShowMediaPreview(true);
  };

  const renderAttachment = (attachmentProp: any, messageId?: string) => {
    let attachment = attachmentProp;
    if (typeof attachment === 'string') {
      try {
        attachment = JSON.parse(attachment);
      } catch (e) {
        return null;
      }
    }

    if (!attachment || (!attachment.url && !attachment.uri)) return null;

    // Normalize path separators for Windows backends
    const normalizedUrl = attachment.url ? attachment.url.replace(/\\/g, '/') : attachment.uri;

    // Check if it's a local file (file:// or content://)
    const isLocalFile = /^(file|content):/.test(normalizedUrl);

    // Check if it's already a full URL (http, https)
    const isFullUrl = /^(http|https):/.test(normalizedUrl);

    // If it's a local file or full URL, use it directly. Otherwise, use getImageUrl.
    // Ensure path starts with / to avoid port concatenation issues (e.g. :5001uploads)
    const attachmentUrl = (isLocalFile || isFullUrl)
      ? normalizedUrl
      : getImageUrl(normalizedUrl.startsWith('/') ? normalizedUrl : `/${normalizedUrl}`);
    if (!attachmentUrl) return null;

    if (attachment.type && attachment.type.startsWith('image')) {
      const isImageError = imageErrors.get(normalizedUrl) || false;
      return !isImageError ? (
        <TouchableOpacity onPress={() => handleMediaPreview(attachment, attachmentUrl)}>
          <Image
            key={attachmentUrl}
            source={{ uri: attachmentUrl }}
            style={styles.attachmentImage}
            resizeMode="cover"
            onError={(e) => {
              setImageErrors(prev => new Map(prev).set(normalizedUrl, true));
            }}
          />
        </TouchableOpacity>
      ) : (
        <View style={styles.errorContainer}>
          <IconSymbol name="photo" size={48} color={lightTextColor} />
          <ThemedText style={{ color: lightTextColor, fontSize: 12, marginTop: 4 }}>
            Image failed to load
          </ThemedText>
        </View>
      );
    } else if (attachment.type && attachment.type.startsWith('video')) {
      return (
        <TouchableOpacity onPress={() => handleMediaPreview(attachment, attachmentUrl)} style={{ position: 'relative' }}>
          <InlineVideoPreview
            uri={attachmentUrl}
            containerStyle={styles.attachmentVideo}
            contentStyle={styles.attachmentVideo}
            playIconStyle={styles.videoPlayOverlay}
            playIconSize={48}
            playIconColor={white}
          />
        </TouchableOpacity>
      );
    } else if (attachment.type && attachment.type.startsWith('audio/')) {
      const status = audioStatus[messageId || ''];
      const isPlaying = playingAudio === messageId && status?.playing;
      const position = (status?.currentTime || 0) * 1000;
      const duration = (status?.duration || 0) * 1000 || attachment.duration || 0;
      const progress = duration > 0 ? position / duration : 0;

      // Fake waveform bars
      const bars = [3, 7, 4, 10, 6, 12, 8, 5, 9, 4, 8, 6, 10, 5, 7, 3, 6, 9, 4, 8];

      return (
        <View style={styles.audioContainer}>
          <TouchableOpacity style={styles.audioPlayButton} onPress={() => messageId && playAudio(attachment, messageId)}>
            <IconSymbol name={isPlaying ? "pause.fill" : "play.fill"} size={18} color={white} />
          </TouchableOpacity>
          <View style={styles.audioInfo}>
            <View style={styles.waveformContainer}>
              {bars.map((height, index) => (
                <View key={index} style={[styles.waveformBar, { height, backgroundColor: (index / bars.length) <= progress ? primaryColor : lightTextColor, opacity: (index / bars.length) <= progress ? 1 : 0.5 }]} />
              ))}
            </View>
            <ThemedText style={styles.audioDurationText}>
              {formatDuration(position)} / {formatDuration(duration)}
            </ThemedText>
          </View>
        </View>
      );
    } else {
      // For other file types, show a download link or file info
      return (
        <TouchableOpacity style={styles.fileContainer} onPress={() => {/* Handle file download/open */}}>
          <IconSymbol name="doc" size={24} color={textColor} />
          <View style={styles.fileInfo}>
            <ThemedText style={styles.fileName}>{attachment.fileName}</ThemedText>
            <ThemedText style={styles.fileSize}>{(attachment.size / 1024 / 1024).toFixed(2)} MB</ThemedText>
          </View>
        </TouchableOpacity>
      );
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    if (!item.sender) {
      item.sender = { _id: 'unknown', username: 'Unknown', profilePhoto: undefined };
    }
    const isMyMessage = item.sender._id === user?._id;
    const closeSwipe = () => swipeRefs.current.get(item._id)?.close();

    // Render call events (missed / declined / completed / cancelled) as a
    // centered system message inside the conversation thread.
    if (item.messageType === 'call' && item.callStatus) {
      return renderCallLog(item);
    }

    // Handle anonymous display logic client-side for real-time messages
    const showAnonymous = item.isAnonymous && !isMyMessage;
    const displayName = showAnonymous ? 'Anonymous' : item.sender.username;
    const displayPhoto = showAnonymous ? undefined : item.sender.profilePhoto;

    const messageContent = (
      <View style={[styles.messageContainer, isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer, item._id === highlightedMessageId && styles.highlightedMessage]}>
        {!isMyMessage && (
          <View style={[styles.avatarContainer, { backgroundColor: surfaceColor }]}>
            {!showAnonymous && displayPhoto ? (
              <Image source={{ uri: getImageUrl(displayPhoto) }} style={styles.avatar} />
            ) : (
              <IconSymbol name="person.fill" size={18} color={lightTextColor} />
            )}
          </View>
        )}
        <TouchableOpacity onLongPress={() => showMessageOptions(item)} style={[styles.bubble, { backgroundColor: isMyMessage ? myMessageColor : otherMessageColor }]}>
           {item.replyTo && item.replyTo.sender && (
             <TouchableOpacity onPress={() => handleReplyPress(item.replyTo!._id)} activeOpacity={0.7}>
               <View style={[styles.replyContainer, { backgroundColor: isMyMessage ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' }]}>
                 <View style={styles.replyHeader}>
                   <ThemedText style={[styles.replyLabel, { color: isMyMessage ? white : primaryColor }]}>
                     Replying to {item.replyTo.sender.username}
                   </ThemedText>
                    {item.replyTo.attachment && (() => {
                      let attachment: any = item.replyTo.attachment;
                      if (typeof attachment === 'string') {
                        try { attachment = JSON.parse(attachment); } catch (e) { return null; }
                      }
                      if (!attachment || !attachment.url) return null;
                      const normalizedUrl = attachment.url.replace(/\\/g, '/');
                      const attachmentUrl = normalizedUrl.startsWith('http') ? normalizedUrl : getImageUrl(normalizedUrl.startsWith('/') ? normalizedUrl : `/${normalizedUrl}`);
                      if (!attachmentUrl) return null;
                      if (attachment.type && attachment.type.startsWith('image')) {
                        return <Image source={{ uri: attachmentUrl }} style={styles.replyMediaThumb} resizeMode="cover" />;
                      }
                      if (attachment.type && attachment.type.startsWith('video')) {
                        return (
                          <InlineVideoPreview
                            uri={attachmentUrl}
                            containerStyle={styles.replyMediaThumb}
                            contentStyle={styles.replyMediaThumb}
                            playIconStyle={styles.replyMediaPlayOverlay}
                            playIconSize={12}
                            playIconColor={white}
                          />
                        );
                      }
                      return <View style={styles.replyMediaThumb}><IconSymbol name="doc" size={14} color={textColor} /></View>;
                    })()}
                 </View>
                 <ThemedText style={[styles.replyText, { color: isMyMessage ? white : textColor }]}>
                   {item.replyTo.content.length > 50 ? item.replyTo.content.substring(0, 50) + '...' : item.replyTo.content}
                 </ThemedText>
               </View>
             </TouchableOpacity>
           )}
          {!isMyMessage && (
            <ThemedText style={[styles.username, { color: primaryColor }]}>
              {displayName}
            </ThemedText>
          )}
          {!!item.content && (
            <ThemedText style={{
              color: isMyMessage ? white : textColor,
              fontSize: getFontSize(),
              marginBottom: item.attachment ? spacing.sm : 0
            }}>
              {item.content}
            </ThemedText>
          )}
          {item.attachment && renderAttachment(item.attachment, item._id)}
          <View style={styles.messageFooter}>
            <ThemedText style={[styles.timestamp, { color: isMyMessage ? white + '99' : lightTextColor }]}>
              {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </ThemedText>
            {isMyMessage && (
              <>
                {item.isSending && (
                  <ActivityIndicator size="small" color={white} style={{ marginRight: spacing.xs }} />
                )}
                {item.sendError && (
                  <TouchableOpacity onPress={() => handleRetrySend(item)} style={{ marginRight: spacing.xs }}>
                    <IconSymbol name="warning" size={16} color="#ff6b6b" />
                  </TouchableOpacity>
                )}
                {!item.isSending && !item.sendError && (
                  <IconSymbol
                    name="read"
                    size={16}
                    color={item.readBy && item.readBy.some(id => id !== user?._id) ? white : lightTextColor}
                  />
                )}
              </>
            )}
          </View>
        </TouchableOpacity>
      </View>
    );

    if (item.isDeleted) {
      return messageContent;
    }

    return (
      <Swipeable
        ref={(el) => {
          if (el) swipeRefs.current.set(item._id, el);
          else swipeRefs.current.delete(item._id);
        }}
        renderRightActions={(progress, dragX) => renderRightActions(progress, dragX, item, closeSwipe)}
        renderLeftActions={(progress, dragX) => renderLeftActions(progress, dragX, item, closeSwipe)}
        onSwipeableOpen={() => {}}
        friction={2}
        leftThreshold={40}
        rightThreshold={40}
      >
        {messageContent}
      </Swipeable>
    );
  };

  // Deduplicate messages by _id to guarantee unique keys for the FlatList
  const dedupedMessages = useMemo(() => {
    const seen = new Set<string>();
    const result: Message[] = [];
    for (const msg of messages) {
      if (msg._id && seen.has(msg._id)) continue;
      if (msg._id) seen.add(msg._id);
      result.push(msg);
    }
    return result;
  }, [messages]);

  if (isLoading) {
    return <ActivityIndicator style={{ flex: 1 }} size="large" color={primaryColor} />;
  }

  const chatName = chat?.relatedCommunity?.name || chat?.name || chat?.participants.filter(p => p._id !== user?._id).map(p => p.username).join(', ');
  const chatImage = chat?.relatedCommunity?.image || chat?.participants.find(p => p._id !== user?._id)?.profilePhoto;
  const otherParticipant = chat?.participants.find(p => p._id !== user?._id);
  const isDirectChat = chat && !chat.isGroupChat && chat.participants.length === 2;
  const isOnline = otherParticipant?.isOnline;
  const lastSeen = otherParticipant?.lastSeen;
  // Reference nowTick so the relative "last seen" text refreshes in place.
  void nowTick;

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
              <View style={styles.headerTitleContainer}>
                  <ThemedText type="title" style={styles.headerTitle} numberOfLines={1}>{chatName}</ThemedText>
                  {isDirectChat && (
                      <ThemedText style={[styles.statusText, { color: lightTextColor }]}>
                          {isTyping ? `${typingUser} is typing...` : isOnline ? 'Online' : lastSeen ? formatLastSeen(lastSeen) : 'Offline'}
                      </ThemedText>
                  )}
                  {!isDirectChat && isTyping && (
                      <ThemedText style={[styles.statusText, { color: lightTextColor }]}>
                          {typingUser} is typing...
                      </ThemedText>
                  )}
              </View>
              {isDirectChat && (
                  <TouchableOpacity onPress={handleVoiceCall} style={styles.voiceCallButton}>
                      <IconSymbol name="phone" size={24} color={textColor} />
                  </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.settingsButton}>
                  <IconSymbol name="settings" size={24} color={textColor} />
              </TouchableOpacity>
          </View>

          {/* Messages */}
          <FlatList
            ref={flatListRef}
            data={dedupedMessages}
            renderItem={renderMessage}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              hasMoreMessages ? (
                <TouchableOpacity
                  style={styles.loadOlderContainer}
                  disabled={loadingOlder}
                  onPress={loadOlderMessages}
                >
                  {loadingOlder ? (
                    <ActivityIndicator size="small" color={primaryColor} />
                  ) : (
                    <ThemedText style={{ color: primaryColor, textAlign: 'center' }}>
                      Load earlier messages
                    </ThemedText>
                  )}
                </TouchableOpacity>
              ) : null
            }
            // Performance optimization props
            initialNumToRender={20}
            maxToRenderPerBatch={10}
            windowSize={10}
            updateCellsBatchingPeriod={50}
            removeClippedSubviews={true}
          />

          {/* Reply Context */}
          {replyTo && (
            <View style={styles.replyInputContainer}>
              <View style={styles.replyPreview}>
                <IconSymbol name="arrowshape.turn.up.left" size={20} color={primaryColor} />
                <View style={styles.replyPreviewText}>
                  <ThemedText style={{ color: primaryColor, fontFamily: typography.families.bold }}>
                    Replying to {replyTo.sender.username}
                  </ThemedText>
                  <ThemedText style={{ color: textColor }}>
                    {replyTo.content.length > 50 ? replyTo.content.substring(0, 50) + '...' : replyTo.content}
                  </ThemedText>
                </View>
                <TouchableOpacity onPress={() => setReplyTo(null)} style={styles.cancelReply}>
                  <IconSymbol name="xmark" size={16} color={textColor} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Attachment Preview */}
          {attachment && (
            <View style={styles.attachmentPreviewContainer}>
              {attachment.type?.startsWith('audio') ? (
                <View style={[styles.attachmentPreview, { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' }]}>
                  <TouchableOpacity onPress={togglePreviewPlayback}>
                    <IconSymbol name="mic.fill" size={36} color={primaryColor} />
                  </TouchableOpacity>
                  <View style={{ marginLeft: spacing.sm }}>
                    <View style={styles.waveformContainer}>
                      {[3, 7, 4, 10, 6, 12, 8, 5, 9, 4, 8, 6, 10, 5, 7, 3, 6, 9, 4, 8].map((height, index) => {
                        const position = (previewStatus?.currentTime || 0) * 1000;
                        const duration = attachment.duration || (previewStatus?.duration || 0) * 1000 || 0;
                        const progress = duration > 0 ? position / duration : 0;
                        return (
                          <View key={index} style={[styles.waveformBar, { height, backgroundColor: (index / 20) <= progress ? primaryColor : lightTextColor, opacity: (index / 20) <= progress ? 1 : 0.5 }]} />
                        );
                      })}
                    </View>
                    <ThemedText style={{ fontSize: typography.sizes.caption, color: lightTextColor }}>
                      {previewStatus ? formatDuration((previewStatus.currentTime || 0) * 1000) : '0:00'} / {attachment.duration ? formatDuration(attachment.duration) : formatDuration((previewStatus?.duration || 0) * 1000)}
                    </ThemedText>
                  </View>
                </View>
              ) : (
                <TouchableOpacity onPress={() => handleMediaPreview(attachment)} style={styles.attachmentPreview}>
                  {attachment.type?.startsWith('video') || attachment.type === 'video' ? (
                    <InlineVideoPreview uri={attachment.uri} containerStyle={styles.videoPreview} contentStyle={styles.previewMedia} autoPlay playIconColor={white} />
                  ) : (
                    <Image source={{ uri: attachment.uri }} style={styles.previewMedia} />
                  )}
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={async () => {
                if (previewSound.current) {
                  releasePlayer(previewSound.current);
                  previewSound.current = null;
                }
                setPreviewStatus(null);
                setAttachment(null);
              }} style={styles.cancelAttachment}>
                <IconSymbol name="xmark" size={16} color={textColor} />
              </TouchableOpacity>
            </View>
          )}

          {/* Upload Progress Bar */}
          {uploadProgress > 0 && (
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBar, { width: `${uploadProgress}%`, backgroundColor: primaryColor }]} />
            </View>
          )}

          {/* Input */}
          <View style={[styles.inputContainer, { backgroundColor: surfaceColor, borderTopColor: backgroundColor }]}>
            {chat?.relatedCommunity && (
              <TouchableOpacity onPress={() => setIsAnonymous(!isAnonymous)} style={styles.anonToggle}>
                <IconSymbol name="eyeglasses" size={24} color={isAnonymous ? primaryColor : lightTextColor} />
              </TouchableOpacity>
            )}
            <MediaPickerButton
              onMediaSelected={handleMediaSelected}
              showAudioOption={false}
              icon="add"
              size={24}
              disabled={isUploading}
            />
            <TouchableOpacity
              onPressIn={startRecording}
              onPressOut={stopRecording}
              style={[styles.recordButton, isRecording && { backgroundColor: errorColor }]}
              disabled={isUploading}
            >
              <IconSymbol name="mic.fill" size={20} color={isRecording ? white : lightTextColor} />
            </TouchableOpacity>
            {isRecording ? (
              <View style={[styles.input, { backgroundColor, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }]}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: errorColor, marginRight: spacing.sm }} />
                <ThemedText style={{ marginRight: spacing.sm, color: errorColor, fontWeight: 'bold' }}>
                  {formatDuration(recordingDuration)}
                </ThemedText>
                <View style={{ flexDirection: 'row', alignItems: 'center', height: '100%', overflow: 'hidden' }}>
                  {meteringLevels.map((level, index) => (
                    <View
                      key={index}
                      style={{
                        width: 3,
                        height: Math.max(3, ((level + 60) / 60) * 25),
                        backgroundColor: errorColor,
                        marginHorizontal: 1,
                        borderRadius: 1.5,
                      }}
                    />
                  ))}
                </View>
              </View>
            ) : (
              <TextInput
                style={[styles.input, { color: textColor, backgroundColor }]}
                value={newMessage}
                onChangeText={(text) => {
                  setNewMessage(text);
                  if (text.trim() && user?.username) {
                    sendTypingStart(id as string, user.username);
                    if (typingTimeoutRef.current) {
                      clearTimeout(typingTimeoutRef.current);
                    }
                    typingTimeoutRef.current = setTimeout(() => {
                      sendTypingStop(id as string);
                    }, 1000);
                  }
                }}
                placeholder="Type a message..."
                placeholderTextColor={lightTextColor}
                multiline
                editable={!isUploading}
              />
            )}
            <TouchableOpacity onPress={handleSend} style={[styles.sendButton, { backgroundColor: primaryColor }]} disabled={isUploading}>
              {isUploading ? (
                <ActivityIndicator size="small" color={white} />
              ) : (
                <IconSymbol name="arrow.up" size={20} color={white} />
              )}
            </TouchableOpacity>
          </View>

        </ThemedView>
      </KeyboardAvoidingView>

        <ChatSettingsModal
          visible={showSettings}
          onClose={() => setShowSettings(false)}
          chat={chat}
          onChatUpdate={setChat}
          onMessagesUpdate={setMessages}
          onChatDeleted={() => router.back()}
          onFontSizeChange={setFontSize}
        />

      {/* Forward Modal */}
      {showForwardModal && messageToForward && (
        <View style={StyleSheet.absoluteFill}>
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
            onPress={() => setShowForwardModal(false)}
          />
          <View style={[styles.forwardModal, { backgroundColor: surfaceColor }]}>
            <ThemedText type="title" style={{ marginBottom: spacing.md }}>Forward Message</ThemedText>
            <ThemedText style={{ marginBottom: spacing.lg, color: lightTextColor }}>
              "{messageToForward.content}"
            </ThemedText>
            <TextInput
              style={[styles.input, { color: textColor, backgroundColor, marginBottom: spacing.md }]}
              value={forwardSearchText}
              onChangeText={setForwardSearchText}
              placeholder="Search chats..."
              placeholderTextColor={lightTextColor}
            />
            <FlatList
              data={userChats.filter(c => c._id !== id && (c.name || c.participants.filter((p: any) => p._id !== user?._id).map((p: any) => p.username).join(', ')).toLowerCase().includes(forwardSearchText.toLowerCase()))} // Exclude current chat and filter by search
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.forwardOption, { backgroundColor: primaryColor }]}
                  onPress={async () => {
                    try {
                      await cachedChatAPI.sendMessage(item._id, { content: messageToForward.content });
                      Alert.alert('Success', 'Message forwarded successfully');
                      setShowForwardModal(false);
                      setMessageToForward(null);
                      setForwardSearchText('');
                    } catch (error) {
                      Alert.alert('Error', 'Failed to forward message');
                    }
                  }}
                >
                  <ThemedText style={{ color: white }}>
                    {item.name || item.participants.filter((p: any) => p._id !== user?._id).map((p: any) => p.username).join(', ')}
                  </ThemedText>
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 300 }}
            />
          </View>
        </View>
      )}

      {/* Message Options Modal */}
      {showMessageOptionsModal && selectedMessage && (
        <View style={StyleSheet.absoluteFill}>
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
            onPress={() => { setShowMessageOptionsModal(false); setSelectedMessage(null); }}
          />
          <View style={[styles.forwardModal, { backgroundColor: surfaceColor }]}>
            <View style={{ width: 36, height: 5, borderRadius: 2.5, backgroundColor: lightTextColor + '40', alignSelf: 'center', marginBottom: spacing.lg }} />
            <TouchableOpacity
              style={[styles.messageOptionItem, { borderBottomWidth: 1, borderBottomColor: textColor + '20' }]}
              onPress={() => { handleReply(selectedMessage); setShowMessageOptionsModal(false); setSelectedMessage(null); }}
            >
              <IconSymbol name="arrowshape.turn.up.left" size={20} color={primaryColor} />
              <ThemedText style={{ color: textColor }}>Reply</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.messageOptionItem, { borderBottomWidth: 1, borderBottomColor: textColor + '20' }]}
              onPress={() => { handleForward(selectedMessage); setShowMessageOptionsModal(false); setSelectedMessage(null); }}
            >
              <IconSymbol name="arrowshape.turn.up.right" size={20} color={primaryColor} />
              <ThemedText style={{ color: textColor }}>Forward</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.messageOptionItem}
              onPress={() => { showDeleteOptions(selectedMessage); setShowMessageOptionsModal(false); setSelectedMessage(null); }}
            >
              <IconSymbol name="trash" size={20} color={errorColor} />
              <ThemedText style={{ color: errorColor }}>Delete</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.sm }}
              onPress={() => { setShowMessageOptionsModal(false); setSelectedMessage(null); }}
            >
              <ThemedText style={{ color: primaryColor, fontWeight: '600' }}>Cancel</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {showDeleteConfirmModal && deleteMessageData && (() => {
        const isSent = deleteMessageData.sender._id === user?._id;
        const otherParticipant = chat?.participants?.find((p: any) => p._id !== user?._id);
        const isRead = otherParticipant && deleteMessageData.readBy?.some((id: string) => id === otherParticipant._id);
        const canDeleteForEveryone = isSent && !isRead;

        return (
          <View style={StyleSheet.absoluteFill}>
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
              onPress={() => { setShowDeleteConfirmModal(false); setDeleteMessageData(null); }}
            />
            <View style={[styles.forwardModal, { backgroundColor: surfaceColor }]}>
              {isSent && canDeleteForEveryone ? (
                <>
                  <TouchableOpacity
                    style={[styles.forwardOption, { backgroundColor: surfaceColor, borderBottomWidth: 1, borderBottomColor: textColor + '20' }]}
                    onPress={() => { handleDelete(deleteMessageData, 'me'); setShowDeleteConfirmModal(false); setDeleteMessageData(null); }}
                  >
                    <ThemedText style={{ color: textColor }}>Me</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.forwardOption, { backgroundColor: '#ff4444' }]}
                    onPress={() => { handleDelete(deleteMessageData, 'everyone'); setShowDeleteConfirmModal(false); setDeleteMessageData(null); }}
                  >
                    <ThemedText style={{ color: white }}>Everyone</ThemedText>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={[styles.forwardOption, { backgroundColor: '#ff4444' }]}
                  onPress={() => { handleDelete(deleteMessageData, 'me'); setShowDeleteConfirmModal(false); setDeleteMessageData(null); }}
                >
                  <IconSymbol name="trash" size={20} color={white} />
                  <ThemedText style={{ color: white }}>Delete</ThemedText>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })()}

      <MediaPreviewModal
        visible={showMediaPreview}
        onClose={() => {
    setShowMediaPreview(false);
    setSelectedMediaAttachment(null);
}}
        attachment={selectedMediaAttachment ? selectedMediaAttachment : attachment}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: { primaryColor: string; white: string; surfaceColor: string; textColor: string; lightTextColor: string; myMessageColor: string; otherMessageColor: string; backgroundColor: string }) => StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1 },
  backButton: { paddingRight: spacing.md },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: spacing.md },
  headerTitleContainer: { flex: 1 },
  headerTitle: { fontFamily: typography.families.bold },
  statusText: { fontSize: typography.sizes.caption, marginTop: spacing.xs / 2 },
  callButton: { paddingHorizontal: spacing.sm },
  voiceCallButton: { paddingLeft: spacing.md },
  settingsButton: { paddingLeft: spacing.md },
  listContent: { padding: spacing.md },
  loadOlderContainer: { paddingVertical: spacing.sm, alignItems: 'center' },
  messageContainer: { flexDirection: 'row', marginBottom: spacing.md, maxWidth: '80%' },
  myMessageContainer: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  otherMessageContainer: { alignSelf: 'flex-start' },
  avatarContainer: { width: 36, height: 36, borderRadius: 18, marginRight: spacing.sm, justifyContent: 'center', alignItems: 'center', alignSelf: 'flex-end' },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  bubble: { padding: spacing.md, borderRadius: borderRadius.lg },
  attachmentImage: { width: 200, height: 200, borderRadius: borderRadius.md },
  username: { fontFamily: typography.families.bold, marginBottom: spacing.xs, fontSize: typography.sizes.caption },
  timestamp: { fontSize: 10, marginTop: spacing.xs, alignSelf: 'flex-end', opacity: 0.7, marginRight: spacing.sm },
  messageFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs },
  inputContainer: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderTopWidth: 1 },
  anonToggle: { padding: spacing.sm },
  attachmentButton: { padding: spacing.sm },
  recordButton: { padding: spacing.sm },
  input: { flex: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.xl, maxHeight: 100, fontSize: typography.sizes.body1, marginHorizontal: spacing.sm },
  sendButton: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  rightAction: {
    backgroundColor: colors.primaryColor,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
  },
  rightActionText: {
    color: colors.white,
    marginTop: spacing.xs,
    fontSize: typography.sizes.caption,
  },
  leftAction: {
    backgroundColor: colors.surfaceColor,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
  },
  deleteAction: {
    backgroundColor: '#ff4444',
  },
  leftActionText: {
    color: colors.textColor,
    marginTop: spacing.xs,
    fontSize: typography.sizes.caption,
  },
  replyContainer: {
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.xs,
    borderLeftWidth: 3,
    borderLeftColor: colors.primaryColor,
  },
  replyLabel: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.families.bold,
    marginBottom: spacing.xs,
  },
  replyText: {
    fontSize: typography.sizes.body2,
  },
  replyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  replyMediaThumb: {
    width: 28,
    height: 28,
    borderRadius: 4,
    marginLeft: spacing.xs,
  },
  replyMediaPlayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 4,
  },
  replyInputContainer: {
    backgroundColor: colors.surfaceColor,
    padding: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.backgroundColor,
  },
  replyPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    backgroundColor: colors.surfaceColor + '80',
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  replyPreviewText: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  highlightedMessage: {
    backgroundColor: 'rgba(255, 215, 0, 0.3)',
  },
  cancelReply: {
    padding: spacing.xs,
  },
  forwardModal: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  forwardOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
  },
  messageOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  attachmentVideo: {
    width: 200,
    height: 200,
    borderRadius: borderRadius.md,
  },
  audioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.xs,
    backgroundColor: colors.surfaceColor + '80',
    borderRadius: borderRadius.md,
    minWidth: 150,
  },
  audioPlayButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryColor,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  audioInfo: {
    flex: 1,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 16,
    marginBottom: 2,
  },
  waveformBar: {
    width: 3,
    borderRadius: 1.5,
  },
  audioDurationText: {
    fontSize: 10,
    color: colors.lightTextColor,
    fontFamily: typography.families.medium,
  },
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    backgroundColor: colors.surfaceColor + '80',
    borderRadius: borderRadius.md,
  },
  fileInfo: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  fileName: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.families.bold,
    color: colors.textColor,
    marginBottom: spacing.xs,
  },
  fileSize: {
    fontSize: typography.sizes.caption,
    color: colors.lightTextColor,
  },
  errorContainer: {
    width: 200,
    height: 200,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfaceColor,
  },
  progressBarContainer: {
    height: 3,
    width: '100%',
    backgroundColor: colors.surfaceColor,
  },
  progressBar: {
    height: '100%',
  },
  attachmentPreviewContainer: {
    backgroundColor: colors.surfaceColor,
    padding: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.backgroundColor,
    flexDirection: 'row',
    alignItems: 'center',
  },
  attachmentPreview: {
    flex: 1,
    marginRight: spacing.sm,
  },
  previewMedia: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.md,
  },
  videoPreview: {
    position: 'relative',
  },
  playIcon: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -12 }, { translateY: -12 }],
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    padding: 4,
  },
  cancelAttachment: {
    padding: spacing.xs,
  },
  videoPlayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  callLogContainer: {
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  callLogPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.round,
    gap: spacing.xs,
    maxWidth: '90%',
  },
  callLogText: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.families.medium,
  },
  callLogTime: {
    fontSize: 10,
    opacity: 0.7,
  },
});