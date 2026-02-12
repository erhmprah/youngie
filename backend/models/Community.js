const mongoose = require('mongoose');

const CommunitySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500,
  },
  image: {
    type: String, // URL to community image
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  pendingMembers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  requiresApproval: {
    type: Boolean,
    default: true,
  },
  isPrivate: {
    type: Boolean,
    default: false,
  },
  chat: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update the updatedAt field before saving
CommunitySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Indexes for frequently queried fields
CommunitySchema.index({ name: 1 });
CommunitySchema.index({ creator: 1, createdAt: -1 });
CommunitySchema.index({ members: 1 });
CommunitySchema.index({ isPrivate: 1, createdAt: -1 });
CommunitySchema.index({ createdAt: -1 });

// Text index for search
CommunitySchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('Community', CommunitySchema);