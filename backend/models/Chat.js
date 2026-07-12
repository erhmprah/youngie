const mongoose = require('mongoose');

const ChatSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  pendingMembers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  isGroupChat: {
    type: Boolean,
    default: false
  },
  name: {
    type: String,
    trim: true
  },
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isTemporary: {
    type: Boolean,
    default: false
  },
  isAnonymous: {
    type: Boolean,
    default: false
  },
  groupPhoto: {
    type: String
  },
  relatedCommunity: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Community'
  },
  clearedHistory: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    clearedAt: { type: Date, default: Date.now }
  }],
  deletedFor: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deletedAt: { type: Date, default: Date.now }
  }],
  expiresAt: {
    type: Date
  }
}, { timestamps: true });

// Indexes for frequently queried fields
ChatSchema.index({ participants: 1 });
ChatSchema.index({ 'participants': 1, 'createdAt': -1 });
ChatSchema.index({ relatedCommunity: 1 });
ChatSchema.index({ isGroupChat: 1, createdAt: -1 });
ChatSchema.index({ expiresAt: 1 }, { sparse: true });
ChatSchema.index({ 'deletedFor.user': 1 });

module.exports = mongoose.model('Chat', ChatSchema);