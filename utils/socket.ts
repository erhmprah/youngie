// utils/socket.ts

import { io, Socket } from 'socket.io-client';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SOCKET_URL } from './api';

let socket: Socket | null = null;
let currentUserId: string | null = null;

// Track if we've already set up the AppState listener
let appStateListenerSetup = false;

// Keep-alive heartbeat interval - keeps the user marked online while the app
// is open but idle (no messages being sent). Must run more often than the
// server's ONLINE_TIMEOUT (5 minutes) so users don't get marked offline.
const HEARTBEAT_INTERVAL = 2 * 60 * 1000; // 2 minutes
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

// Handle app coming to foreground - refresh online status
const handleAppStateChange = (nextAppState: AppStateStatus) => {
  if (nextAppState === 'active' && socket && currentUserId && socket.connected) {
    // Re-emit user-online when app comes to foreground
    socket.emit('user-online');
    console.log('✓ Refreshed online status on app foreground');
  }
};

export const initSocket = (userId: string): Socket => {
  currentUserId = userId;
  
  if (socket) {
    return socket;
  }

  socket = io(SOCKET_URL, {
    auth: async (cb) => {
      cb({ token: await AsyncStorage.getItem('authToken') });
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
    forceNew: true,
  });

  socket.on('connect', () => {
    console.log('✓ Socket connected:', socket?.id);
    socket?.emit('user-online');
  });

  // Start the keep-alive heartbeat so the user stays "online" while idle.
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }
  heartbeatInterval = setInterval(() => {
    if (socket && socket.connected && currentUserId) {
      socket.emit('heartbeat');
    }
  }, HEARTBEAT_INTERVAL);

  socket.on('disconnect', () => {
    console.log('✗ Socket disconnected');
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error.message);
  });

  // Set up AppState listener only once
  if (!appStateListenerSetup) {
    AppState.addEventListener('change', handleAppStateChange);
    appStateListenerSetup = true;
  }

  return socket;
};

export const getSocket = (): Socket | null => {
    return socket;
}

export const disconnectSocket = () => {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  if (socket) {
    socket.disconnect();
    socket = null;
    currentUserId = null;
  }
};

// Event Emitters
export const joinChat = (chatId: string) => {
  socket?.emit('join-chat', { chatId });
};

export const leaveChat = (chatId: string) => {
  socket?.emit('leave-chat', { chatId });
};

export const sendMessage = (chatId: string, senderId: string, content: string, replyTo?: string, isAnonymous?: boolean, attachment?: any, tempId?: string) => {
  socket?.emit('new-message', { chatId, senderId, content, replyTo, isAnonymous, attachment, tempId });
};

export const sendCallLog = (chatId: string, data: { callerId: string; callType?: 'voice' | 'video'; callStatus: 'missed' | 'declined' | 'completed' | 'cancelled'; callDuration?: number }) => {
  socket?.emit('call-log', { chatId, ...data });
};

export const getCurrentUserId = (): string | null => currentUserId;

export const sendTypingStart = (chatId: string, username: string) => {
    socket?.emit('typing', { chatId, username, userId: currentUserId });
}

export const sendTypingStop = (chatId: string) => {
    socket?.emit('stop-typing', { chatId });
}


// Event Emitters for voice calls
export const sendVoiceCallOffer = (chatId: string, offer: any, caller: any) => {
  socket?.emit('voice-call-offer', { chatId, offer, caller });
};

export const sendVoiceCallAnswer = (chatId: string, answer: any) => {
  socket?.emit('voice-call-answer', { chatId, answer });
};

export const sendVoiceCallIceCandidate = (chatId: string, candidate: any) => {
  socket?.emit('voice-call-ice-candidate', { chatId, candidate });
};

export const sendVoiceCallEnd = (chatId: string) => {
  socket?.emit('voice-call-end', { chatId });
};

// Event Listeners (subscribers)
export const onMessageReceived = (callback: (message: any) => void) => {
  socket?.on('message-received', callback);
};

export const offMessageReceived = () => {
  socket?.off('message-received');
};

export const onUserTyping = (callback: (data: {username: string}) => void) => {
    socket?.on('user-typing', callback);
}

export const offUserTyping = () => {
    socket?.off('user-typing');
}

export const onUserStopTyping = (callback: () => void) => {
    socket?.on('user-stop-typing', callback);
}

export const offUserStopTyping = () => {
    socket?.off('user-stop-typing');
}

export const onNewNotification = (callback: (data: any) => void) => {
    socket?.on('new-notification', callback);
}

export const offNewNotification = () => {
    socket?.off('new-notification');
}

export const onMessagesRead = (callback: (data: { userId: string; chatId: string }) => void) => {
    socket?.on('messages-read', callback);
}

export const offMessagesRead = () => {
  socket?.off('messages-read');
}

// Post real-time event listeners
export const onPostUpdated = (callback: (post: any) => void) => {
  socket?.on('post:updated', callback);
};

export const offPostUpdated = () => {
  socket?.off('post:updated');
};

export const onPostCreated = (callback: (post: any) => void) => {
  socket?.on('post:created', callback);
};

export const offPostCreated = () => {
  socket?.off('post:created');
};

export const onPostDeleted = (callback: (postId: string) => void) => {
  socket?.on('post:deleted', callback);
};

export const offPostDeleted = () => {
  socket?.off('post:deleted');
};

// Voice call event listeners
export const onVoiceCallOffer = (callback: (data: { offer: any; caller: any; chatId: string }) => void) => {
  socket?.on('voice-call-offer', callback);
};

export const offVoiceCallOffer = () => {
  socket?.off('voice-call-offer');
};

export const onVoiceCallAnswer = (callback: (data: { answer: any }) => void) => {
  socket?.on('voice-call-answer', callback);
};

export const offVoiceCallAnswer = () => {
  socket?.off('voice-call-answer');
};

export const onVoiceCallIceCandidate = (callback: (data: { candidate: any }) => void) => {
  socket?.on('voice-call-ice-candidate', callback);
};

export const offVoiceCallIceCandidate = () => {
  socket?.off('voice-call-ice-candidate');
};

export const onVoiceCallEnd = (callback: () => void) => {
  socket?.on('voice-call-end', callback);
};

export const offVoiceCallEnd = () => {
  socket?.off('voice-call-end');
};
