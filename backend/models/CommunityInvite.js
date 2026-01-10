const mongoose = require('mongoose');

const CommunityInviteSchema = new mongoose.Schema({
  community: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Community',
    required: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  inviteToken: {
    type: String,
    required: true,
    unique: true,
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  },
  maxUses: {
    type: Number,
    default: null, // null means unlimited
  },
  uses: {
    type: Number,
    default: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Index for efficient token lookup
CommunityInviteSchema.index({ inviteToken: 1 });

// Auto-remove expired invites
CommunityInviteSchema.pre('find', function() {
  this.where({
    $or: [
      { expiresAt: { $gt: new Date() } },
      { expiresAt: null }
    ],
    isActive: true
  });
});

module.exports = mongoose.model('CommunityInvite', CommunityInviteSchema);