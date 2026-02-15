import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
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
  errorInfo?: ErrorInfo;
}

/**
 * GlobalErrorBoundary - Catches React component errors to prevent app crashes
 * and shows user-friendly error screens instead of crashing.
 */
class GlobalErrorBoundaryClass extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error for debugging
    console.error('GlobalErrorBoundary caught an error:', error, errorInfo);
    
    // Store error info for display
    this.setState({ errorInfo });
    
    // You can also send to error reporting service here
    // sendToErrorReportingService(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  handleReportError = () => {
    const { error } = this.state;
    if (error) {
      Alert.alert(
        'Report Issue',
        `Error: ${error.message}\n\nWould you like to copy error details?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Copy', 
            onPress: () => {
              // In a real app, you could copy to clipboard or send to support
              console.log('Error reported:', error);
            }
          },
        ]
      );
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <GlobalErrorFallback 
          error={this.state.error} 
          errorInfo={this.state.errorInfo}
          onRetry={this.handleRetry}
          onReport={this.handleReportError}
        />
      );
    }

    return this.props.children;
  }
}

interface FallbackProps {
  error?: Error;
  errorInfo?: ErrorInfo;
  onRetry: () => void;
  onReport: () => void;
}

const GlobalErrorFallback: React.FC<FallbackProps> = ({ error, errorInfo, onRetry, onReport }) => {
  const primaryColor = useThemeColor('primary');
  const backgroundColor = useThemeColor('background');
  const textColor = useThemeColor('text');
  const errorColor = useThemeColor('error');
  const borderColor = useThemeColor('border');

  // Determine error type for better user messaging
  const errorMessage = error?.message || '';
  const isOfflineError = errorMessage.includes('offline') ||
                        errorMessage.includes('network') ||
                        errorMessage.includes('fetch') ||
                        errorMessage.includes('Network request failed') ||
                        errorMessage.includes('unable to resolve host');
  
  const isAuthError = errorMessage.includes('auth') ||
                     errorMessage.includes('permission') ||
                     errorMessage.includes('unauthorized');
  
  const isMemoryError = errorMessage.includes('memory') ||
                        errorMessage.includes('out of memory');

  const getErrorTitle = () => {
    if (isOfflineError) return 'Connection Issue';
    if (isAuthError) return 'Authentication Error';
    if (isMemoryError) return 'Memory Issue';
    return 'Something went wrong';
  };

  const getErrorMessage = () => {
    if (isOfflineError) {
      return 'You appear to be offline. Please check your internet connection and try again.';
    }
    if (isAuthError) {
      return 'There was an issue with your session. Please try logging in again.';
    }
    if (isMemoryError) {
      return 'The app ran out of memory. Please try closing other apps and restart.';
    }
    return 'We encountered an unexpected issue. The app will try to recover when you tap retry.';
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor }]}>
      <View style={[styles.iconContainer, { borderColor: errorColor }]}>
        <Text style={[styles.errorIcon, { color: errorColor }]}>⚠️</Text>
      </View>
      
      <ThemedText style={[styles.title, { color: errorColor }]}>
        {getErrorTitle()}
      </ThemedText>
      
      <ThemedText style={[styles.message, { color: textColor }]}>
        {getErrorMessage()}
      </ThemedText>
      
      {error && __DEV__ && (
        <View style={[styles.errorDetailsContainer, { borderColor }]}>
          <ThemedText style={[styles.errorDetails, { color: textColor }]}>
            {error.message}
          </ThemedText>
          {errorInfo?.componentStack && (
            <ThemedText style={[styles.stackTrace, { color: textColor }]}>
              {errorInfo.componentStack}
            </ThemedText>
          )}
        </View>
      )}
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: primaryColor }]}
          onPress={onRetry}
        >
          <ThemedText style={[styles.buttonText, { color: backgroundColor }]}>
            Try Again
          </ThemedText>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.reportButton, { borderColor: primaryColor }]}
          onPress={onReport}
        >
          <ThemedText style={[styles.reportText, { color: primaryColor }]}>
            Report Issue
          </ThemedText>
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  errorIcon: {
    fontSize: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  errorDetailsContainer: {
    width: '100%',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 20,
    maxHeight: 150,
  },
  errorDetails: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
  stackTrace: {
    fontSize: 10,
    fontFamily: 'monospace',
    marginTop: 8,
    opacity: 0.7,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  retryButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  reportButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  reportText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

/**
 * Higher-order component that wraps your component with
 * the global error boundary.
 */
export function withGlobalErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>
): React.FC<P> {
  return function WithGlobalErrorBoundary(props: P) {
    return (
      <GlobalErrorBoundary>
        <WrappedComponent {...props} />
      </GlobalErrorBoundary>
    );
  };
}

export const GlobalErrorBoundary: React.FC<Props> = (props) => {
  return <GlobalErrorBoundaryClass {...props} />;
};

export default GlobalErrorBoundary;
