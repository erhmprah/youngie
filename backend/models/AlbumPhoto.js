const mongoose = require('mongoose');

const AlbumPhotoSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  image: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for frequently queried fields
AlbumPhotoSchema.index({ user: 1, createdAt: -1 });
AlbumPhotoSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AlbumPhoto', AlbumPhotoSchema);