import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

// Try to import expo-device (optional - may not be installed)
let Device: any = null;
try {
  Device = require('expo-device');
} catch (e) {
  console.log('expo-device not available, using fallback');
}

// Background notification task for handling pushes when app is backgrounded/terminated
// Note: expo-task-manager is a native module and only works on iOS/Android with a
// proper dev client build. It is not available in Expo Go or on web.
let TaskManager: any = null;
if (Platform.OS !== 'web') {
  try {
    TaskManager = require('expo-task-manager');
  } catch (e) {
    console.warn('expo-task-manager not available, background push processing disabled');
  }
}

const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND_NOTIFICATION_TASK';

if (TaskManager) {
  TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, ({ data, error }: { data?: any; error?: any }) => {
    if (error) {
      console.error('Background notification task error:', error);
      return;
    }
    if (data) {
      const notification = data.notification;
      const notificationData = notification?.request?.content?.data;
      console.log('📬 Background notification received:', notificationData);
    }
  });
}

// Get Project ID from Expo constants (app.json)
// This is more reliable than hardcoding and works with EAS project linking
const getProjectId = (): string | undefined => {
  // First try to get from Expo constants (app.json extra.eas.projectId)
  const easProjectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (easProjectId) {
    return easProjectId;
  }
  
  // Fallback for older Expo SDK versions
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  if (extra?.eas) {
    const eas = extra.eas as Record<string, unknown>;
    return eas.projectId as string | undefined;
  }
  
  return undefined;
};

const EXPO_PROJECT_ID = getProjectId();

if (EXPO_PROJECT_ID) {
  console.log('🔔 Push notifications using EAS Project ID:', EXPO_PROJECT_ID);
} else {
  console.warn('⚠️ EAS Project ID not found in app config. Push notifications will fail. Check app.json extra.eas.projectId');
}

// API methods will be imported from api.ts after we add them
// For now, we'll define the API call inline to avoid circular dependencies
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:5001/api';

// Configure notification handling behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface PushNotificationState {
  hasPermission: boolean;
  token: string | null;
  error: string | null;
  isLoading: boolean;
}

interface RegisterPushTokenResponse {
  data?: {
    success?: boolean;
    message?: string;
  };
  status?: number;
}

/**
 * Custom hook for managing push notification registration
 * Handles permission requests, token retrieval, and backend registration
 */
export function usePushNotifications() {
  const [state, setState] = useState<PushNotificationState>({
    hasPermission: false,
    token: null,
    error: null,
    isLoading: false,
  });

  const isRegisteredRef = useRef(false);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 3;

  // Register push token with backend
  const registerTokenWithBackend = useCallback(async (pushToken: string): Promise<boolean> => {
    try {
      const deviceInfo = Device?.modelName || Platform.OS === 'ios' ? 'iOS Device' : 'Android Device';
      // Register as 'expo' platform: the backend stores Expo push tokens and
      // the push service routes them through the Expo Push API. Using
      // Platform.OS ('ios'/'android') caused the backend to skip these tokens
      // and never deliver pushes to offline devices.
      const platform = 'expo';

      const authToken = await AsyncStorage.getItem('authToken');
      
      const response = await fetch(`${API_URL}/notifications/register-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': authToken || '',
        },
        body: JSON.stringify({
          token: pushToken,
          device: deviceInfo,
          platform: platform,
        }),
      });

      if (response.ok) {
        const data: RegisterPushTokenResponse = await response.json();
        console.log('✅ Push token registered with backend:', data?.data?.message || 'Success');
        return true;
      } else {
        console.warn('⚠️ Failed to register push token with backend:', response.status);
        return false;
      }
    } catch (error) {
      console.error('❌ Error registering push token with backend:', error);
      return false;
    }
  }, []);

  // Request notification permissions
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      // Check if device (expo-device may not be installed)
      const isPhysicalDevice = Device?.isDevice ?? true; // Default to true if check fails
      
      if (!isPhysicalDevice) {
        console.log('⏭️ Push notifications require a physical device');
        setState(prev => ({ 
          ...prev, 
          error: 'Push notifications require a physical device',
          isLoading: false 
        }));
        return false;
      }

      const { granted: existingStatus } = await Notifications.getPermissionsAsync() as any;
      
      if (existingStatus) {
        setState(prev => ({ ...prev, hasPermission: true }));
        return true;
      }

      if (!existingStatus) {
        setState(prev => ({ 
          ...prev, 
          hasPermission: false,
          error: 'Notification permissions were denied. Please enable in Settings.',
          isLoading: false 
        }));
        return false;
      }

      // Request permissions
      const { granted } = await Notifications.requestPermissionsAsync() as any;
      
      if (granted) {
        setState(prev => ({ ...prev, hasPermission: true }));
        return true;
      } else if (!granted) {
        setState(prev => ({ 
          ...prev, 
          hasPermission: false,
          error: 'Notification permissions were denied. Please enable in Settings.',
          isLoading: false 
        }));
        return false;
      }

      return false;
    } catch (error) {
      console.error('❌ Error requesting notification permissions:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to request notification permissions',
        isLoading: false 
      }));
      return false;
    }
  }, []);

  // Get and register Expo push token
  const registerPushToken = useCallback(async (): Promise<boolean> => {
    if (isRegisteredRef.current) {
      console.log('⏭️ Already registered push token, skipping...');
      return true;
    }

    // Check if project ID is configured
    if (!EXPO_PROJECT_ID) {
      const errorMsg = '❌ EAS Project ID not configured. Please run "eas project:create" or link to an existing project.';
      console.error(errorMsg);
      console.error('To fix: Run "eas project:create" in your project directory to create an EAS project, or check your app.json configuration.');
      setState(prev => ({ ...prev, isLoading: false, error: 'Push notifications require an EAS project. Please configure your project.' }));
      return false;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Request permissions first
      const hasPermission = await requestPermissions();
      
      if (!hasPermission) {
        return false;
      }

      // Get the Expo push token
      const expoPushToken = await Notifications.getExpoPushTokenAsync({
        projectId: EXPO_PROJECT_ID,
      });

      const token = expoPushToken.data;
      
      if (!token) {
        throw new Error('Failed to get Expo push token');
      }

      console.log('📱 Expo Push Token:', token);

      // Register with backend (with retry logic)
      let success = false;
      while (retryCountRef.current < MAX_RETRIES && !success) {
        success = await registerTokenWithBackend(token);
        if (!success) {
          retryCountRef.current++;
          if (retryCountRef.current < MAX_RETRIES) {
            console.log(`🔄 Retrying push token registration (${retryCountRef.current}/${MAX_RETRIES})...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCountRef.current));
          }
        }
      }

      if (success) {
        isRegisteredRef.current = true;
        retryCountRef.current = 0;
        
        setState(prev => ({ 
          ...prev, 
          token, 
          hasPermission: true,
          isLoading: false,
          error: null 
        }));
        return true;
      } else {
        setState(prev => ({ 
          ...prev, 
          token,
          hasPermission: true,
          isLoading: false,
          error: 'Failed to register push token with server after multiple attempts'
        }));
        // Still return true since we got the token, just backend registration failed
        return true;
      }
    } catch (error: any) {
       console.error('❌ Error registering push token:', error);
       console.error('Error details:', {
         message: error.message,
         stack: error.stack,
         code: error.code,
         name: error.name
       });
       setState(prev => ({
         ...prev,
         isLoading: false,
         error: error.message || 'Failed to get push token'
       }));
       return false;
     }
  }, [requestPermissions, registerTokenWithBackend]);

  // Set up Android notification channels used by backend-pushed notifications.
  // The backend sends push messages with channelId 'default' (see
  // backend/services/push-notification.js). If this channel doesn't exist on
  // Android, the OS silently drops the notification — which is why chat
  // messages (and other backend pushes) never appear while local call
  // notifications (using the 'incoming-calls' channel) do.
  const setupNotificationChannels = useCallback(async (): Promise<void> => {
    if (Platform.OS !== 'android' || !Notifications?.setNotificationChannelAsync) {
      return;
    }
    try {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        sound: undefined,
        showBadge: true,
      });
    } catch (error) {
      console.error('❌ Error setting up notification channels:', error);
    }
  }, []);

  // Register background notification task so the app can process pushes
  // while backgrounded or terminated (iOS requires contentAvailable: true
  // in the push payload, which the backend now sets).
  const registerBackgroundTask = useCallback(async (): Promise<boolean> => {
    if (!TaskManager || !Notifications?.registerTaskAsync) {
      console.log('⏭️ Background notification task not available (expo-task-manager not installed)');
      return false;
    }
    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) {
        return false;
      }
      await Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
      console.log('✅ Background notification task registered');
      return true;
    } catch (error) {
      console.error('❌ Error registering background notification task:', error);
      return false;
    }
  }, [requestPermissions]);

  // Unregister push token from backend (for logout)
  const unregisterPushToken = useCallback(async (): Promise<boolean> => {
    if (!state.token) {
      return true;
    }

    try {
      const authToken = await AsyncStorage.getItem('authToken');
      
      const response = await fetch(`${API_URL}/notifications/unregister-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': authToken || '',
        },
        body: JSON.stringify({
          token: state.token,
        }),
      });

      if (response.ok) {
        console.log('✅ Push token unregistered from backend');
        isRegisteredRef.current = false;
        setState(prev => ({ 
          ...prev, 
          token: null,
          error: null 
        }));
        return true;
      } else {
        console.warn('⚠️ Failed to unregister push token:', response.status);
        return false;
      }
    } catch (error) {
      console.error('❌ Error unregistering push token:', error);
      return false;
    }
  }, [state.token]);

  // Re-register when user logs in (exposed function)
  const reRegisterOnLogin = useCallback(async (): Promise<boolean> => {
    console.log('🔔 Re-registering push notifications on login...');
    isRegisteredRef.current = false;
    retryCountRef.current = 0;
    return await registerPushToken();
  }, [registerPushToken]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      // Cleanup if needed
    };
  }, []);

  // Set up notification handlers for incoming notifications
  useEffect(() => {
    // This is handled in _layout.tsx for now
    // but can be enhanced here if needed
  }, []);

  return {
    ...state,
    registerPushToken,
    unregisterPushToken,
    reRegisterOnLogin,
    setupNotificationChannels,
    registerBackgroundTask,
  };
}

export default usePushNotifications;
