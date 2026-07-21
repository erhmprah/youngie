import { Platform } from 'react-native';
import { router } from 'expo-router';

// Conditionally import expo-notifications
let Notifications: any = null;
try {
  Notifications = require('expo-notifications');
  console.log('[CallService] expo-notifications loaded successfully');
} catch (e) {
  console.warn('[CallService] expo-notifications not available:', e);
}

class CallService {
  private currentCallId: string | null = null;
  private currentChatId: string | null = null;
  private currentCaller: any = null;
  private currentOffer: any = null;
  private scheduledNotificationId: string | null = null;

  constructor() {
    this.setup();
  }

  async setup() {
    if (!Notifications) {
      console.warn('[CallService] Notifications not available, skipping setup');
      return;
    }

    try {
      // Request notification permissions
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.warn('[CallService] Notification permissions not granted');
        return;
      }

      // Set up notification channel for Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('incoming-calls', {
          name: 'Incoming Calls',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
          sound: 'ringtone.mp3',
          showBadge: true,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });
      }

      // Set up notification category for call actions
      if (Notifications.setNotificationCategoryAsync) {
        await Notifications.setNotificationCategoryAsync('incoming-call-category', {
          actions: [
            {
              identifier: 'accept-call',
              buttonTitle: 'Accept',
              options: {
                opensAppToForeground: true,
              },
            },
            {
              identifier: 'decline-call',
              buttonTitle: 'Decline',
              options: {
                opensAppToForeground: true,
                destructive: true,
              },
            },
          ],
        });
      }

      console.log('[CallService] Notification-based call service setup completed');
    } catch (error) {
      console.error('CallService setup error:', error);
    }
  }

  displayIncomingCall = async (uuid: string, handle: string, localizedCallerName?: string, chatId?: string, caller?: any, offer?: any) => {
    this.currentCallId = uuid;
    this.currentChatId = chatId || null;
    this.currentCaller = caller;
    this.currentOffer = offer;

    if (!Notifications) {
      console.warn('[CallService] Notifications not available, cannot display incoming call');
      return;
    }

      try {
        const notificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: `Incoming call from ${localizedCallerName || 'User'}`,
            body: 'Tap to answer the call',
            data: {
              callId: uuid,
              chatId: this.currentChatId,
              caller: this.currentCaller,
              offer: this.currentOffer,
              type: 'incoming-call'
            },
            categoryIdentifier: 'incoming-call-category',
            sound: 'ringtone.mp3',
            priority: Notifications.AndroidNotificationPriority.MAX,
            sticky: true,
          },
          trigger: null, // Show immediately
        });
        this.scheduledNotificationId = notificationId;

        console.log('[CallService] Incoming call notification sent');
      } catch (error) {
        console.error('Error displaying incoming call notification:', error);
      }
  };

  onAnswerCall = (data: any) => {
    const { callUUID } = data;

    // Navigate to voice call screen with the stored data
    if (this.currentChatId) {
        router.push({
            pathname: '/chat/voice-call',
            params: {
                chatId: this.currentChatId,
                name: this.currentCaller?.username || 'User',
                image: this.currentCaller?.profilePhoto,
                offer: this.currentOffer ? JSON.stringify(this.currentOffer) : undefined,
            }
        });
    }
  };

  cancelIncomingCall = async () => {
    if (this.scheduledNotificationId && Notifications) {
      try {
        await Notifications.cancelScheduledNotificationAsync(this.scheduledNotificationId);
        this.scheduledNotificationId = null;
      } catch (error) {
        console.error('Error canceling incoming call notification:', error);
      }
    }
  };

  onEndCall = (data: any) => {
    const { callUUID } = data;
    this.currentCallId = null;
    this.currentChatId = null;
    this.currentCaller = null;
    this.currentOffer = null;
    if (this.scheduledNotificationId && Notifications) {
      Notifications.cancelScheduledNotificationAsync(this.scheduledNotificationId).catch(() => {});
      this.scheduledNotificationId = null;
    }
  };

  isCallActive = (callId?: string): boolean => {
    if (!callId) return false;
    return this.currentCallId === callId;
  };
}

export default new CallService();