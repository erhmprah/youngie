const mongoose = require('mongoose');

const StorySchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      maxlength: 2200, // Instagram limit
    },
    image: String,
    video: String,
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
      index: { expires: 0 }, // TTL index
    },
    viewers: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        viewedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    tags: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    pollOptions: [
      {
        text: String,
        votes: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
          },
        ],
      },
    ],
    reactions: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        type: {
          type: String,
          enum: ['like', 'heart', 'laugh', 'wow', 'sad', 'fire'],
          default: 'like',
        },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

// Index for efficient queries
StorySchema.index({ author: 1, createdAt: -1 });
StorySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Unique index to enforce one reaction per user per story
StorySchema.index({ _id: 1, 'reactions.user': 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Story', StorySchema);