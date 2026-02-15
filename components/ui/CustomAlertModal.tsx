// components/ui/CustomAlertModal.tsx

import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/constants/design-tokens';
import { borderRadius, spacing, typography } from '@/constants/design-tokens';

export type AlertType = 'success' | 'error' | 'warning' | 'info' | 'confirm' | 'loading';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
  disabled?: boolean;
}

export interface CustomAlertModalProps {
  visible: boolean;
  type?: AlertType;
  title: string;
  message?: string;
  buttons?: AlertButton[];
  onDismiss?: () => void;
  dismissable?: boolean;
  loading?: boolean;
}

const CustomAlertModal: React.FC<CustomAlertModalProps> = ({
  visible,
  type = 'info',
  title,
  message,
  buttons = [],
  onDismiss,
  dismissable = true,
  loading = false,
}) => {
  const { theme, colorScheme } = useTheme();
  const colors = getColors(theme as 'light' | 'dark', colorScheme as 'blue' | 'magenta');

  const getAlertConfig = () => {
    switch (type) {
      case 'success':
        return {
          iconColor: colors.success,
          iconName: 'checkmark-circle',
        };
      case 'error':
        return {
          iconColor: colors.error,
          iconName: 'close-circle',
        };
      case 'warning':
        return {
          iconColor: colors.warning,
          iconName: 'warning',
        };
      case 'confirm':
        return {
          iconColor: colors.primary,
          iconName: 'help-circle',
        };
      case 'loading':
        return {
          iconColor: colors.primary,
          iconName: 'loading',
        };
      default:
        return {
          iconColor: colors.primary,
          iconName: 'information-circle',
        };
    }
  };

  const getDefaultButtons = (): AlertButton[] => {
    if (buttons.length > 0) return buttons;
    
    switch (type) {
      case 'confirm':
        return [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Confirm', style: 'default' },
        ];
      case 'loading':
        return []; // No buttons for loading state
      default:
        return [{ text: 'OK', style: 'default' }];
    }
  };

  const alertConfig = getAlertConfig();
  const finalButtons = getDefaultButtons();

  const getButtonStyle = (buttonStyle?: 'default' | 'cancel' | 'destructive') => {
    switch (buttonStyle) {
      case 'cancel':
        return { backgroundColor: 'transparent', borderWidth: 0 };
      case 'destructive':
        return { backgroundColor: colors.error };
      default:
        return { backgroundColor: colors.primary };
    }
  };

  const getButtonTextStyle = (buttonStyle?: 'default' | 'cancel' | 'destructive') => {
    switch (buttonStyle) {
      case 'cancel':
        return { color: colors.primary };
      case 'destructive':
        return { color: colors.white };
      default:
        return { color: colors.white };
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (dismissable && onDismiss) {
          onDismiss();
        }
      }}
    >
      <Pressable 
        style={styles.overlay}
        onPress={() => {
          if (dismissable && onDismiss) {
            onDismiss();
          }
        }}
      >
        <Pressable 
          style={[
            styles.container,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Icon */}
          <View style={styles.iconContainer}>
            <AlertIcon type={type} color={alertConfig.iconColor} />
          </View>

          {/* Title */}
          <Text
            style={[
              styles.title,
              {
                color: colors.text,
              },
            ]}
            numberOfLines={2}
          >
            {title}
          </Text>

          {/* Message */}
          {message && (
            <Text
              style={[
                styles.message,
                {
                  color: colors.lightText,
                },
              ]}
              numberOfLines={4}
            >
              {message}
            </Text>
          )}

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            {finalButtons.map((button, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.button,
                  getButtonStyle(button.style),
                  finalButtons.length > 1 && index === 0 && styles.buttonMargin,
                ]}
                onPress={() => {
                  button.onPress?.();
                  onDismiss?.();
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.buttonText,
                    getButtonTextStyle(button.style),
                    button.style === 'cancel' && { fontWeight: '600' },
                  ]}
                >
                  {button.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

// Alert Icon Component using Unicode characters for simplicity
const AlertIcon: React.FC<{ type: AlertType; color: string }> = ({ type, color }) => {
  const iconMap: Record<AlertType, string> = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
    confirm: '?',
    loading: '',
  };

  // Loading type shows activity indicator instead of icon
  if (type === 'loading') {
    return (
      <View
        style={[
          styles.iconCircle,
          { borderColor: color, backgroundColor: color + '20' },
        ]}
      >
        <ActivityIndicator size="large" color={color} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.iconCircle,
        { borderColor: color, backgroundColor: color + '20' },
      ]}
    >
      <Text style={[styles.iconText, { color }]}>{iconMap[type]}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  container: {
    width: '100%',
    maxWidth: 320,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  iconContainer: {
    marginBottom: spacing.lg,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 28,
    fontWeight: '700',
  },
  title: {
    fontSize: typography.sizes.title,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: spacing.sm,
    lineHeight: 22,
  },
  message: {
    fontSize: typography.sizes.body2,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    gap: spacing.sm,
  },
  button: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  buttonMargin: {
    marginRight: spacing.xs,
  },
  buttonText: {
    fontSize: typography.sizes.body1,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default CustomAlertModal;
