import React, { useState, useEffect } from 'react';
import { StyleSheet, FlatList, View, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { spacing, borderRadius, typography, sizes } from '@/constants/design-tokens';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { userAPI, BASE_URL } from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';

interface LoginSession {
  _id: string;
  device: string;
  location: string;
  ipAddress: string;
  loginTime: string;
  isCurrentSession: boolean;
}

export default function LoginActivityScreen() {
  const router = useRouter();
  const [loginSessions, setLoginSessions] = useState<LoginSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const backgroundColor = useThemeColor('background');
  const textColor = useThemeColor('text');
  const lightTextColor = useThemeColor('lightText');
  const surfaceColor = useThemeColor('surface');
  const primaryColor = useThemeColor('primary');
  const borderColor = useThemeColor('border');
  const errorColor = useThemeColor('error');

  useEffect(() => {
    fetchLoginActivity();
  }, []);

  const fetchLoginActivity = async () => {
    try {
      const response = await userAPI.getLoginActivity();
      setLoginSessions(response.data);
    } catch (error: any) {
      // Show empty state on error
      setLoginSessions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearLoginActivity = async () => {
    Alert.alert(
      'Clear Login Activity',
      'Are you sure you want to clear all login activity? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await userAPI.clearLoginActivity();
              setLoginSessions([]);
            } catch (error: any) {
              Alert.alert('Error', 'Failed to clear login activity. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleRemoveSession = async (sessionId: string) => {
    Alert.alert(
      'Remove Device',
      'Are you sure you want to log out this device?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('authToken');
              await axios.delete(`${BASE_URL}/api/users/login-activity/${sessionId}`, {
                headers: { 'x-auth-token': token }
              });
              setLoginSessions(prev => prev.filter(s => s._id !== sessionId));
            } catch (error: any) {
              Alert.alert('Error', 'Failed to remove session.');
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    }
  };

  const renderItem = ({ item }: { item: LoginSession }) => (
    <View style={[styles.sessionItem, { backgroundColor: surfaceColor, borderColor }]}>
      <View style={styles.sessionHeader}>
        <View style={styles.deviceInfo}>
          <IconSymbol
            name={item.device.includes('iPhone') || item.device.includes('Android') ? 'device-phone-portrait' : 'laptopcomputer'}
            size={20}
            color={textColor}
          />
          <View style={styles.deviceDetails}>
            <ThemedText style={styles.deviceName}>{item.device}</ThemedText>
            <ThemedText style={[styles.location, { color: lightTextColor }]}>
              {item.location} • {item.ipAddress}
            </ThemedText>
          </View>
        </View>
        {item.isCurrentSession && (
          <View style={[styles.currentBadge, { backgroundColor: primaryColor }]}>
            <ThemedText style={[styles.currentText, { color: backgroundColor }]}>Current</ThemedText>
          </View>
        )}
        {!item.isCurrentSession && (
          <TouchableOpacity 
            onPress={() => handleRemoveSession(item._id)}
            style={styles.removeButton}
          >
            <IconSymbol name="trash" size={20} color={errorColor} />
          </TouchableOpacity>
        )}
      </View>
      <ThemedText style={[styles.loginTime, { color: lightTextColor }]}>
        {formatDate(item.loginTime)}
      </ThemedText>
    </View>
  );

  return (
    <ThemedView style={[styles.container, { backgroundColor }]} safe>
      <Stack.Screen options={{ title: 'Login Activity', headerBackTitle: 'Security' }} />

      <View style={styles.header}>
        <IconSymbol name="shield" size={48} color={primaryColor} style={{ opacity: 0.8 }} />
        <ThemedText style={[styles.title, { color: textColor }]}>
          Where you're signed in
        </ThemedText>
        <ThemedText style={[styles.subtitle, { color: lightTextColor }]}>
          See all the devices and locations where your account is currently signed in.
        </ThemedText>
      </View>

      {!isLoading && loginSessions.length > 0 && (
        <View style={styles.clearButtonContainer}>
          <TouchableOpacity
            style={[styles.clearButton, { borderColor: primaryColor }]}
            onPress={clearLoginActivity}
          >
            <IconSymbol name="trash" size={16} color={primaryColor} />
            <ThemedText style={[styles.clearButtonText, { color: primaryColor }]}>
              Clear Activity
            </ThemedText>
          </TouchableOpacity>
        </View>
      )}

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      ) : (
        <FlatList
          data={loginSessions}
          renderItem={renderItem}
          keyExtractor={item => item._id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    padding: spacing.xl,
    paddingBottom: spacing.lg,
  },
  title: {
    fontSize: typography.sizes.title,
    fontFamily: typography.families.bold,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.sizes.body2,
    textAlign: 'center',
    lineHeight: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: spacing.md,
  },
  sessionItem: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: sizes.dividerWidth,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  deviceDetails: {
    marginLeft: spacing.md,
    flex: 1,
  },
  deviceName: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.families.medium,
    marginBottom: spacing.xs,
  },
  location: {
    fontSize: typography.sizes.caption,
  },
  currentBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
  },
  currentText: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.families.bold,
  },
  loginTime: {
    fontSize: typography.sizes.caption,
    marginTop: spacing.xs,
  },
  clearButtonContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: sizes.dividerWidth,
  },
  clearButtonText: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.families.medium,
    marginLeft: spacing.xs,
  },
  removeButton: {
    padding: spacing.xs,
  },
});