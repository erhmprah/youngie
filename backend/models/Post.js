const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: false,
    },
    images: [String],
    video: String,
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    comments: [
      {
        author: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        content: String,
        tags: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
          },
        ],
        category: {
          type: String,
          enum: ['Music', 'Gaming', 'Sports', 'Art', 'Tech'],
          required: false,
        },
        parent: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Comment',
        },
        isAnonymous: {
          type: Boolean,
          default: false,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
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
    shares: {
      type: Number,
      default: 0,
    },
    isPublic: {
      type: Boolean,
      default: true,
    },
    isAnonymous: {
      type: Boolean,
      default: false,
    },
    commentsDisabled: {
      type: Boolean,
      default: false,
    },
    tags: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    reports: [
      {
        reporter: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        reason: {
          type: String,
          default: '',
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true }
);

// Indexes for frequently queried fields
PostSchema.index({ author: 1, createdAt: -1 });
PostSchema.index({ isPublic: 1, createdAt: -1 });
PostSchema.index({ likes: 1 });
PostSchema.index({ 'reactions.type': 1 });
PostSchema.index({ tags: 1 });
PostSchema.index({ 'comments.category': 1 });
PostSchema.index({ createdAt: -1 });

// Text index for content search
PostSchema.index({ content: 'text' });

module.exports = mongoose.model('Post', PostSchema);
