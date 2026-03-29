const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');
const pushService = require('../services/push-notification');

// Get user's notifications
router.get('/', auth, async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.userId })
      .populate('sender', 'username avatar profilePhoto')
      .populate('relatedPost', 'content')
      .populate({
        path: 'relatedStory',
        populate: [
          { path: 'author', select: 'username avatar profilePhoto' },
          { path: 'viewers.user', select: 'username avatar profilePhoto' },
          { path: 'reactions.user', select: 'username avatar profilePhoto', strictPopulate: false }
        ]
      })
      .sort({ createdAt: -1 })
      .limit(100);

    const groupedNotifications = [];
    const likeGroups = {}; // Map of postId -> notification object

    notifications.forEach(notification => {
      const notifObj = notification.toObject();
      if (!notifObj.sender) return;

      if (notifObj.type === 'like' && notifObj.relatedPost) {
        const postId = notifObj.relatedPost._id.toString();
        
        if (likeGroups[postId]) {
          // Existing group found - update the most recent notification
          const group = likeGroups[postId];
          group.groupCount = (group.groupCount || 1) + 1;
          // group.senders is initialized in the else block below
          group.senders.push(notifObj.sender);
          
          // Update message to reflect grouping
          const othersCount = group.groupCount - 1;
          group.message = `and ${othersCount} other${othersCount === 1 ? '' : 's'} liked your post`;
        } else {
          // New group - this is the most recent like for this post
          notifObj.groupCount = 1;
          notifObj.senders = [notifObj.sender];
          likeGroups[postId] = notifObj;
          groupedNotifications.push(notifObj);
        }
      } else {
        groupedNotifications.push(notifObj);
      }
    });

    res.json(groupedNotifications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark notification as read
router.put('/:notificationId/read', auth, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.notificationId);
    if (!notification) {
      return res.status(404).json({ msg: 'Notification not found' });
    }

    if (notification.recipient.toString() !== req.userId) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    notification.isRead = true;
    await notification.save();

    res.json(notification);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark all notifications as read
router.put('/read-all', auth, async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.userId, isRead: false },
      { isRead: true }
    );

    res.json({ msg: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear all notifications
router.delete('/', auth, async (req, res) => {
  try {
    await Notification.deleteMany({ recipient: req.userId });
    res.json({ msg: 'All notifications cleared successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a single notification
router.delete('/:notificationId', auth, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.notificationId);
    
    if (!notification) {
      return res.status(404).json({ msg: 'Notification not found' });
    }

    // Ensure the notification belongs to the user
    if (notification.recipient.toString() !== req.userId) {
      return res.status(403).json({ msg: 'Not authorized to delete this notification' });
    }

    await Notification.findByIdAndDelete(req.params.notificationId);
    res.json({ msg: 'Notification deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get unread count
router.get('/unread-count', auth, async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      recipient: req.userId,
      isRead: false
    });

    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create notification (internal function, but exposed for testing)
router.post('/', auth, async (req, res) => {
  try {
    const { recipient, type, message, relatedPost, relatedChat } = req.body;

    const notification = new Notification({
      recipient,
      sender: req.userId,
      type,
      message,
      relatedPost,
      relatedChat,
    });

    await notification.save();
    await notification.populate('sender', 'username avatar profilePhoto');

    res.json(notification);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Register device push token
router.post('/register-token', auth, async (req, res) => {
  try {
    const { token, device, platform } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Push token is required' });
    }

    // Validate device type
    const validDevices = ['ios', 'android', 'web', 'unknown'];
    const validPlatforms = ['expo', 'fcm'];

    const deviceType = validDevices.includes(device) ? device : 'unknown';
    const platformType = validPlatforms.includes(platform) ? platform : 'expo';

    const result = await pushService.registerPushToken(
      req.userId,
      token,
      deviceType,
      platformType
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Unregister device push token
router.delete('/unregister-token', auth, async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Push token is required' });
    }

    const result = await pushService.unregisterPushToken(req.userId, token);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user's registered device tokens
router.get('/device-tokens', auth, async (req, res) => {
  try {
    const result = await pushService.getUserPushTokens(req.userId);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;