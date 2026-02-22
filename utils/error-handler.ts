import { Alert } from 'react-native';
import { router } from 'expo-router';

/**
 * Parses an error and returns user-friendly title and message
 */
export function parseError(error: any): { title: string; message: string } {
  let errorMessage = 'An unexpected error occurred. Please try again.';
  let errorTitle = 'Error';

  // Check for axios network error codes
  const isNetworkError =
    error.code === 'ECONNREFUSED' ||
    error.code === 'ENOTFOUND' ||
    error.code === 'ETIMEDOUT' ||
    error.code === 'ERR_NETWORK' ||
    error.message?.toLowerCase().includes('network error') ||
    error.message?.toLowerCase().includes('econrefused') ||
    error.message?.toLowerCase().includes('timeout') ||
    error.message?.toLowerCase().includes('unable to connect');

  // Check for axios error
  if (error.response) {
    // Server responded with error status
    const status = error.response.status;
    const serverMessage = error.response.data?.msg || error.response.data?.message;

    if (status === 400) {
      errorTitle = 'Invalid Request';
      errorMessage = serverMessage || 'Please check your input and try again.';
    } else if (status === 401) {
      errorTitle = 'Unauthorized';
      errorMessage = 'Your session has expired. Please login again.';
    } else if (status === 403) {
      errorTitle = 'Access Denied';
      errorMessage = 'You do not have permission to perform this action.';
    } else if (status === 404) {
      errorTitle = 'Not Found';
      errorMessage = serverMessage || 'The requested resource was not found.';
    } else if (status === 409) {
      errorTitle = 'Conflict';
      errorMessage = serverMessage || 'A conflict occurred. Please try again.';
    } else if (status === 429) {
      errorTitle = 'Too Many Requests';
      errorMessage = 'Please wait a moment before trying again.';
    } else if (status === 500) {
      errorTitle = 'Server Error';
      errorMessage = 'Something went wrong on our end. Please try again later.';
    } else if (status >= 500) {
      errorTitle = 'Service Unavailable';
      errorMessage = 'The service is temporarily unavailable. Please try again later.';
    } else {
      errorMessage = serverMessage || 'An error occurred. Please try again.';
    }
  } else if (error.request || isNetworkError) {
    // Network error - no response received or connection failed
    errorTitle = 'Connection Error';
    errorMessage = 'Unable to connect to the server. Please check your internet connection and make sure the backend is running.';
  } else {
    // Check for specific error messages
    const errorStr = error.toString().toLowerCase();
    
    if (errorStr.includes('email') && (errorStr.includes('exists') || errorStr.includes('already'))) {
      errorTitle = 'Email Already Registered';
      errorMessage = 'An account with this email already exists. Please login instead.';
    } else if (errorStr.includes('username') && (errorStr.includes('taken') || errorStr.includes('exists'))) {
      errorTitle = 'Username Taken';
      errorMessage = 'This username is already taken. Please choose a different one.';
    } else {
      // Use the error message if it's user-friendly
      const userMessage = error.message || error.toString();
      if (userMessage && !userMessage.includes('Error:') && userMessage.length < 100 && !userMessage.includes('\n')) {
        errorMessage = userMessage;
      }
    }
  }

  return { title: errorTitle, message: errorMessage };
}

/**
 * Shows an alert with the parsed error
 */
export function showErrorAlert(error: any, onRetry?: () => void) {
  const { title, message } = parseError(error);
  
  if (onRetry) {
    Alert.alert(
      title,
      message,
      [
        { text: 'Retry', onPress: onRetry },
        { text: 'OK', style: 'cancel' }
      ]
    );
  } else {
    Alert.alert(title, message);
  }
}

/**
 * Shows a network error alert with retry option
 */
export function showNetworkErrorAlert(onRetry?: () => void) {
  if (onRetry) {
    Alert.alert(
      'Connection Error',
      'Unable to connect to the server. Please check your internet connection and make sure the backend is running.',
      [
        { text: 'Retry', onPress: onRetry },
        { text: 'OK', style: 'cancel' }
      ]
    );
  } else {
    Alert.alert(
      'Connection Error',
      'Unable to connect to the server. Please check your internet connection and make sure the backend is running.'
    );
  }
}

/**
 * Shows a session expired alert and redirects to login
 */
export function showSessionExpiredAlert() {
  Alert.alert(
    'Session Expired',
    'Your session has expired. Please login again.',
    [
      { 
        text: 'Login', 
        onPress: () => router.replace('/login')
      }
    ]
  );
}
