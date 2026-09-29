// utils/unreadStore.ts

type CountListener = (count: number) => void;
type InvalidateListener = () => void;

let currentCount = 0;
const countListeners = new Set<CountListener>();
const invalidateListeners = new Set<InvalidateListener>();

let currentNotificationCount = 0;
const notificationCountListeners = new Set<CountListener>();
const notificationInvalidateListeners = new Set<InvalidateListener>();

export const getUnreadChatCount = () => currentCount;

export const setUnreadChatCount = (count: number) => {
  currentCount = count;
  countListeners.forEach((listener) => listener(count));
};

export const subscribeUnreadChatCount = (listener: CountListener) => {
  countListeners.add(listener);
  return () => {
    countListeners.delete(listener);
  };
};

/**
 * Signals that the unread count changed server-side (message read, message sent,
 * history cleared, ...). Consumers must discard cached values and refetch.
 * Kept separate from `setUnreadChatCount` so a refetch triggered by an
 * invalidation cannot feed back into another invalidation.
 */
export const notifyUnreadChatInvalidated = () => {
  invalidateListeners.forEach((listener) => listener());
};

export const subscribeUnreadChatInvalidated = (listener: InvalidateListener) => {
  invalidateListeners.add(listener);
  return () => {
    invalidateListeners.delete(listener);
  };
};

export const getUnreadNotificationCount = () => currentNotificationCount;

export const setUnreadNotificationCount = (count: number) => {
  currentNotificationCount = count;
  notificationCountListeners.forEach((listener) => listener(count));
};

export const subscribeUnreadNotificationCount = (listener: CountListener) => {
  notificationCountListeners.add(listener);
  return () => {
    notificationCountListeners.delete(listener);
  };
};

/**
 * Signals that the notification unread count changed (notification read, all
 * read, deleted, cleared). Consumers must discard the cached total and refetch.
 */
export const notifyUnreadNotificationInvalidated = () => {
  notificationInvalidateListeners.forEach((listener) => listener());
};

export const subscribeUnreadNotificationInvalidated = (listener: InvalidateListener) => {
  notificationInvalidateListeners.add(listener);
  return () => {
    notificationInvalidateListeners.delete(listener);
  };
};
