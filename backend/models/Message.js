const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  chat: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: false
  },
  attachment: {
    fileName: String,
    url: String,
    type: String,
    size: Number
  },
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  isAnonymous: {
    type: Boolean,
    default: false
  },
  readBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  deletedFor: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deletedAt: { type: Date, default: Date.now }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for frequently queried fields
MessageSchema.index({ chat: 1, createdAt: -1 });
MessageSchema.index({ sender: 1, createdAt: -1 });
MessageSchema.index({ chat: 1, readBy: 1 });
MessageSchema.index({ createdAt: -1 });
MessageSchema.index({ 'deletedFor.user': 1 });

module.exports = mongoose.model('Message', MessageSchema);