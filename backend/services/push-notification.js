/**
 * Push Notification Service
 * Handles sending push notifications via Expo Push API and Firebase Cloud Messaging (FCM)
 */

const fetch = require('node-fetch');
const User = require('../models/User');

// Expo project ID
const EXPO_PROJECT_ID = '02522d86-1963-41a3-b08c-cbd55c5722ab';

// FCM configuration - these would typically come from environment variables
const FCM_CONFIG = {
  // Firebase service account key would be loaded from environment
  // This is initialized lazily when needed
};

/**
 * Send push notification to a user
 * @param {string} userId - The recipient user ID
 * @param {Object} notification - Notification details
 * @param {string} notification.title - Notification title
 * @param {string} notification.body - Notification body
 * @param {string} notification.type - Notification type (like, comment, follow, message, etc.)
 * @param {Object} notification.data - Additional data to send with notification
 * @returns {Promise<Object>} Result of the send operation
 */
async function sendPushNotification(userId, notification) {
  try {
    // Get user's push tokens
    const user = await User.findById(userId).select('pushTokens');
    
    if (!user || !user.pushTokens || user.pushTokens.length === 0) {
      console.log(`No push tokens found for user ${userId}`);
      return { success: false, error: 'No push tokens found' };
    }

    const results = [];
    
    // Group tokens by platform
    const expoTokens = user.pushTokens.filter(t => t.platform === 'expo');
    const fcmTokens = user.pushTokens.filter(t => t.platform === 'fcm');

    // Send to Expo devices
    if (expoTokens.length > 0) {
      const expoResults = await sendExpoNotifications(expoTokens, notification);
      results.push(...expoResults);
    }

    // Send to FCM devices
    if (fcmTokens.length > 0) {
      const fcmResults = await sendFCMNotifications(fcmTokens, notification);
      results.push(...fcmResults);
    }

    // Clean up invalid tokens
    await cleanupInvalidTokens(userId, results);

    return {
      success: true,
      results,
      sent: results.filter(r => r.status === 'ok').length,
      failed: results.filter(r => r.status !== 'ok').length
    };
  } catch (error) {
    console.error('Error sending push notification:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send notifications via Expo Push API
 * @param {Array} tokens - Array of Expo push tokens
 * @param {Object} notification - Notification details
 * @returns {Promise<Array>} Results from Expo
 */
async function sendExpoNotifications(tokens, notification) {
  const messages = tokens.map(token => ({
    to: token.token,
    title: notification.title,
    body: notification.body,
    data: {
      type: notification.type,
      ...notification.data
    },
    sound: 'default',
    priority: 'high',
    channelId: 'default'
  }));

  const results = [];

  // Expo push API accepts up to 100 messages per request
  const chunks = [];
  for (let i = 0; i < messages.length; i += 100) {
    chunks.push(messages.slice(i, i + 100));
  }

  for (const chunk of chunks) {
    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      });

      const data = await response.json();
      
      if (Array.isArray(data)) {
        results.push(...data.map((item, index) => ({
          token: tokens[chunk.length > 1 ? 
            chunks.slice(0, chunks.indexOf(chunk)).reduce((a, b) => a + b.length, 0) + index 
            : index].token,
          status: item.status || (item.id ? 'ok' : 'error'),
          message: item.message || null
        })));
      }
    } catch (error) {
      console.error('Error sending Expo notifications:', error);
      tokens.forEach(token => {
        results.push({ token: token.token, status: 'error', message: error.message });
      });
    }
  }

  return results;
}

/**
 * Send notifications via Firebase Cloud Messaging (FCM)
 * Uses FCM HTTP API with server key
 * @param {Array} tokens - Array of FCM tokens
 * @param {Object} notification - Notification details
 * @returns {Promise<Array>} Results from FCM
 */
async function sendFCMNotifications(tokens, notification) {
  const results = [];
  
  // Get FCM Server Key from environment variable
  const fcmServerKey = process.env.FCM_SERVER_KEY;
  
  if (!fcmServerKey) {
    console.error('FCM_SERVER_KEY not configured in environment');
    tokens.forEach(token => {
      results.push({ 
        token: token.token, 
        status: 'error', 
        message: 'FCM_SERVER_KEY not configured' 
      });
    });
    return results;
  }
  
  // FCM HTTP API endpoint
  const FCM_ENDPOINT = 'https://fcm.googleapis.com/fcm/send';
  
  // Prepare notification payload for FCM
  const fcmPayload = {
    notification: {
      title: notification.title,
      body: notification.body
    },
    data: {
      type: notification.type,
      ...notification.data
    },
    priority: 'high',
    sound: 'default'
  };
  
  // Send to each token (FCM HTTP API supports multiple tokens but we'll send individually for better error handling)
  for (const tokenObj of tokens) {
    try {
      const payload = {
        ...fcmPayload,
        to: tokenObj.token
      };
      
      const response = await fetch(FCM_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `key=${fcmServerKey}`
        },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      
      if (data.success === 1) {
        results.push({
          token: tokenObj.token,
          status: 'ok',
          message: 'FCM notification sent successfully'
        });
      } else if (data.failure === 1 && data.results && data.results[0]) {
        const error = data.results[0].error || 'Unknown error';
        console.error(`FCM error for token: ${error}`);
        results.push({
          token: tokenObj.token,
          status: 'error',
          message: error
        });
      }
    } catch (error) {
      console.error('Error sending FCM notification:', error);
      results.push({
        token: tokenObj.token,
        status: 'error',
        message: error.message
      });
    }
  }
  
  return results;
}

/**
 * Clean up invalid push tokens
 * @param {string} userId - User ID
 * @param {Array} results - Results from send operation
 */
async function cleanupInvalidTokens(userId, results) {
  const invalidTokens = results
    .filter(r => r.status === 'error' || r.status === ' DeviceNotRegistered')
    .map(r => r.token);

  if (invalidTokens.length > 0) {
    try {
      await User.updateOne(
        { _id: userId },
        { $pull: { pushTokens: { token: { $in: invalidTokens } } } }
      );
      console.log(`Cleaned up ${invalidTokens.length} invalid tokens for user ${userId}`);
    } catch (error) {
      console.error('Error cleaning up invalid tokens:', error);
    }
  }
}

/**
 * Register a push token for a user
 * @param {string} userId - User ID
 * @param {string} token - Push token
 * @param {string} device - Device type (ios, android, web)
 * @param {string} platform - Platform (expo, fcm)
 * @returns {Promise<Object>} Result of registration
 */
async function registerPushToken(userId, token, device = 'unknown', platform = 'expo') {
  try {
    // Check if token already exists
    const user = await User.findById(userId);
    
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const existingToken = user.pushTokens.find(t => t.token === token);
    
    if (existingToken) {
      // Update existing token
      existingToken.device = device;
      existingToken.platform = platform;
      existingToken.createdAt = new Date();
    } else {
      // Add new token
      user.pushTokens.push({
        token,
        device,
        platform,
        createdAt: new Date()
      });
    }

    await user.save();
    
    return { 
      success: true, 
      message: 'Push token registered successfully',
      tokenCount: user.pushTokens.length
    };
  } catch (error) {
    console.error('Error registering push token:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Unregister a push token for a user
 * @param {string} userId - User ID
 * @param {string} token - Push token to remove
 * @returns {Promise<Object>} Result of unregistration
 */
async function unregisterPushToken(userId, token) {
  try {
    const user = await User.findById(userId);
    
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const tokenIndex = user.pushTokens.findIndex(t => t.token === token);
    
    if (tokenIndex === -1) {
      return { success: false, error: 'Token not found' };
    }

    user.pushTokens.splice(tokenIndex, 1);
    await user.save();
    
    return { 
      success: true, 
      message: 'Push token removed successfully',
      tokenCount: user.pushTokens.length
    };
  } catch (error) {
    console.error('Error unregistering push token:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get all push tokens for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of push tokens
 */
async function getUserPushTokens(userId) {
  try {
    const user = await User.findById(userId).select('pushTokens');
    
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    return {
      success: true,
      tokens: user.pushTokens.map(t => ({
        token: t.token,
        device: t.device,
        platform: t.platform,
        createdAt: t.createdAt
      }))
    };
  } catch (error) {
    console.error('Error getting push tokens:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send notification for specific types
 */
const notificationHelpers = {
  /**
   * Send a like notification
   */
  async sendLikeNotification(recipientId, sender, postId) {
    return sendPushNotification(recipientId, {
      title: 'New Like',
      body: `${sender.username} liked your post`,
      type: 'like',
      data: {
        senderId: sender._id,
        postId
      }
    });
  },

  /**
   * Send a comment notification
   */
  async sendCommentNotification(recipientId, sender, postId, commentId) {
    return sendPushNotification(recipientId, {
      title: 'New Comment',
      body: `${sender.username} commented on your post`,
      type: 'comment',
      data: {
        senderId: sender._id,
        postId,
        commentId
      }
    });
  },

  /**
   * Send a follow notification
   */
  async sendFollowNotification(recipientId, sender) {
    return sendPushNotification(recipientId, {
      title: 'New Follower',
      body: `${sender.username} started following you`,
      type: 'follow',
      data: {
        senderId: sender._id
      }
    });
  },

  /**
   * Send a message notification
   */
  async sendMessageNotification(recipientId, sender, chatId, message) {
    return sendPushNotification(recipientId, {
      title: `New message from ${sender.username}`,
      body: message.substring(0, 100),
      type: 'message',
      data: {
        senderId: sender._id,
        chatId
      }
    });
  },

  /**
   * Send a match notification
   */
  async sendMatchNotification(recipientId, sender) {
    return sendPushNotification(recipientId, {
      title: "It's a Match!",
      body: `You and ${sender.username} liked each other!`,
      type: 'match',
      data: {
        senderId: sender._id
      }
    });
  },

  /**
   * Send a comment like notification
   */
  async sendCommentLikeNotification(recipientId, sender, postId, commentId) {
    return sendPushNotification(recipientId, {
      title: 'New Like',
      body: `${sender.username} liked your comment`,
      type: 'comment_like',
      data: {
        senderId: sender._id,
        postId,
        commentId
      }
    });
  },

  /**
   * Send a comment reply notification
   */
  async sendCommentReplyNotification(recipientId, sender, postId, commentId, replyId) {
    return sendPushNotification(recipientId, {
      title: 'New Reply',
      body: `${sender.username} replied to your comment`,
      type: 'comment_reply',
      data: {
        senderId: sender._id,
        postId,
        commentId,
        replyId
      }
    });
  }
};

module.exports = {
  sendPushNotification,
  registerPushToken,
  unregisterPushToken,
  getUserPushTokens,
  ...notificationHelpers
};
