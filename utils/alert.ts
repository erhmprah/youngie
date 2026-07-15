// utils/alert.ts

import { Alert, AlertButton as RNAlertButton } from 'react-native';
import { useAlert } from '@/contexts/AlertContext';
import { AlertType, AlertButton } from '@/components/ui/CustomAlertModal';

// Capture the original native Alert so the custom system can fall back to it
// (e.g. before the AlertProvider mounts) and so we can safely override Alert.alert.
const originalAlert = Alert.alert;

// Store the alert context reference globally
type AlertContextValue = {
  alert: {
    visible: boolean;
    type: AlertType;
    title: string;
    message?: string;
  };
  showAlert: (params: {
    type?: AlertType;
    title: string;
    message?: string;
    buttons?: AlertButton[];
    dismissable?: boolean;
    loading?: boolean;
  }) => void;
  hideAlert: () => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  confirm: (title: string, message: string, onConfirm: () => void) => void;
  loading: (title: string, message?: string) => void;
} | null;

let alertContextRef: AlertContextValue = null;

export const setAlertContext = (context: ReturnType<typeof useAlert>) => {
  alertContextRef = context;
};

// Type for the custom alert API
interface CustomAlertOptions {
  type?: AlertType;
  title: string;
  message?: string;
  buttons?: Array<{
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
  }>;
  dismissable?: boolean;
}

/**
 * Custom Alert API that provides a more professional look than the native Alert.
 * Falls back to native Alert if the custom system is not available.
 */
export const CustomAlert = {
  /**
   * Show a custom alert modal
   */
  show: (options: CustomAlertOptions) => {
    if (alertContextRef && alertContextRef.alert) {
      const buttons: AlertButton[] = (options.buttons || []).map(btn => ({
        text: btn.text,
        onPress: btn.onPress,
        style: btn.style || 'default',
      }));
      
      alertContextRef.showAlert({
        type: options.type || 'info',
        title: options.title,
        message: options.message,
        buttons,
        dismissable: options.dismissable,
      });
    } else {
      // Fallback to native Alert
      const rnButtons: RNAlertButton[] = (options.buttons || []).map(btn => ({
        text: btn.text,
        onPress: btn.onPress,
        style: btn.style as 'default' | 'cancel' | 'destructive' | undefined,
      }));
      
      originalAlert(options.title, options.message, rnButtons);
    }
  },

  /**
   * Show a success alert
   */
  success: (title: string, message?: string) => {
    if (alertContextRef) {
      alertContextRef.success(title, message);
    } else {
      originalAlert(title, message);
    }
  },

  /**
   * Show an error alert
   */
  error: (title: string, message?: string) => {
    if (alertContextRef) {
      alertContextRef.error(title, message);
    } else {
      originalAlert(title, message);
    }
  },

  /**
   * Show a warning alert
   */
  warning: (title: string, message?: string) => {
    if (alertContextRef) {
      alertContextRef.warning(title, message);
    } else {
      originalAlert(title, message);
    }
  },

  /**
   * Show an info alert
   */
  info: (title: string, message?: string) => {
    if (alertContextRef) {
      alertContextRef.info(title, message);
    } else {
      originalAlert(title, message);
    }
  },

  /**
   * Show a confirmation alert
   */
  confirm: (title: string, message: string, onConfirm: () => void, onCancel?: () => void) => {
    if (alertContextRef) {
      alertContextRef.confirm(title, message, onConfirm);
    } else {
      originalAlert(title, message, [
        { text: 'Cancel', style: 'cancel', onPress: onCancel },
        { text: 'Confirm', onPress: onConfirm },
      ]);
    }
  },

  /**
   * Show a loading/progress alert (non-dismissable)
   */
  loading: (title: string, message?: string) => {
    if (alertContextRef) {
      alertContextRef.loading(title, message);
    }
    // No native fallback for loading - it would need custom handling
  },

  /**
   * Direct alias to the original native Alert for full compatibility.
   * Use this when you need exact native Alert behavior.
   */
  native: { alert: originalAlert } as typeof Alert,
};

/**
 * Route every native `Alert.alert` call through the custom alert system.
 * react-native's `Alert` is a shared singleton, so mutating its `alert`
 * method affects every `Alert.alert(...)` call in the app (and in any
 * library that uses it). When the AlertProvider context isn't mounted yet,
 * the custom system falls back to the original native alert, so this is safe.
 */
Alert.alert = ((
  title: string,
  message?: string,
  buttons?: RNAlertButton[],
  options?: { cancelable?: boolean; onDismiss?: () => void; userInterfaceStyle?: 'light' | 'dark' },
) => {
  const hasDestructive = Array.isArray(buttons) && buttons.some(b => b.style === 'destructive');
  CustomAlert.show({
    type: hasDestructive ? 'confirm' : 'info',
    title,
    message,
    buttons: buttons?.map(b => ({
      text: b.text || '',
      onPress: b.onPress as (() => void) | undefined,
      style: b.style,
    })),
    dismissable: options?.cancelable !== false,
  });
}) as typeof Alert.alert;

/**
 * Hook to access the custom alert context
 * Use this in components to get access to the alert methods
 */
export const useCustomAlert = () => {
  return useAlert();
};
