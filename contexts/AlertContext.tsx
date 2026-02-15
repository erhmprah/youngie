// contexts/AlertContext.tsx

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from 'react';
import { AlertType, AlertButton } from '@/components/ui/CustomAlertModal';
import { setAlertContext } from '@/utils/alert';

interface AlertState {
  visible: boolean;
  type: AlertType;
  title: string;
  message?: string;
  buttons: AlertButton[];
  dismissable: boolean;
  loading?: boolean;
}

interface AlertContextType {
  alert: AlertState;
  showAlert: (params: {
    type?: AlertType;
    title: string;
    message?: string;
    buttons?: AlertButton[];
    dismissable?: boolean;
    loading?: boolean;
  }) => void;
  hideAlert: () => void;
  // Convenience methods
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  confirm: (title: string, message: string, onConfirm: () => void) => void;
  loading: (title: string, message?: string) => void;
}

const defaultAlert: AlertState = {
  visible: false,
  type: 'info',
  title: '',
  message: '',
  buttons: [],
  dismissable: true,
};

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const AlertProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [alert, setAlert] = useState<AlertState>(defaultAlert);
  
  // Use refs to store the latest callback functions
  const alertRef = useRef(alert);
  const hideAlertRef = useRef<() => void>(() => {});
  const showAlertRef = useRef<AlertContextType['showAlert']>(() => {});
  const successRef = useRef<AlertContextType['success']>(() => {});
  const errorRef = useRef<AlertContextType['error']>(() => {});
  const warningRef = useRef<AlertContextType['warning']>(() => {});
  const infoRef = useRef<AlertContextType['info']>(() => {});
  const confirmRef = useRef<AlertContextType['confirm']>(() => {});
  const loadingRef = useRef<AlertContextType['loading']>(() => {});

  const showAlert = useCallback((params: {
    type?: AlertType;
    title: string;
    message?: string;
    buttons?: AlertButton[];
    dismissable?: boolean;
    loading?: boolean;
  }) => {
    setAlert({
      visible: true,
      type: params.type || 'info',
      title: params.title,
      message: params.message,
      buttons: params.buttons || [],
      dismissable: params.dismissable !== undefined ? params.dismissable : true,
      loading: params.loading,
    });
  }, []);

  const hideAlert = useCallback(() => {
    setAlert(defaultAlert);
  }, []);

  // Convenience methods
  const success = useCallback((title: string, message?: string) => {
    showAlert({ type: 'success', title, message });
  }, [showAlert]);

  const error = useCallback((title: string, message?: string) => {
    showAlert({ type: 'error', title, message });
  }, [showAlert]);

  const warning = useCallback((title: string, message?: string) => {
    showAlert({ type: 'warning', title, message });
  }, [showAlert]);

  const info = useCallback((title: string, message?: string) => {
    showAlert({ type: 'info', title, message });
  }, [showAlert]);

  const confirm = useCallback((title: string, message: string, onConfirm: () => void) => {
    showAlert({
      type: 'confirm',
      title,
      message,
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', style: 'default', onPress: onConfirm },
      ],
    });
  }, [showAlert]);

  const loading = useCallback((title: string, message?: string) => {
    showAlert({ type: 'loading', title, message, loading: true, dismissable: false });
  }, [showAlert]);

  // Update refs when functions change
  useEffect(() => {
    alertRef.current = alert;
    hideAlertRef.current = hideAlert;
    showAlertRef.current = showAlert;
    successRef.current = success;
    errorRef.current = error;
    warningRef.current = warning;
    infoRef.current = info;
    confirmRef.current = confirm;
    loadingRef.current = loading;
  }, [alert, hideAlert, showAlert, success, error, warning, info, confirm, loading]);

  // Register context for CustomAlert utility
  useEffect(() => {
    setAlertContext({
      get alert() { return alertRef.current; },
      showAlert: (...args: Parameters<typeof showAlertRef.current>) => showAlertRef.current(...args),
      hideAlert: () => hideAlertRef.current(),
      success: (...args: Parameters<typeof successRef.current>) => successRef.current(...args),
      error: (...args: Parameters<typeof errorRef.current>) => errorRef.current(...args),
      warning: (...args: Parameters<typeof warningRef.current>) => warningRef.current(...args),
      info: (...args: Parameters<typeof infoRef.current>) => infoRef.current(...args),
      confirm: (...args: Parameters<typeof confirmRef.current>) => confirmRef.current(...args),
      loading: (...args: Parameters<typeof loadingRef.current>) => loadingRef.current(...args),
    });
    return () => {
      setAlertContext(null as any);
    };
  }, []);

  return (
    <AlertContext.Provider value={{ alert, showAlert, hideAlert, success, error, warning, info, confirm, loading }}>
      {children}
    </AlertContext.Provider>
  );
};

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    // Return a no-op implementation if context is not available
    return {
      alert: defaultAlert,
      showAlert: () => {},
      hideAlert: () => {},
      success: () => {},
      error: () => {},
      warning: () => {},
      info: () => {},
      confirm: () => {},
      loading: () => {},
    };
  }
  return context;
};
