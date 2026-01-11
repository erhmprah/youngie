import React, { useState, useEffect } from 'react';
import {
  ScrollView,
  View,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { postAPI, userAPI, chatAPI, notificationAPI, storyAPI } from '@/utils/api';
import { colors, spacing, borderRadius } from '@/constants/design-tokens';
import { Ionicons } from '@expo/vector-icons';
import { ICONS, ICON_SIZES } from '@/constants/icons';

const { width } = Dimensions.get('window');

interface TestResult {
  name: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  message?: string;
  details?: string;
}

export default function TestingScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [tests, setTests] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [expandedTest, setExpandedTest] = useState<string | null>(null);

  const testSuites = [
    {
      category: 'Authentication',
      tests: [
        { name: 'User logged in', fn: testUserLoggedIn },
        { name: 'User has valid token', fn: testValidToken },
        { name: 'User profile accessible', fn: testUserProfile },
      ],
    },
    {
      category: 'Posts API',
      tests: [
        { name: 'Fetch all posts', fn: testFetchPosts },
        { name: 'Create new post', fn: testCreatePost },
        { name: 'Like post', fn: testLikePost },
        { name: 'Add comment', fn: testAddComment },
        { name: 'Delete post', fn: testDeletePost },
      ],
    },
    {
      category: 'Users API',
      tests: [
        { name: 'Get user profile', fn: testGetUserProfile },
        { name: 'Update user profile', fn: testUpdateProfile },
        { name: 'Search users', fn: testSearchUsers },
        { name: 'Send friend request', fn: testFriendRequest },
      ],
    },
    {
      category: 'Chat API',
      tests: [
        { name: 'Get user chats', fn: testGetChats },
        { name: 'Get chat messages', fn: testGetChatMessages },
        { name: 'Send message', fn: testSendMessage },
      ],
    },
    {
      category: 'Story API',
      tests: [
        { name: 'Get stories', fn: testGetStories },
        { name: 'Create story', fn: testCreateStory },
      ],
    },
    {
      category: 'Notifications API',
      tests: [
        { name: 'Get notifications', fn: testGetNotifications },
        { name: 'Mark as read', fn: testMarkAsRead },
      ],
    },
  ];

  // Test Functions
  async function testUserLoggedIn() {
    if (!user?._id) throw new Error('User not logged in');
    return `User logged in: ${user.username} (${user._id})`;
  }

  async function testValidToken() {
    if (!user?._id) throw new Error('No user ID');
    const response = await userAPI.getProfile(user._id);
    if (!response?.data?._id) throw new Error('Invalid token');
    return `Valid token for user: ${response.data.username}`;
  }

  async function testUserProfile() {
    if (!user?._id) throw new Error('No user ID');
    const response = await userAPI.getProfile(user._id);
    return `Profile fetched: ${response.data.username} - ${response.data.bio || 'No bio'}`;
  }

  async function testFetchPosts() {
    const response = await postAPI.getPosts();
    const count = response.data?.length || 0;
    return `Fetched ${count} posts`;
  }

  async function testCreatePost() {
    if (!user?._id) throw new Error('No user ID');
    const response = await postAPI.createPost({
      content: `Test post at ${new Date().toISOString()}`,
    });
    return `Created post: ${response.data._id}`;
  }

  async function testLikePost() {
    const postsRes = await postAPI.getPosts();
    if (!postsRes.data?.length) throw new Error('No posts to like');
    const postId = postsRes.data[0]._id;
    await postAPI.likePost(postId);
    return `Liked post: ${postId}`;
  }

  async function testAddComment() {
    const postsRes = await postAPI.getPosts();
    if (!postsRes.data?.length) throw new Error('No posts to comment on');
    const postId = postsRes.data[0]._id;
    const response = await postAPI.addComment(postId, {
      content: `Test comment at ${new Date().toISOString()}`,
    });
    return `Added comment to post: ${postId}`;
  }


  async function testDeletePost() {
    // Create and delete a test post
    const createRes = await postAPI.createPost({
      content: `Test post for deletion at ${new Date().toISOString()}`,
    });
    const postId = createRes.data._id;
    await postAPI.deletePost(postId);
    return `Created and deleted post: ${postId}`;
  }

  async function testGetUserProfile() {
    if (!user?._id) throw new Error('No user ID');
    const response = await userAPI.getProfile(user._id);
    return `Profile: ${response.data.username} - Age: ${response.data.age || 'N/A'}`;
  }

  async function testUpdateProfile() {
    if (!user?._id) throw new Error('No user ID');
    const response = await userAPI.updateProfile(user._id, {
      bio: `Updated at ${new Date().toLocaleTimeString()}`,
    });
    return `Updated profile bio`;
  }

  async function testSearchUsers() {
    const response = await userAPI.searchUsers('a');
    return `Found ${response.data?.length || 0} users matching 'a'`;
  }

  async function testFriendRequest() {
    if (!user?._id) throw new Error('No user ID');
    const usersRes = await userAPI.searchUsers('a');
    if (!usersRes.data?.length) throw new Error('No users found');
    const targetUser = usersRes.data.find((u: any) => u._id !== user._id);
    if (!targetUser) throw new Error('No other users found');
    await userAPI.sendFriendRequest(user._id, targetUser._id);
    return `Sent friend request to: ${targetUser.username}`;
  }

  async function testGetChats() {
    if (!user?._id) throw new Error('No user ID');
    const response = await chatAPI.getUserChats(user._id);
    return `Found ${response.data?.length || 0} chats`;
  }

  async function testGetChatMessages() {
    if (!user?._id) throw new Error('No user ID');
    const chatsRes = await chatAPI.getUserChats(user._id);
    if (!chatsRes.data?.length) throw new Error('No chats found');
    const chatId = chatsRes.data[0]._id;
    const response = await chatAPI.getChat(chatId);
    return `Found ${response.data?.messages?.length || 0} messages in chat`;
  }

  async function testSendMessage() {
    if (!user?._id) throw new Error('No user ID');
    const chatsRes = await chatAPI.getUserChats(user._id);
    if (!chatsRes.data?.length) throw new Error('No chats found');
    const chatId = chatsRes.data[0]._id;
    await chatAPI.sendMessage(chatId, {
      content: `Test message at ${new Date().toISOString()}`,
    });
    return `Sent message to chat: ${chatId}`;
  }


  async function testGetStories() {
    const response = await storyAPI.getStories();
    return `Found ${response.data?.length || 0} story groups`;
  }

  async function testCreateStory() {
    const response = await storyAPI.createStory({
      content: `Test story at ${new Date().toISOString()}`,
    });
    return `Created story: ${response.data._id}`;
  }

  async function testGetNotifications() {
    const response = await notificationAPI.getNotifications();
    return `Found ${response.data?.length || 0} notifications`;
  }

  async function testMarkAsRead() {
    const response = await notificationAPI.getNotifications();
    if (!response.data?.length) throw new Error('No notifications to mark');
    const notifId = response.data[0]._id;
    await notificationAPI.markAsRead(notifId);
    return `Marked notification as read: ${notifId}`;
  }

  const runAllTests = async () => {
    setIsRunning(true);
    const allTests: TestResult[] = [];

    for (const suite of testSuites) {
      for (const test of suite.tests) {
        const testResult: TestResult = {
          name: `${suite.category} - ${test.name}`,
          status: 'running',
        };
        setTests([...allTests, testResult]);

        try {
          const result = await test.fn();
          testResult.status = 'passed';
          testResult.message = result;
        } catch (error: any) {
          testResult.status = 'failed';
          testResult.message = error.message || 'Unknown error';
          testResult.details = error.response?.data || error.toString();
        }

        allTests.push(testResult);
        setTests([...allTests]);
      }
    }

    setIsRunning(false);
    const passed = allTests.filter((t) => t.status === 'passed').length;
    const failed = allTests.filter((t) => t.status === 'failed').length;
    Alert.alert(
      'Test Results',
      `Passed: ${passed}\nFailed: ${failed}\nTotal: ${allTests.length}`
    );
  };

  const runSingleTest = async (testFn: () => Promise<string>, testName: string) => {
    const testResult: TestResult = {
      name: testName,
      status: 'running',
    };
    setTests([testResult]);

    try {
      const result = await testFn();
      testResult.status = 'passed';
      testResult.message = result;
    } catch (error: any) {
      testResult.status = 'failed';
      testResult.message = error.message || 'Unknown error';
      testResult.details = error.response?.data || error.toString();
    }

    setTests([testResult]);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed':
        return '#22C55E'; // Brighter green
      case 'failed':
        return '#EF4444'; // Brighter red
      case 'running':
        return '#F59E0B'; // Brighter orange
      default:
        return '#999';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed':
        return 'checkmark-circle';
      case 'failed':
        return 'close-circle';
      case 'running':
        return 'hourglass';
      default:
        return 'ellipse';
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name={ICONS.back} size={ICON_SIZES.lg} color={colors.primary} />
          </TouchableOpacity>
          <ThemedText style={styles.title}>Test Suite</ThemedText>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.statsBar}>
          <View style={styles.statBox}>
            <ThemedText style={styles.statNumber}>
              {tests.filter((t) => t.status === 'passed').length}
            </ThemedText>
            <ThemedText style={styles.statLabel}>Passed</ThemedText>
          </View>
          <View style={styles.statBox}>
            <ThemedText style={styles.statNumber}>
              {tests.filter((t) => t.status === 'failed').length}
            </ThemedText>
            <ThemedText style={styles.statLabel}>Failed</ThemedText>
          </View>
          <View style={styles.statBox}>
            <ThemedText style={styles.statNumber}>{tests.length}</ThemedText>
            <ThemedText style={styles.statLabel}>Total</ThemedText>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.runButton, isRunning && styles.runButtonDisabled]}
          onPress={runAllTests}
          disabled={isRunning}
        >
          {isRunning ? (
            <>
              <ActivityIndicator color={colors.white} />
              <ThemedText style={styles.runButtonText}>Running...</ThemedText>
            </>
          ) : (
            <>
              <Ionicons name="play" size={ICON_SIZES.md} color={colors.white} />
              <ThemedText style={styles.runButtonText}>Run All Tests</ThemedText>
            </>
          )}
        </TouchableOpacity>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.testsList}>
          {tests.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name={ICONS.flask} size={ICON_SIZES.massive} color={colors.primary} />
              <ThemedText style={styles.emptyText}>No tests run yet</ThemedText>
              <ThemedText style={styles.emptySubtext}>Tap "Run All Tests" to start</ThemedText>
            </View>
          ) : (
            tests.map((test, index) => (
              <TouchableOpacity
                key={index}
                style={styles.testCard}
                onPress={() =>
                  setExpandedTest(expandedTest === test.name ? null : test.name)
                }
              >
                <View style={styles.testHeader}>
                  <Ionicons
                    name={getStatusIcon(test.status) as any}
                    size={20}
                    color={getStatusColor(test.status)}
                  />
                  <ThemedText style={styles.testName}>{test.name}</ThemedText>
                  <Ionicons
                    name={expandedTest === test.name ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={colors.primary}
                  />
                </View>

                {expandedTest === test.name && (
                  <View style={styles.testDetails}>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(test.status) },
                      ]}
                    >
                      <ThemedText style={styles.statusText}>
                        {test.status.toUpperCase()}
                      </ThemedText>
                    </View>

                    {test.message && (
                      <View style={styles.messageBox}>
                        <ThemedText style={styles.messageLabel}>Message:</ThemedText>
                        <ThemedText style={styles.messageText}>{test.message}</ThemedText>
                      </View>
                    )}

                    {test.details && (
                      <View style={styles.detailsBox}>
                        <ThemedText style={styles.detailsLabel}>Details:</ThemedText>
                        <ThemedText style={styles.detailsText}>
                          {typeof test.details === 'string'
                            ? test.details
                            : JSON.stringify(test.details, null, 2)}
                        </ThemedText>
                      </View>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, paddingHorizontal: spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary + '40',
  },
  placeholder: { width: 28 },
  title: { fontSize: 20, fontWeight: 'bold', color: colors.text },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary + '20',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primary + '40',
  },
  statBox: { alignItems: 'center' },
  statNumber: { fontSize: 20, fontWeight: 'bold', color: colors.primary },
  statLabel: { fontSize: 12, color: colors.text, marginTop: 4 },
  runButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  runButtonDisabled: { opacity: 0.6 },
  runButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  testsList: { flex: 1 },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
  },
  emptyText: { fontSize: 18, fontWeight: '600', marginTop: spacing.md, color: colors.text },
  emptySubtext: { fontSize: 14, color: colors.text, marginTop: 4, opacity: 0.7 },
  testCard: {
    backgroundColor: colors.lightText + '08',
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.lightText + '15',
  },
  testHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  testName: { flex: 1, fontSize: 14, fontWeight: '500', color: colors.text },
  testDetails: { backgroundColor: colors.lightText + '12', padding: spacing.md },
  statusBadge: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
  },
  statusText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  messageBox: { marginBottom: spacing.md, backgroundColor: colors.lightText + '08', padding: spacing.sm, borderRadius: borderRadius.sm },
  messageLabel: { fontSize: 12, fontWeight: '600', color: colors.primary, marginBottom: 4 },
  messageText: { fontSize: 13, color: colors.text },
  detailsBox: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.lightText + '30' },
  detailsLabel: { fontSize: 12, fontWeight: '600', color: colors.primary, marginBottom: 4 },
  detailsText: { fontSize: 11, color: colors.text, fontFamily: 'monospace' },
});
