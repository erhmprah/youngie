// utils/alert.ts

import { Alert, AlertButton as RNAlertButton } from 'react-native';
import { useAlert } from '@/contexts/AlertContext';
import { AlertType, AlertButton } from '@/components/ui/CustomAlertModal';

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
      
      Alert.alert(options.title, options.message, rnButtons);
    }
  },

  /**
   * Show a success alert
   */
  success: (title: string, message?: string) => {
    if (alertContextRef) {
      alertContextRef.success(title, message);
    } else {
      Alert.alert(title, message);
    }
  },

  /**
   * Show an error alert
   */
  error: (title: string, message?: string) => {
    if (alertContextRef) {
      alertContextRef.error(title, message);
    } else {
      Alert.alert(title, message);
    }
  },

  /**
   * Show a warning alert
   */
  warning: (title: string, message?: string) => {
    if (alertContextRef) {
      alertContextRef.warning(title, message);
    } else {
      Alert.alert(title, message);
    }
  },

  /**
   * Show an info alert
   */
  info: (title: string, message?: string) => {
    if (alertContextRef) {
      alertContextRef.info(title, message);
    } else {
      Alert.alert(title, message);
    }
  },

  /**
   * Show a confirmation alert
   */
  confirm: (title: string, message: string, onConfirm: () => void, onCancel?: () => void) => {
    if (alertContextRef) {
      alertContextRef.confirm(title, message, onConfirm);
    } else {
      Alert.alert(title, message, [
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
   * Direct alias to native Alert for full compatibility
   * Use this when you need exact native Alert behavior
   */
  native: Alert,
};

/**
 * Hook to access the custom alert context
 * Use this in components to get access to the alert methods
 */
export const useCustomAlert = () => {
  return useAlert();
};
