import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ThemedView } from './themed-view';
import { ThemedText } from './themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class FirebaseErrorBoundaryClass extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error to console or error reporting service
    console.error('Firebase Error Boundary caught an error:', error, errorInfo);

    // Check if it's a Firebase-related error
    const isFirebaseError = error.message.includes('firebase') ||
                           error.message.includes('Firebase') ||
                           error.stack?.includes('firebase') ||
                           error.stack?.includes('Firebase');

    if (isFirebaseError) {
      console.error('Firebase error detected:', error);
    }
  }

  handleRetry = () => {
    // Reset error state and trigger a re-render
    this.setState({ hasError: false, error: undefined });
    // Optionally trigger a refresh or reconnection logic here
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return <FirebaseErrorFallback error={this.state.error} onRetry={this.handleRetry} />;
    }

    return this.props.children;
  }
}

const FirebaseErrorFallback: React.FC<{ error?: Error; onRetry: () => void }> = ({ error, onRetry }) => {
  const primaryColor = useThemeColor('primary');
  const backgroundColor = useThemeColor('background');
  const textColor = useThemeColor('text');
  const errorColor = useThemeColor('error');

  const isOfflineError = error?.message?.includes('offline') ||
                        error?.message?.includes('network') ||
                        error?.code === 'unavailable';

  return (
    <ThemedView style={[styles.container, { backgroundColor }]}>
      <ThemedText style={[styles.title, { color: errorColor }]}>
        {isOfflineError ? 'Connection Issue' : 'Something went wrong'}
      </ThemedText>
      <ThemedText style={[styles.message, { color: textColor }]}>
        {isOfflineError
          ? 'You appear to be offline. Please check your connection and try again.'
          : 'We encountered an issue with our services. Please try again.'
        }
      </ThemedText>
      {error && !isOfflineError && (
        <ThemedText style={[styles.errorDetails, { color: textColor }]}>
          Error: {error.message}
        </ThemedText>
      )}
      <TouchableOpacity
        style={[styles.retryButton, { backgroundColor: primaryColor }]}
        onPress={onRetry}
      >
        <ThemedText style={[styles.retryText, { color: backgroundColor }]}>
          Try Again
        </ThemedText>
      </TouchableOpacity>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  errorDetails: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 20,
    opacity: 0.7,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  retryText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export const FirebaseErrorBoundary: React.FC<Props> = (props) => {
  return <FirebaseErrorBoundaryClass {...props} />;
};