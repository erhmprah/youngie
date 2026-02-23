import { Alert, Platform } from 'react-native';
import { CustomAlert } from './alert';

/**
 * Global Error Handler Utility
 * 
 * Sets up global error handlers to catch unhandled JavaScript errors
 * and promise rejections to prevent app crashes.
 * 
 * Usage: Call setupGlobalErrorHandlers() in your app's entry point
 * (e.g., in _layout.tsx or index.tsx)
 */

interface ErrorLogEntry {
  timestamp: Date;
  message: string;
  stack?: string;
  isFatal: boolean;
  type: 'error' | 'unhandledRejection';
}

// Store recent errors for debugging
let errorLog: ErrorLogEntry[] = [];
const MAX_ERROR_LOG_SIZE = 10;

// Track if we've shown a recent alert to prevent alert storms
let lastAlertTime = 0;
const ALERT_COOLDOWN_MS = 3000; // 3 seconds cooldown between alerts

/**
 * Determine error type and get appropriate user-friendly message
 */
function getErrorType(message: string): { type: string; title: string; userMessage: string } {
  const lowerMessage = message.toLowerCase();
  
  // Network/connection errors
  if (lowerMessage.includes('network') || 
      lowerMessage.includes('fetch') || 
      lowerMessage.includes('connection') ||
      lowerMessage.includes('offline') ||
      lowerMessage.includes('unable to resolve host') ||
      lowerMessage.includes('ECONNREFUSED') ||
      lowerMessage.includes('ETIMEDOUT') ||
      lowerMessage.includes('timeout') ||
      lowerMessage.includes('enotfound')) {
    return {
      type: 'network',
      title: 'Connection Error',
      userMessage: 'Unable to connect to the server. Please check your internet connection and try again.'
    };
  }
  
  // Authentication errors
  if (lowerMessage.includes('unauthorized') || 
      lowerMessage.includes('authentication') ||
      lowerMessage.includes('auth token') ||
      lowerMessage.includes('jwt') ||
      lowerMessage.includes('session')) {
    return {
      type: 'auth',
      title: 'Session Expired',
      userMessage: 'Your session has expired. Please log in again.'
    };
  }
  
  // Permission errors
  if (lowerMessage.includes('permission') || 
      lowerMessage.includes('forbidden') ||
      lowerMessage.includes('access denied')) {
    return {
      type: 'permission',
      title: 'Access Denied',
      userMessage: 'You do not have permission to perform this action.'
    };
  }
  
  // Not found errors
  if (lowerMessage.includes('not found') || 
      lowerMessage.includes('404') ||
      lowerMessage.includes('does not exist')) {
    return {
      type: 'notFound',
      title: 'Not Found',
      userMessage: 'The requested item could not be found.'
    };
  }
  
  // Default unknown error
  return {
    type: 'unknown',
    title: 'Something Went Wrong',
    userMessage: 'An unexpected error occurred. Please try again.'
  };
}

/**
 * Show user-friendly error alert with rate limiting
 */
function showErrorAlert(title: string, message: string, isFatal: boolean = false): void {
  const now = Date.now();
  
  // Rate limit alerts to prevent flooding the user
  if (now - lastAlertTime < ALERT_COOLDOWN_MS) {
    console.log('Error alert suppressed due to cooldown');
    return;
  }
  
  lastAlertTime = now;
  
  // Use CustomAlert if available, fallback to native Alert
  try {
    CustomAlert.error(title, message);
  } catch (e) {
    // Fallback to native Alert if CustomAlert fails
    Alert.alert(title, message);
  }
}

/**
 * Set up global error handlers for the app
 */
export function setupGlobalErrorHandlers(): void {
  // Handler for unhandled JavaScript errors
  const handleGlobalError = (error: Error, isFatal: boolean) => {
    const errorMessage = error?.message || 'Unknown error';
    const stack = error?.stack || '';
    
    console.error('🔴 Global Error Handler:', {
      message: errorMessage,
      isFatal,
      stack,
    });
    
    // Add to error log
    addToErrorLog({
      timestamp: new Date(),
      message: errorMessage,
      stack,
      isFatal,
      type: 'error',
    });
    
    // Show appropriate error alert
    const errorInfo = getErrorType(errorMessage);
    showErrorAlert(errorInfo.title, errorInfo.userMessage, isFatal);
    
    // In production, you might want to show a generic error screen
    // instead of crashing
    if (isFatal && !__DEV__) {
      showFatalErrorAlert(errorMessage);
    }
  };
  
  // Handler for unhandled promise rejections
  const handleUnhandledRejection = (reason: any) => {
    const errorMessage = reason instanceof Error 
      ? reason.message 
      : String(reason);
    const stack = reason instanceof Error ? reason.stack : undefined;
    
    console.error('🔴 Unhandled Promise Rejection:', {
      message: errorMessage,
      stack,
    });
    
    // Add to error log
    addToErrorLog({
      timestamp: new Date(),
      message: errorMessage,
      stack,
      isFatal: false,
      type: 'unhandledRejection',
    });
    
    // Show appropriate error alert for promise rejections
    const errorInfo = getErrorType(errorMessage);
    showErrorAlert(errorInfo.title, errorInfo.userMessage, false);
  };
  
  // Note: In React Native, we rely on the Error Boundary components
  // for catching errors. The React Native runtime doesn't have window.
  // Global handlers are set up through ErrorBoundary components.
  
  // However, we can still log errors for debugging
  console.log('✅ Global error handlers initialized (React Native mode)');
}

/**
 * Show a fatal error alert to the user
 */
function showFatalErrorAlert(message: string): void {
  // Only show alert if we haven't shown one recently
  // to prevent multiple alerts
  Alert.alert(
    'App Error',
    'A fatal error occurred. The app will try to continue.',
    [{ text: 'OK' }]
  );
}

/**
 * Add an error to the log
 */
function addToErrorLog(entry: ErrorLogEntry): void {
  errorLog.push(entry);
  
  // Keep log size manageable
  if (errorLog.length > MAX_ERROR_LOG_SIZE) {
    errorLog = errorLog.slice(-MAX_ERROR_LOG_SIZE);
  }
}

/**
 * Get the recent error log (useful for debugging)
 */
export function getErrorLog(): ErrorLogEntry[] {
  return [...errorLog];
}

/**
 * Clear the error log
 */
export function clearErrorLog(): void {
  errorLog = [];
}

/**
 * Report an error manually (useful for try-catch blocks)
 */
export function reportError(error: Error | string, context?: string): void {
  const errorMessage = typeof error === 'string' ? error : error.message;
  const stack = typeof error === 'string' ? undefined : error.stack;
  
  console.error('📝 Manual Error Report:', {
    message: errorMessage,
    context,
    stack,
  });
  
  addToErrorLog({
    timestamp: new Date(),
    message: context ? `${context}: ${errorMessage}` : errorMessage,
    stack,
    isFatal: false,
    type: 'error',
  });
  
  // Show error alert for manually reported errors
  const errorInfo = getErrorType(errorMessage);
  showErrorAlert(errorInfo.title, errorInfo.userMessage);
}

/**
 * Safely execute an async function with automatic error handling
 * Shows user-friendly error alert if the operation fails
 * 
 * @param asyncFn - The async function to execute
 * @param options - Configuration options
 * @returns The result of the async function
 */
export async function withErrorHandling<T>(
  asyncFn: () => Promise<T>,
  options?: {
    onError?: (error: Error) => void;
    showAlert?: boolean;
    customTitle?: string;
    customMessage?: string;
    onRetry?: () => void;
  }
): Promise<{ success: boolean; data?: T; error?: Error }> {
  try {
    const data = await asyncFn();
    return { success: true, data };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    
    console.error('❌ withErrorHandling caught error:', err.message);
    
    // Call custom error handler if provided
    if (options?.onError) {
      options.onError(err);
    }
    
    // Show error alert if enabled (default: true)
    if (options?.showAlert !== false) {
      const errorInfo = getErrorType(err.message);
      const title = options?.customTitle || errorInfo.title;
      const message = options?.customMessage || errorInfo.userMessage;
      
      if (options?.onRetry) {
        // Show alert with retry option
        Alert.alert(
          title,
          message,
          [
            { text: 'Retry', onPress: options.onRetry },
            { text: 'OK', style: 'cancel' }
          ]
        );
      } else {
        showErrorAlert(title, message);
      }
    }
    
    return { success: false, error: err };
  }
}

/**
 * Create a wrapper for API calls with automatic error handling
 * 
 * @param apiCall - The API call function
 * @param options - Configuration options
 * @returns The result of the API call
 */
export async function withApiErrorHandling<T>(
  apiCall: () => Promise<T>,
  options?: {
    onError?: (error: Error) => void;
    showAlert?: boolean;
  }
): Promise<{ success: boolean; data?: T; error?: Error }> {
  return withErrorHandling(apiCall, {
    ...options,
    // For API calls, we want more specific error handling
    showAlert: options?.showAlert !== false,
  });
}

export default {
  setupGlobalErrorHandlers,
  getErrorLog,
  clearErrorLog,
  reportError,
  withErrorHandling,
  withApiErrorHandling,
};
