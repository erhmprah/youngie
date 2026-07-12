const mongoose = require('mongoose');

const CommunityFeedSchema = new mongoose.Schema({
  community: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Community',
    required: true,
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  content: {
    type: String,
    trim: true,
    maxlength: 2000,
  },
  images: [{
    type: String,
  }],
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
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
CommunityFeedSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Indexes for frequently queried fields
CommunityFeedSchema.index({ community: 1, createdAt: -1 });
CommunityFeedSchema.index({ author: 1, createdAt: -1 });

module.exports = mongoose.model('CommunityFeed', CommunityFeedSchema);
