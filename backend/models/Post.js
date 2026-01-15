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
    comments: [
      {
        author: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        content: String,
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
            createdAt: {
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
  },
  { timestamps: true }
);

module.exports = mongoose.model('Post', PostSchema);
