// utils/socket-error.ts

import { CustomAlert } from './alert';
import { COPY, resolveCopy, type ErrorKind } from './error-messages';

export type SocketErrorContext = 'chat' | 'voice' | 'video' | 'general';

export interface FriendlySocketError {
  title: string;
  message: string;
}

// Backend-authored, user-safe text. When the server already sends a human
// sentence we show it as-is instead of a generic fallback.
const SERVER_MESSAGES: Record<string, string> = {
  'the call ended. please start a new one.': 'The call ended. Please start a new one.',
  'we could not start the call. please try again.': 'We could not start the call. Please try again.',
  'we could not connect the call. please try again.': 'We could not connect the call. Please try again.',
  'we lost the call connection. please try again.': 'We lost the call connection. Please try again.',
  'you no longer have access to this chat.': 'You no longer have access to this chat.',
};

// Transport and auth families shared with the rest of the app, so a socket
// failure and a failed request never read differently.
const SOCKET_KINDS: ErrorKind[] = [
  'offline',
  'timeout',
  'socket',
  'session',
  'permission',
  'server',
  'busy',
];

const FALLBACK: Record<SocketErrorContext, FriendlySocketError> = {
  general: {
    title: 'Connection Problem',
    message: 'Something went wrong connecting. Please try again.',
  },
  chat: {
    title: 'Chat Connection Problem',
    message: 'We could not connect to chat. Please try again.',
  },
  voice: {
    title: 'Call Connection Problem',
    message: 'We could not connect the call. Please try again.',
  },
  video: {
    title: 'Video Connection Problem',
    message: 'We could not connect the video call. Please try again.',
  },
};

/**
 * Maps any socket/transport error to short, human copy.
 * Unknown errors fall back to friendly per-context defaults, never raw output.
 */
export function getFriendlySocketError(
  error: any,
  context: SocketErrorContext = 'general'
): FriendlySocketError {
  const fallback = FALLBACK[context] || FALLBACK.general;
  const resolved = resolveCopy(error, fallback.message);

  const known = SOCKET_KINDS.includes(resolved.kind);
  if (!known) {
    const serverCopy = SERVER_MESSAGES[resolved.message.toLowerCase()];
    return serverCopy
      ? { title: fallback.title, message: serverCopy }
      : fallback;
  }

  const copy = COPY[resolved.kind];
  return context === 'general'
    ? { title: copy.title, message: copy.message }
    : { title: fallback.title, message: copy.message };
}

const THROTTLE_MS = 8000;
let lastKey: string | null = null;
let lastShownAt = 0;

/**
 * Shows a friendly socket error alert, collapsing repeats of the same error so
 * reconnects don't stack identical popups on the user.
 */
export function showFriendlySocketError(error: any, context: SocketErrorContext = 'general') {
  const { title, message } = getFriendlySocketError(error, context);
  const key = `${context}:${title}`;
  const now = Date.now();

  if (key === lastKey && now - lastShownAt < THROTTLE_MS) {
    return;
  }

  lastKey = key;
  lastShownAt = now;
  CustomAlert.error(title, message);
}

/** Allows a suppressed error to be shown again immediately (e.g. after a retry). */
export function resetSocketErrorThrottle() {
  lastKey = null;
  lastShownAt = 0;
}
