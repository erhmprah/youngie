const mongoose = require('mongoose');

const CommunityEventSchema = new mongoose.Schema({
  community: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Community',
    required: true,
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
    default: '',
  },
  date: {
    type: Date,
    required: true,
  },
  type: {
    type: String,
    enum: ['voice', 'game', 'meetup', 'other'],
    default: 'other',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

CommunityEventSchema.index({ community: 1, date: 1 });

module.exports = mongoose.model('CommunityEvent', CommunityEventSchema);
