const mongoose = require('mongoose');

const ChatSchema = new mongoose.Schema({
  participants: [{
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
  relatedCommunity: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Community'
  },
  expiresAt: {
    type: Date
  }
}, { timestamps: true });

module.exports = mongoose.model('Chat', ChatSchema);