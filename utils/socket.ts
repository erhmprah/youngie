// utils/socket.ts

import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from './api';

let socket: Socket | null = null;

export const initSocket = (userId: string): Socket => {
  if (socket) {
    return socket;
  }

  socket = io(SOCKET_URL, {
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  });

  socket.on('connect', () => {
    console.log('✓ Socket connected:', socket?.id);
    socket?.emit('user-online', { userId });
  });

  socket.on('disconnect', () => {
    console.log('✗ Socket disconnected');
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error.message);
  });

  return socket;
};

export const getSocket = (): Socket | null => {
    return socket;
}

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

// Event Emitters
export const joinChat = (chatId: string) => {
  socket?.emit('join-chat', { chatId });
};

export const leaveChat = (chatId: string) => {
  socket?.emit('leave-chat', { chatId });
};

export const sendMessage = (chatId: string, senderId: string, content: string, replyTo?: string, isAnonymous?: boolean, attachment?: any) => {
  socket?.emit('new-message', { chatId, senderId, content, replyTo, isAnonymous, attachment });
};

export const sendTypingStart = (chatId: string, username: string) => {
    socket?.emit('typing', { chatId, username });
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
