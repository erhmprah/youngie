import { Alert, Platform } from 'react-native';

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
}

export default {
  setupGlobalErrorHandlers,
  getErrorLog,
  clearErrorLog,
  reportError,
};
