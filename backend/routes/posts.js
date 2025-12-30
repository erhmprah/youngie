const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const User = require('../models/User');
const Notification = require('../models/Notification');
const AlbumPhoto = require('../models/AlbumPhoto');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const multer = require('multer');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/posts/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  // Allow images and videos
  if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images and videos are allowed.'), false);
  }
};

const upload = multer({ storage, fileFilter });

// Upload post image
router.post('/upload-image', auth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ msg: 'No file uploaded' });
    }

    // Ensure uploads/posts directory exists
    const fs = require('fs');
    const postsDir = 'uploads/posts/';
    if (!fs.existsSync(postsDir)) {
      fs.mkdirSync(postsDir, { recursive: true });
    }

    const imageUrl = `/uploads/posts/${req.file.filename}`;
    res.json({ imageUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload post image base64
router.post('/upload-image-base64', auth, async (req, res) => {
  try {
    const { imageData, filename } = req.body;
    if (!imageData || !filename) {
      return res.status(400).json({ msg: 'Image data and filename required' });
    }

    // Ensure uploads/posts directory exists
    const fs = require('fs');
    const postsDir = 'uploads/posts/';
    if (!fs.existsSync(postsDir)) {
      fs.mkdirSync(postsDir, { recursive: true });
    }

    // Decode base64 and save as file
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const fileName = Date.now() + '-' + filename;
    const filePath = `${postsDir}${fileName}`;
    fs.writeFileSync(filePath, buffer);

    const imageUrl = `/uploads/posts/${fileName}`;
    res.json({ imageUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload post video
router.post('/upload-video', auth, upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ msg: 'No file uploaded' });
    }

    // Ensure uploads/posts directory exists
    const fs = require('fs');
    const postsDir = 'uploads/posts/';
    if (!fs.existsSync(postsDir)) {
      fs.mkdirSync(postsDir, { recursive: true });
    }

    const videoUrl = `/uploads/posts/${req.file.filename}`;
    res.json({ videoUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload post video base64
router.post('/upload-video-base64', auth, async (req, res) => {
  try {
    const { videoData, filename } = req.body;
    if (!videoData || !filename) {
      return res.status(400).json({ msg: 'Video data and filename required' });
    }

    // Ensure uploads/posts directory exists
    const fs = require('fs');
    const postsDir = 'uploads/posts/';
    if (!fs.existsSync(postsDir)) {
      fs.mkdirSync(postsDir, { recursive: true });
    }

    // Decode base64 and save as file
    const base64Data = videoData.replace(/^data:video\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const fileName = Date.now() + '-' + filename;
    const filePath = `${postsDir}${fileName}`;
    fs.writeFileSync(filePath, buffer);

    const videoUrl = `/uploads/posts/${fileName}`;
    res.json({ videoUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all posts (feed)
router.get('/', auth, async (req, res) => {
  try {
    const isAnonymousFeed = String(req.query.isAnonymous) === 'true';
    const user = await User.findById(req.userId).populate('friends', '_id');

    // Get user's friends
    const friendIds = user.friends.map(friend => friend._id);

    // Get friends of friends (excluding user's direct friends and self)
    const friendsOfFriends = await User.find({
      _id: { $in: friendIds },
      friends: { $exists: true, $ne: [] }
    }).populate('friends', '_id');

    const friendsOfFriendsIds = [];
    friendsOfFriends.forEach(friend => {
      friend.friends.forEach(fof => {
        if (!friendIds.includes(fof._id) && fof._id.toString() !== req.userId) {
          friendsOfFriendsIds.push(fof._id);
        }
      });
    });

    // Get users the current user has interacted with (liked or commented on their posts)
    const interactedUsers = await Post.find({
      $or: [
        { likes: req.userId },
        { 'comments.author': req.userId }
      ]
    }).distinct('author');

    // Remove self from interacted users
    const filteredInteractedUsers = interactedUsers.filter(id => id.toString() !== req.userId);

    // Build the query conditions
    const queryConditions = [];

    // 1. All posts from friends (public or private)
    if (friendIds.length > 0) {
      queryConditions.push({
        author: { $in: friendIds }
      });
    }

    // 2. All posts from users the current user has interacted with
    if (filteredInteractedUsers.length > 0) {
      queryConditions.push({
        author: { $in: filteredInteractedUsers },
        isPublic: true
      });
    }

    // 3. Public posts from friends of friends
    if (friendsOfFriendsIds.length > 0) {
      queryConditions.push({
        author: { $in: friendsOfFriendsIds },
        isPublic: true
      });
    }

    // Always include the user's own posts
    queryConditions.push({ author: req.userId });

    let query;
    if (isAnonymousFeed) {
      query = { isAnonymous: true };
    } else {
      query = {
        $and: [
          { $or: queryConditions },
          { isAnonymous: { $ne: true } }
        ]
      };
    }

    const posts = await Post.find(query)
      .populate('author', 'username avatar profilePhoto bio')
      .populate('likes', 'username')
      .populate('comments.author', 'username avatar profilePhoto')
      .populate('comments.likes', 'username')
      .sort({ createdAt: -1 })
      .limit(50);

    // Mask anonymous posts/comments
    const maskedPosts = posts.map(doc => {
      const post = doc.toObject();
      if (post.isAnonymous) {
        post.author = { _id: 'anonymous', username: 'Anonymous', profilePhoto: null };
      }
      if (post.comments) {
        post.comments = post.comments.map(comment => {
          if (comment.isAnonymous) {
            comment.author = { _id: 'anonymous', username: 'Anonymous', profilePhoto: null };
          }
          return comment;
        });
      }
      return post;
    });

    res.json(maskedPosts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user's posts
router.get('/user/:userId', auth, async (req, res) => {
  try {
    const posts = await Post.find({ author: req.params.userId })
      .populate('author', 'username avatar profilePhoto bio')
      .populate('likes', 'username')
      .populate('comments.author', 'username avatar profilePhoto')
      .sort({ createdAt: -1 });

    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a post
router.post('/', auth, async (req, res) => {
  try {
    console.log('📝 Create Post Request:');
    console.log('  User ID:', req.userId);
    console.log('  Body:', req.body);

    const { content, image, video, isPublic, isAnonymous, commentsDisabled } = req.body;

    if ((!content || content.trim().length === 0) && !image && !video) {
      return res.status(400).json({ msg: 'Content, image, or video is required' });
    }

    const post = new Post({
      author: req.userId,
      content: content && content.trim() ? content.trim() : undefined,
      image,
      video,
      isPublic: isPublic !== undefined ? isPublic : true,
      isAnonymous: isAnonymous === true || isAnonymous === 'true',
      commentsDisabled: commentsDisabled === true || commentsDisabled === 'true',
      likes: [],
      comments: [],
    });

    console.log('💾 Saving post...');
    await post.save();
    console.log('✓ Post saved:', post._id);

    await post.populate('author', 'username avatar profilePhoto bio');
    console.log('✓ Post populated');

    // Add post to user's posts array
    const user = await User.findById(req.userId);
    if (user) {
      user.posts.push(post._id);
      await user.save();
      console.log('✓ User posts updated');
    }

    res.json(post);
  } catch (error) {
    console.error('❌ Create Post Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single post
router.get('/:postId', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId)
      .populate('author', 'username avatar profilePhoto bio')
      .populate('likes', 'username')
      .populate('comments.author', 'username avatar profilePhoto');

    if (!post) {
      return res.status(404).json({ msg: 'Post not found' });
    }

    const postObj = post.toObject();
    if (postObj.isAnonymous) {
      postObj.author = { _id: 'anonymous', username: 'Anonymous', profilePhoto: null };
    }
    if (postObj.comments) {
      postObj.comments = postObj.comments.map(comment => {
        if (comment.isAnonymous) {
          comment.author = { _id: 'anonymous', username: 'Anonymous', profilePhoto: null };
        }
        return comment;
      });
    }

    res.json(postObj);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Like a post
router.post('/:postId/like', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ msg: 'Post not found' });
    }

    const userId = req.userId;
    const likeIndex = post.likes.findIndex(id => id.toString() === userId);

    if (likeIndex === -1) {
      // Like the post
      post.likes.push(new mongoose.Types.ObjectId(userId));

      // Create notification if not liking own post and if one doesn't already exist
      if (post.author.toString() !== userId) {
        const existing = await Notification.findOne({
          recipient: post.author,
          sender: userId,
          type: 'like',
          relatedPost: post._id,
        });
        if (!existing) {
          await Notification.create({
            recipient: post.author,
            sender: userId,
            type: 'like',
            message: 'liked your post',
            relatedPost: post._id,
          });
        }
      }
    } else {
      // Unlike the post
      post.likes.splice(likeIndex, 1);
      // Remove the like notification if it exists
      try {
        await Notification.findOneAndDelete({
          recipient: post.author,
          sender: userId,
          type: 'like',
          relatedPost: post._id,
        });
      } catch (e) {
        // Non-fatal: log and continue
        console.error('Error removing like notification', e);
      }
    }

    await post.save();
    await post.populate('author', 'username avatar profilePhoto bio');
    await post.populate('likes', 'username');

    const liked = post.likes.findIndex(id => id.toString() === userId) !== -1;
    res.json({ post, liked, likesCount: post.likes.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add comment
router.post('/:postId/comment', auth, async (req, res) => {
  try {
    console.log('💬 Add Comment Request:');
    console.log('  Post ID:', req.params.postId);
    console.log('  User ID:', req.userId);
    console.log('  Content:', req.body.content);

    const { content, parent, isAnonymous } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ msg: 'Comment content is required' });
    }

    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ msg: 'Post not found' });
    }

    if (post.commentsDisabled) {
      return res.status(400).json({ msg: 'Comments are disabled for this post' });
    }

    const newComment = {
      author: req.userId,
      content,
      parent: parent || undefined,
      isAnonymous: post.isAnonymous || (isAnonymous === true || isAnonymous === 'true'),
      createdAt: new Date(),
    };

    post.comments.push(newComment);

    // Create notification if not commenting on own post
    if (post.author.toString() !== req.userId) {
      await Notification.create({
        recipient: post.author,
        sender: req.userId,
        type: 'comment',
        message: 'commented on your post',
        relatedPost: post._id,
      });
    }

    console.log('💾 Saving post with comment...');
    await post.save();
    console.log('✓ Post saved, populating...');

    await post.populate('author', 'username avatar profilePhoto bio');
    await post.populate('comments.author', 'username avatar profilePhoto');

    console.log('✓ Comment added successfully');

    const postObj = post.toObject();
    if (postObj.isAnonymous) {
      postObj.author = { _id: 'anonymous', username: 'Anonymous', profilePhoto: null };
    }
    if (postObj.comments) {
      postObj.comments = postObj.comments.map(comment => {
        if (comment.isAnonymous) {
          comment.author = { _id: 'anonymous', username: 'Anonymous', profilePhoto: null };
        }
        return comment;
      });
    }
    res.json(postObj);
  } catch (error) {
    console.error('❌ Add Comment Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Like a comment
router.post('/:postId/comment/:commentId/like', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ msg: 'Post not found' });
    }

    const comment = post.comments.id(req.params.commentId);
    if (!comment) {
      return res.status(404).json({ msg: 'Comment not found' });
    }

    const userId = req.userId;
    const likeIndex = comment.likes.findIndex(id => id.toString() === userId);

    if (likeIndex === -1) {
      // Like the comment
      comment.likes.push(userId);

      // Create notification if not liking own comment
      if (comment.author.toString() !== userId) {
        await Notification.create({
          recipient: comment.author,
          sender: userId,
          type: 'like_comment',
          message: 'liked your comment',
          relatedPost: post._id,
        });
      }
    } else {
      // Unlike the comment
      comment.likes.splice(likeIndex, 1);
    }

    await post.save();
    await post.populate('comments.author', 'username avatar profilePhoto');
    await post.populate('comments.likes', 'username');

    res.json(post);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update post
router.put('/:postId', auth, async (req, res) => {
  try {
    const { content, image, video } = req.body;

    if ((!content || content.trim().length === 0) && !image && !video) {
      return res.status(400).json({ msg: 'Content, image, or video is required' });
    }

    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ msg: 'Post not found' });
    }

    // Check authorization
    if (post.author.toString() !== req.userId) {
      return res.status(403).json({ msg: 'Not authorized to update this post' });
    }

    post.content = content;
    if (image !== undefined) {
      post.image = image;
    }
    if (video !== undefined) {
      post.video = video;
    }
    post.updatedAt = new Date();

    await post.save();
    await post.populate('author', 'username avatar profilePhoto bio');
    await post.populate('likes', 'username');
    await post.populate('comments.author', 'username avatar profilePhoto');

    res.json(post);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete post
router.delete('/:postId', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ msg: 'Post not found' });
    }

    // Check authorization
    if (post.author.toString() !== req.userId) {
      return res.status(403).json({ msg: 'Not authorized to delete this post' });
    }

    await Post.findByIdAndDelete(req.params.postId);

    // Remove post from user's posts array
    const user = await User.findById(req.userId);
    user.posts = user.posts.filter(id => id.toString() !== req.params.postId);
    await user.save();

    res.json({ msg: 'Post deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete comment
router.delete('/:postId/comment/:commentId', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ msg: 'Post not found' });
    }

    const comment = post.comments.id(req.params.commentId);
    if (!comment) {
      return res.status(404).json({ msg: 'Comment not found' });
    }

    // Check authorization
    if (comment.author.toString() !== req.userId) {
      return res.status(403).json({ msg: 'Not authorized to delete this comment' });
    }

    post.comments.id(req.params.commentId).deleteOne();
    await post.save();
    await post.populate('comments.author', 'username avatar profilePhoto');

    res.json(post);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get trending posts
router.get('/trending/hot', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate('friends', '_id');

    // Get user's friends
    const friendIds = user.friends.map(friend => friend._id);

    // Get friends of friends (excluding user's direct friends and self)
    const friendsOfFriends = await User.find({
      _id: { $in: friendIds },
      friends: { $exists: true, $ne: [] }
    }).populate('friends', '_id');

    const friendsOfFriendsIds = [];
    friendsOfFriends.forEach(friend => {
      friend.friends.forEach(fof => {
        if (!friendIds.includes(fof._id) && fof._id.toString() !== req.userId) {
          friendsOfFriendsIds.push(fof._id);
        }
      });
    });

    // Get users the current user has interacted with
    const interactedUsers = await Post.find({
      $or: [
        { likes: req.userId },
        { 'comments.author': req.userId }
      ]
    }).distinct('author');

    const filteredInteractedUsers = interactedUsers.filter(id => id.toString() !== req.userId);

    // Build the query conditions for trending posts
    const queryConditions = [];

    // All posts from friends
    if (friendIds.length > 0) {
      queryConditions.push({ author: { $in: friendIds } });
    }

    // All posts from interacted users
    if (filteredInteractedUsers.length > 0) {
      queryConditions.push({
        author: { $in: filteredInteractedUsers },
        isPublic: true
      });
    }

    // Public posts from friends of friends
    if (friendsOfFriendsIds.length > 0) {
      queryConditions.push({
        author: { $in: friendsOfFriendsIds },
        isPublic: true
      });
    }

    // If no conditions, show public posts
    if (queryConditions.length === 0) {
      queryConditions.push({ isPublic: true });
    }

    const posts = await Post.find({ $or: queryConditions })
      .populate('author', 'username avatar profilePhoto bio')
      .sort({ likes: -1, createdAt: -1 })
      .limit(20);

    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Album Routes ---

// Upload album photo (Base64)
router.post('/album', auth, async (req, res) => {
  try {
    const { imageData, filename } = req.body;
    if (!imageData || !filename) {
      return res.status(400).json({ msg: 'Image data and filename required' });
    }

    // Ensure uploads/album directory exists
    const fs = require('fs');
    const albumDir = 'uploads/album/';
    if (!fs.existsSync(albumDir)) {
      fs.mkdirSync(albumDir, { recursive: true });
    }

    // Decode base64 and save as file
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const fileName = Date.now() + '-' + filename;
    const filePath = `${albumDir}${fileName}`;
    fs.writeFileSync(filePath, buffer);

    const imageUrl = `/uploads/album/${fileName}`;

    const newPhoto = new AlbumPhoto({
      user: req.userId,
      image: imageUrl
    });

    await newPhoto.save();
    res.json(newPhoto);
  } catch (error) {
    console.error('Album upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user album
router.get('/album/user/:userId', auth, async (req, res) => {
  try {
    const photos = await AlbumPhoto.find({ user: req.params.userId }).sort({ createdAt: -1 });
    res.json(photos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete album photo
router.delete('/album/:photoId', auth, async (req, res) => {
  try {
    const photo = await AlbumPhoto.findOne({ _id: req.params.photoId, user: req.userId });
    if (!photo) {
      return res.status(404).json({ msg: 'Photo not found or unauthorized' });
    }
    await AlbumPhoto.findByIdAndDelete(req.params.photoId);
    res.json({ msg: 'Photo deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function to escape regex special characters
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Search posts
router.get('/search', auth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ msg: 'Search query required' });
    }

    const escapedQuery = escapeRegex(q);

    // 1. Find users whose usernames match the query
    const matchingUsers = await User.find({
      username: { $regex: escapedQuery, $options: 'i' }
    }).select('_id');
    const authorIds = matchingUsers.map(user => user._id);

    // 2. Build search conditions for posts
    const postConditions = [
      { content: { $regex: escapedQuery, $options: 'i' } }
    ];

    // Only add author search if we have matching users
    if (authorIds.length > 0) {
      postConditions.push({ author: { $in: authorIds } });
    }

    // 3. Search posts
    const query = { isPublic: true };
    if (postConditions.length > 0) {
      query.$or = postConditions;
    }

    const posts = await Post.find(query)
      .populate('author', 'username avatar profilePhoto bio')
      .populate('likes', 'username')
      .sort({ createdAt: -1 })
      .limit(20);

    res.json(posts);
  } catch (error) {
    console.error('Error searching posts:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
