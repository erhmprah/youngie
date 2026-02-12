import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, TextInput, FlatList, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Image, Alert, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { Video, Audio, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/contexts/AuthContext';
import { chatAPI, getImageUrl } from '@/utils/api';
import { getSocket, joinChat, leaveChat, sendMessage, sendTypingStart, sendTypingStop, onMessageReceived, offMessageReceived, onMessagesRead, offMessagesRead, onUserTyping, offUserTyping, onUserStopTyping, offUserStopTyping } from '@/utils/socket';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ChatSettingsModal } from '@/components/chat-settings-modal';
import { MediaPreviewModal } from '@/components/media-preview-modal';
import { spacing, borderRadius, typography } from '@/constants/design-tokens';
import { Swipeable, RectButton } from 'react-native-gesture-handler';
import { Animated } from 'react-native';

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

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const router = useRouter();
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [messageToForward, setMessageToForward] = useState<Message | null>(null);
  const [showMessageOptionsModal, setShowMessageOptionsModal] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
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
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [audioStatus, setAudioStatus] = useState<Record<string, any>>({});

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

  const typingTimeoutRef = useRef<number | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const swipeRefs = useRef(new Map<string, Swipeable>());
  const soundRefs = useRef(new Map<string, Audio.Sound>());
  const recordingRef = useRef<Audio.Recording | null>(null);
  const isRecordingDesired = useRef(false);
  const [meteringLevels, setMeteringLevels] = useState<number[]>([]);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const previewSound = useRef<Audio.Sound | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewStatus, setPreviewStatus] = useState<any>(null);

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

    const fetchUserChats = async () => {
      try {
        const response = await chatAPI.getUserChats(user?._id || '');
        setUserChats(response.data);
      } catch (error) {
        console.error('Failed to fetch user chats:', error);
      }
    };

    fetchChat();
    if (user?._id) fetchUserChats();

    // Join the chat room via socket
    joinChat(id as string);

    const handleNewMessage = (message: Message) => {
      if (message.chat === id) {
        setMessages(prevMessages => {
          // Check if this replaces a temporary message
          const existingIndex = prevMessages.findIndex(msg => msg._id.startsWith('temp-') && msg.sender._id === message.sender._id && msg.content === message.content);
          if (existingIndex !== -1) {
            // Replace the temporary message with the real one
            const newMessages = [...prevMessages];
            newMessages[existingIndex] = message;
            return newMessages;
          } else {
            // Add as new message
            return [...prevMessages, message];
          }
        });
        chatAPI.markAsRead(id as string); // Mark as read if receiving while open
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
      if (previewSound.current) {
        previewSound.current.unloadAsync();
      }
    };
  }, [id]);

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
          console.error('Failed to load font size:', error);
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
      await chatAPI.sendMessage(id as string, messageData);

      // Emit via socket
      sendMessage(id as string, user!._id, message.content, message.replyTo?._id, message.isAnonymous, message.attachment);

      // Mark as sent
      setMessages(prevMessages => prevMessages.map(msg =>
        msg._id === message._id ? { ...msg, isSending: false } : msg
      ));
    } catch (error) {
      console.error('Failed to retry send:', error);
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
        content: currentReplyTo.content
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
      await previewSound.current.unloadAsync();
      previewSound.current = null;
    }
    setIsPreviewPlaying(false);
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
        console.error('Failed to upload attachment:', error);
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
      attachment: attachmentData ? JSON.stringify(attachmentData) : undefined,
    };

    try {
      // Send via REST API for persistence
      await chatAPI.sendMessage(id as string, messageData);

      // Also emit via socket for real-time updates to other users
      sendMessage(id as string, user._id, currentMessageContent, currentReplyTo?._id, messageData.isAnonymous, attachmentData);

      // Mark as sent successfully and clear input
      setMessages(prevMessages => prevMessages.map(msg =>
        msg._id === tempId ? { ...msg, isSending: false } : msg
      ));
      setUploadProgress(0);
      setIsUploading(false);
    } catch (error) {
      console.error('Failed to send message:', error);
      // Mark message as having send error instead of removing it
      setMessages(prevMessages => prevMessages.map(msg =>
        msg._id === tempId ? { ...msg, isSending: false, sendError: true } : msg
      ));
    }
  };

  const handleReply = (message: Message) => {
    setReplyTo(message);
  };

  const handleDelete = (message: Message) => {
    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await chatAPI.deleteMessage(id as string, message._id);
              setMessages(prevMessages => prevMessages.map(msg =>
                msg._id === message._id ? { ...msg, content: 'Message deleted', isDeleted: true } : msg
              ));
            } catch (error) {
              console.error('Failed to delete message:', error);
              // Still mark as deleted locally if API fails
              setMessages(prevMessages => prevMessages.map(msg =>
                msg._id === message._id ? { ...msg, content: 'Message deleted', isDeleted: true } : msg
              ));
            }
          }
        }
      ]
    );
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
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality: 1,
      videoMaxDuration: 300, // 5 minutes max
    });
    if (!result.canceled) {
      setAttachment(result.assets[0]);
    }
  };

  const startRecording = async () => {
    if (previewSound.current) {
      await previewSound.current.unloadAsync();
      previewSound.current = null;
      setIsPreviewPlaying(false);
      setPreviewStatus(null);
    }

    // Stop any playing audio messages to prevent conflicts
    if (playingAudio) {
      const sound = soundRefs.current.get(playingAudio);
      if (sound) {
        try {
          await sound.stopAsync();
        } catch (e) { console.log('Error stopping playing audio:', e); }
      }
      setPlayingAudio(null);
    }

    setAttachment(null);
    isRecordingDesired.current = true;
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch (error) {
        console.error('Failed to stop previous recording:', error);
      }
      recordingRef.current = null;
      setRecording(null);
    }
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant permission to record audio');
        isRecordingDesired.current = false;
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        { ...Audio.RecordingOptionsPresets.HIGH_QUALITY, isMeteringEnabled: true },
        (status) => {
          if (status.isRecording) {
            if (status.metering !== undefined) setMeteringLevels(prev => [...prev.slice(-40), status.metering || -160]);
            setRecordingDuration(status.durationMillis);
          }
        },
        100
      );

      if (!isRecordingDesired.current) {
        try {
          await newRecording.stopAndUnloadAsync();
        } catch (error) {
          // Ignore error if stopped too quickly
        }
        return;
      }

      recordingRef.current = newRecording;
      setRecording(newRecording);
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording');
      isRecordingDesired.current = false;
      setIsRecording(false);
      setRecording(null);
      recordingRef.current = null;
    }
  };

  const stopRecording = async () => {
    isRecordingDesired.current = false;
    const currentRecording = recordingRef.current;
    if (!currentRecording) return;

    try {
      let status;
      try {
        status = await currentRecording.getStatusAsync();
      } catch (e) {
        throw new Error('Recording is not prepared or already unloaded');
      }
      const duration = status.durationMillis;

      // If recording is too short (e.g. < 500ms), discard it
      if (duration < 500) {
        try {
          await currentRecording.stopAndUnloadAsync();
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

      await currentRecording.stopAndUnloadAsync();
      const uri = currentRecording.getURI();
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
      console.error('Failed to stop recording:', error);
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
          await currentSound.unloadAsync();
        }
      }

      let sound = soundRefs.current.get(messageId);
      if (!sound) {
        const rawUrl = attachment.url || attachment.uri;
        const normalizedUrl = rawUrl ? rawUrl.replace(/\\/g, '/') : '';
        const isLocalFile = /^(file|content):/.test(normalizedUrl);
        const isFullUrl = /^(http|https):/.test(normalizedUrl);

        const uri = (isLocalFile || isFullUrl)
          ? normalizedUrl
          : getImageUrl(normalizedUrl.startsWith('/') ? normalizedUrl : `/${normalizedUrl}`);

        if (!uri) throw new Error('Invalid audio URL');
        const source = { uri };
        const { sound: newSound } = await Audio.Sound.createAsync(source);
        sound = newSound;
        soundRefs.current.set(messageId, sound);

        sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
          setAudioStatus(prev => ({ ...prev, [messageId]: status }));
          if ((status as any).didJustFinish) {
            setPlayingAudio(null);
            sound.setPositionAsync(0);
          }
        });
      }

      const status = await sound.getStatusAsync();
      if ((status as any).isPlaying) {
        await sound.pauseAsync();
        setPlayingAudio(null);
      } else {
        if ((status as any).durationMillis && (status as any).positionMillis >= (status as any).durationMillis) {
          await sound.setPositionAsync(0);
        }
        await sound.playAsync();
        setPlayingAudio(messageId);
      }
    } catch (error) {
      console.error('Failed to play audio:', error);
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

  const togglePreviewPlayback = async () => {
    if (!attachment || !attachment.uri) return;

    try {
      // Ensure audio mode is configured for playback
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: true,
      });

      if (previewSound.current) {
        const status = await previewSound.current.getStatusAsync();
        if (status.isLoaded) {
          if (status.isPlaying) {
            await previewSound.current.pauseAsync();
            setIsPreviewPlaying(false);
          } else {
            await previewSound.current.playAsync();
            setIsPreviewPlaying(true);
          }
          return;
        }
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: attachment.uri },
        { shouldPlay: true }
      );
      previewSound.current = sound;
      setIsPreviewPlaying(true);

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          setPreviewStatus(status);
          setIsPreviewPlaying(status.isPlaying);
          if (status.didJustFinish) {
            setIsPreviewPlaying(false);
            sound.setPositionAsync(0);
          }
        }
      });
    } catch (error) {
      console.error('Error playing preview:', error);
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
      <TouchableOpacity onPress={() => { handleDelete(message); close(); }}>
        <Animated.View style={[styles.leftAction, styles.deleteAction, { transform: [{ translateX: trans }] }]}>
          <IconSymbol name="trash" size={24} color={white} />
          <ThemedText style={styles.leftActionText}>Delete</ThemedText>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  const handleMediaPreview = (attachmentData: any) => {
    setSelectedMediaAttachment(attachmentData);
    setShowMediaPreview(true);
  };

  const renderAttachment = (attachmentProp: any, messageId?: string) => {
    let attachment = attachmentProp;
    if (typeof attachment === 'string') {
      try {
        attachment = JSON.parse(attachment);
      } catch (e) {
        console.error('Failed to parse attachment', e);
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
        <TouchableOpacity onPress={() => handleMediaPreview(attachment)}>
          <Image
            key={attachmentUrl}
            source={{ uri: attachmentUrl }}
            style={styles.attachmentImage}
            resizeMode="cover"
            onError={(e) => {
              console.log('Image load error:', e.nativeEvent.error, attachmentUrl);
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
        <TouchableOpacity onPress={() => handleMediaPreview(attachment)} style={{ position: 'relative' }}>
          <Video
            source={{ uri: attachmentUrl }}
            style={styles.attachmentVideo}
            useNativeControls={false}
            isLooping={false}
            resizeMode={ResizeMode.COVER}
          />
          <View style={styles.videoPlayOverlay}>
            <IconSymbol name="play.fill" size={48} color={white} />
          </View>
        </TouchableOpacity>
      );
    } else if (attachment.type && attachment.type.startsWith('audio/')) {
      const status = audioStatus[messageId || ''];
      const isPlaying = playingAudio === messageId && status?.isPlaying;
      const position = status?.positionMillis || 0;
      const duration = status?.durationMillis || attachment.duration || 0;
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

    // Handle anonymous display logic client-side for real-time messages
    const showAnonymous = item.isAnonymous && !isMyMessage;
    const displayName = showAnonymous ? 'Anonymous' : item.sender.username;
    const displayPhoto = showAnonymous ? undefined : item.sender.profilePhoto;

    const messageContent = (
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
        <TouchableOpacity onLongPress={() => showMessageOptions(item)} style={[styles.bubble, { backgroundColor: isMyMessage ? myMessageColor : otherMessageColor }]}>
          {item.replyTo && item.replyTo.sender && (
            <View style={[styles.replyContainer, { backgroundColor: isMyMessage ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' }]}>
              <ThemedText style={[styles.replyLabel, { color: isMyMessage ? white : primaryColor }]}>
                Replying to {item.replyTo.sender.username}
              </ThemedText>
              <ThemedText style={[styles.replyText, { color: isMyMessage ? white : textColor }]}>
                {item.replyTo.content.length > 50 ? item.replyTo.content.substring(0, 50) + '...' : item.replyTo.content}
              </ThemedText>
            </View>
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

  if (isLoading) {
    return <ActivityIndicator style={{ flex: 1 }} size="large" color={primaryColor} />;
  }

  const chatName = chat?.relatedCommunity?.name || chat?.name || chat?.participants.filter(p => p._id !== user?._id).map(p => p.username).join(', ');
  const chatImage = chat?.relatedCommunity?.image || chat?.participants.find(p => p._id !== user?._id)?.profilePhoto;
  const otherParticipant = chat?.participants.find(p => p._id !== user?._id);
  const isDirectChat = chat && !chat.isGroupChat && chat.participants.length === 2;
  const isOnline = otherParticipant?.isOnline;
  const lastSeen = otherParticipant?.lastSeen;

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
              <TouchableOpacity onPress={handleVoiceCall} style={styles.voiceCallButton}>
                  <IconSymbol name="phone" size={24} color={textColor} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.settingsButton}>
                  <IconSymbol name="settings" size={24} color={textColor} />
              </TouchableOpacity>
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
                    <IconSymbol name={isPreviewPlaying ? "pause.circle.fill" : "play.circle.fill"} size={40} color={primaryColor} />
                  </TouchableOpacity>
                  <View style={{ marginLeft: spacing.sm }}>
                    <View style={styles.waveformContainer}>
                      {[3, 7, 4, 10, 6, 12, 8, 5, 9, 4, 8, 6, 10, 5, 7, 3, 6, 9, 4, 8].map((height, index) => {
                        const position = previewStatus?.positionMillis || 0;
                        const duration = attachment.duration || previewStatus?.durationMillis || 0;
                        const progress = duration > 0 ? position / duration : 0;
                        return (
                          <View key={index} style={[styles.waveformBar, { height, backgroundColor: (index / 20) <= progress ? primaryColor : lightTextColor, opacity: (index / 20) <= progress ? 1 : 0.5 }]} />
                        );
                      })}
                    </View>
                    <ThemedText style={{ fontSize: typography.sizes.caption, color: lightTextColor }}>
                      {previewStatus ? formatDuration(previewStatus.positionMillis) : '0:00'} / {attachment.duration ? formatDuration(attachment.duration) : '0:00'}
                    </ThemedText>
                  </View>
                </View>
              ) : (
                <TouchableOpacity onPress={() => setShowMediaPreview(true)} style={styles.attachmentPreview}>
                  {attachment.type?.startsWith('video') || attachment.type === 'video' ? (
                    <View style={styles.videoPreview}>
                      <Video source={{ uri: attachment.uri }} style={styles.previewMedia} resizeMode={ResizeMode.COVER} />
                      <View style={styles.playIcon}>
                        <IconSymbol name="play.fill" size={24} color={white} />
                      </View>
                    </View>
                  ) : (
                    <Image source={{ uri: attachment.uri }} style={styles.previewMedia} />
                  )}
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={async () => {
                if (previewSound.current) {
                  await previewSound.current.unloadAsync();
                  previewSound.current = null;
                }
                setIsPreviewPlaying(false);
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
            <TouchableOpacity onPress={pickMedia} style={styles.attachmentButton} disabled={isUploading}>
              <IconSymbol name="paperclip" size={24} color={attachment ? primaryColor : lightTextColor} />
            </TouchableOpacity>
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
          onFontSizeChange={setFontSize}
        />

      {/* Forward Modal */}
      {showForwardModal && messageToForward && (
        <View style={StyleSheet.absoluteFillObject}>
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
                      await chatAPI.sendMessage(item._id, { content: messageToForward.content });
                      Alert.alert('Success', 'Message forwarded successfully');
                      setShowForwardModal(false);
                      setMessageToForward(null);
                      setForwardSearchText('');
                    } catch (error) {
                      console.error('Failed to forward message:', error);
                      Alert.alert('Error', 'Failed to forward message');
                    }
                  }}
                >
                  <ThemedText style={{ color: white, marginLeft: spacing.sm }}>
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
        <View style={StyleSheet.absoluteFillObject}>
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
            onPress={() => { setShowMessageOptionsModal(false); setSelectedMessage(null); }}
          />
          <View style={[styles.forwardModal, { backgroundColor: surfaceColor }]}>
            <ThemedText type="title" style={{ marginBottom: spacing.md }}>Message Options</ThemedText>
            <TouchableOpacity
              style={[styles.forwardOption, { backgroundColor: primaryColor }]}
              onPress={() => { handleReply(selectedMessage); setShowMessageOptionsModal(false); setSelectedMessage(null); }}
            >
              <IconSymbol name="arrowshape.turn.up.left" size={20} color={white} />
              <ThemedText style={{ color: white, marginLeft: spacing.sm }}>Reply</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.forwardOption, { backgroundColor: primaryColor }]}
              onPress={() => { handleForward(selectedMessage); setShowMessageOptionsModal(false); setSelectedMessage(null); }}
            >
              <IconSymbol name="arrowshape.turn.up.right" size={20} color={white} />
              <ThemedText style={{ color: white, marginLeft: spacing.sm }}>Forward</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.forwardOption, { backgroundColor: '#ff4444' }]}
              onPress={() => { handleDelete(selectedMessage); setShowMessageOptionsModal(false); setSelectedMessage(null); }}
            >
              <IconSymbol name="trash" size={20} color={white} />
              <ThemedText style={{ color: white, marginLeft: spacing.sm }}>Delete</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      )}

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
  cancelReply: {
    padding: spacing.xs,
  },
  forwardModal: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.xl,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
  },
  forwardOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
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
});