const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['like', 'comment', 'follow', 'match', 'message', 'comment_like', 'comment_reply', 'community_join_request', 'chat_invitation', 'tag', 'suspension', 'report_post', 'report_user', 'report_comment', 'react_post', 'react_comment', 'reply', 'share'],
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    relatedPost: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
    },
    relatedChat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat',
    },
    relatedCommunity: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Community',
    },
    relatedStory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Story',
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    // Aggregation support: likes/comments on the same post are collapsed into a
    // single notification. `count` is the number of events represented and
    // `senders` holds the (capped) list of actors for display.
    count: {
      type: Number,
      default: 1,
      min: 0,
    },
    senders: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
  },
  { timestamps: true }
);

// Indexes for frequently queried fields
NotificationSchema.index({ recipient: 1, createdAt: -1 });
NotificationSchema.index({ recipient: 1, isRead: 1 });
NotificationSchema.index({ sender: 1, createdAt: -1 });
NotificationSchema.index({ type: 1, createdAt: -1 });
NotificationSchema.index({ createdAt: -1 });
// Used to find/aggregate the single notification per recipient+post+type
NotificationSchema.index({ recipient: 1, relatedPost: 1, type: 1 });

module.exports = mongoose.model('Notification', NotificationSchema);