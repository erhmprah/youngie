import { router } from 'expo-router';
import { CustomAlert } from './alert';
import { toUserError, type UserError } from './error-messages';

/**
 * Parses an error into title and message that are always safe to show.
 * All network, Supabase, socket, and backend text is normalised here.
 */
export function parseError(error: any, fallback?: string): UserError {
  return toUserError(error, { fallback });
}

/**
 * Shows an alert with the parsed error
 */
export function showErrorAlert(error: any, onRetry?: () => void) {
  const { title, message } = parseError(error);

  if (onRetry) {
    CustomAlert.show({
      type: 'error',
      title,
      message,
      buttons: [
        { text: 'Retry', onPress: onRetry, style: 'default' },
        { text: 'OK', style: 'cancel' }
      ],
      dismissable: true
    });
  } else {
    CustomAlert.error(title, message);
  }
}

/**
 * Shows a network error alert with retry option
 */
export function showNetworkErrorAlert(onRetry?: () => void) {
  const message = 'We could not reach the server. Please check your internet connection and try again.';

  if (onRetry) {
    CustomAlert.show({
      type: 'error',
      title: 'No Connection',
      message,
      buttons: [
        { text: 'Retry', onPress: onRetry, style: 'default' },
        { text: 'OK', style: 'cancel' }
      ],
      dismissable: true
    });
  } else {
    CustomAlert.error('No Connection', message);
  }
}

/**
 * Shows a session expired alert and redirects to login
 */
export function showSessionExpiredAlert() {
  CustomAlert.confirm(
    'Session Expired',
    'Your session has expired. Please log in again.',
    () => router.replace('/login')
  );
}
