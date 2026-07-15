const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');
const { parsePaginationParams, buildPaginatedResponse } = require('../utils/pagination');
const pushService = require('../services/push-notification');

const ANONYMOUS_SENDER = { _id: 'anonymous', username: 'Anonymous', profilePhoto: null, avatar: null };

// Masks the sender of a notification when it relates to an anonymous post
// so the commenter/liker's identity is not revealed.
function maskNotificationSender(notifObj) {
  if (notifObj.relatedPost && notifObj.relatedPost.isAnonymous) {
    if (notifObj.sender) notifObj.sender = { ...ANONYMOUS_SENDER };
    if (Array.isArray(notifObj.senders)) {
      notifObj.senders = notifObj.senders.map(() => ({ ...ANONYMOUS_SENDER }));
    }
  }
  return notifObj;
}

// Get user's notifications
router.get('/', auth, async (req, res) => {
  try {
    const { page, limit, skip } = parsePaginationParams(req.query);
    const total = await Notification.countDocuments({ recipient: req.userId });

    const notifications = await Notification.find({ recipient: req.userId })
      .populate('sender', 'username avatar profilePhoto')
      .populate('senders', 'username avatar profilePhoto')
      .populate('relatedPost', 'content isAnonymous')
      .populate({
        path: 'relatedStory',
        populate: [
          { path: 'author', select: 'username avatar profilePhoto' },
          { path: 'viewers.user', select: 'username avatar profilePhoto' },
          { path: 'reactions.user', select: 'username avatar profilePhoto', strictPopulate: false }
        ]
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const groupedNotifications = [];
    // Collapse like/comment notifications that target the same post into a
    // single aggregated entry (works for both new aggregated docs and any
    // legacy per-event docs still in the database).
    const groups = {};

    const dedupeSenders = (arr) => {
      const seen = new Set();
      return (arr || []).filter(s => {
        const id = s && s._id ? s._id.toString() : (s ? s.toString() : null);
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      });
    };

    notifications.forEach(notification => {
      const notifObj = notification.toObject();
      if (!notifObj.sender) return;

      const isAggregatable =
        (notifObj.type === 'like' || notifObj.type === 'comment') && notifObj.relatedPost;

      if (isAggregatable) {
        const key = `${notifObj.type}:${notifObj.relatedPost._id.toString()}`;
        if (groups[key]) {
          const group = groups[key];
          group.count = (group.count || 1) + (notifObj.count || 1);
          const existingSenders = group.senders || [group.sender];
          const incoming = notifObj.senders && notifObj.senders.length
            ? notifObj.senders
            : [notifObj.sender];
          group.senders = dedupeSenders([...existingSenders, ...incoming]).slice(0, 5);
          // keep the most recent activity on top
          if (new Date(notifObj.createdAt) > new Date(group.createdAt)) {
            group.createdAt = notifObj.createdAt;
            group.sender = notifObj.sender;
            group.message = notifObj.message;
            group._id = notifObj._id;
          }
          return;
        }
        notifObj.count = notifObj.count || 1;
        notifObj.senders = notifObj.senders && notifObj.senders.length
          ? dedupeSenders(notifObj.senders)
          : [notifObj.sender];
        groups[key] = notifObj;
        groupedNotifications.push(notifObj);
        return;
      }

      notifObj.count = notifObj.count || 1;
      notifObj.senders = notifObj.senders && notifObj.senders.length
        ? dedupeSenders(notifObj.senders)
        : [notifObj.sender];
      groupedNotifications.push(notifObj);
    });

    groupedNotifications.forEach(maskNotificationSender);

    res.json(buildPaginatedResponse(groupedNotifications, total, { page, limit, skip, hasNextPage: skip + groupedNotifications.length < total, hasPrevPage: page > 1 }));
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