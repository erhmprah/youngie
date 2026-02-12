import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { FeedCard } from '@/app/chat/FeedCard.component';
import { postAPI } from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeColor } from '@/hooks/use-theme-color';
import { spacing, borderRadius } from '@/constants/design-tokens';

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const backgroundColor = useThemeColor('background');
  const textColor = useThemeColor('text');
  const lightTextColor = useThemeColor('lightText');

  const fetchPost = useCallback(async () => {
    if (!id || id === 'undefined') return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await postAPI.getPost(id as string);
      setPost(response.data);
    } catch (error: any) {
      console.error('Failed to fetch post:', error);
      setError(error.response?.data?.msg || 'Failed to load post');
      Alert.alert('Error', 'Failed to load post');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPost();
  }, [fetchPost]);

  const handleDelete = (postId: string) => {
    // Handle post deletion - could navigate back or show success message
    router.back();
  };

  const handleUpdate = (updatedPost: any) => {
    setPost(updatedPost);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={textColor} />
          <ThemedText style={[styles.loadingText, { color: lightTextColor }]}>Loading post...</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !post) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor }]}>
        <View style={styles.errorContainer}>
          <ThemedText style={[styles.errorText, { color: textColor }]}>
            {error || 'Post not found'}
          </ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <Stack.Screen 
        options={{ 
          title: 'Post',
          headerBackTitle: 'Back',
        }} 
      />
      <ThemedView style={styles.content}>
        <FeedCard
          post={post}
          currentUserId={user?._id || ''}
          onDelete={handleDelete}
          onUpdate={handleUpdate}
          shouldPlay={true}
        />
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  loadingText: {
    marginTop: spacing.md,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  errorText: {
    textAlign: 'center',
    fontSize: 16,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
});
