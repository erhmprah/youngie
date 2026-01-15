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
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    const userFavorites = user.favorites ? user.favorites.map(id => id.toString()) : [];

    // Get user's friends
    const friendIds = (user.friends || []).filter(f => f).map(friend => friend._id);

    // Get friends of friends (excluding user's direct friends and self)
    const friendsOfFriends = await User.find({
      _id: { $in: friendIds },
      friends: { $exists: true, $ne: [] }
    }).populate('friends', '_id isPrivate');

    const friendsOfFriendsIds = [];
    friendsOfFriends.forEach(friend => {
      if (friend.friends) {
        friend.friends.forEach(fof => {
          if (fof && !friendIds.some(fid => fid.toString() === fof._id.toString()) && fof._id.toString() !== req.userId && !fof.isPrivate) {
            friendsOfFriendsIds.push(fof._id);
          }
        });
      }
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

    // Filter out private users from interacted users
    const publicInteractedUsers = [];
    if (filteredInteractedUsers.length > 0) {
      const users = await User.find({ _id: { $in: filteredInteractedUsers } }).select('isPrivate');
      users.forEach(u => {
        if (!u.isPrivate) publicInteractedUsers.push(u._id);
      });
    }

    // Build the query conditions
    const queryConditions = [];

    // 1. All posts from friends (public or private)
    if (friendIds.length > 0) {
      queryConditions.push({
        author: { $in: friendIds }
      });
    }

    // 2. All posts from users the current user has interacted with
    if (publicInteractedUsers.length > 0) {
      queryConditions.push({
        author: { $in: publicInteractedUsers },
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
      query = {
        $and: [
          { isAnonymous: true },
          { author: { $nin: user.mutedUsers || [] } } // Exclude muted users
        ]
      };
    } else {
      query = {
        $and: [
          { $or: queryConditions },
          { isAnonymous: { $ne: true } },
          { author: { $nin: user.mutedUsers || [] } } // Exclude muted users
        ]
      };
    }

    const posts = await Post.find(query)
      .populate('author', 'username avatar profilePhoto bio')
      .populate('likes', '_id username avatar profilePhoto')
      .populate({ path: 'reactions.user', select: 'username avatar profilePhoto', strictPopulate: false })
      .populate('tags', 'username')
      .populate('comments.author', 'username avatar profilePhoto')
      .populate('comments.reactions.user', 'username')
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
      post.isFavorited = userFavorites.includes(post._id.toString());
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
    // Check privacy
    const userToCheck = await User.findById(req.params.userId);
    if (userToCheck && userToCheck.isPrivate) {
      const isSelf = req.userId === req.params.userId;
      const isFriend = userToCheck.friends.some(id => id.toString() === req.userId);
      const isFollower = userToCheck.followers.some(id => id.toString() === req.userId);
      if (!isSelf && !isFriend && !isFollower) {
        return res.json([]);
      }
    }

    const currentUser = await User.findById(req.userId).select('favorites');
    const userFavorites = currentUser && currentUser.favorites ? currentUser.favorites.map(id => id.toString()) : [];

    const posts = await Post.find({ author: req.params.userId })
      .populate('author', 'username avatar profilePhoto bio')
      .populate('likes', '_id username avatar profilePhoto')
      .populate({ path: 'reactions.user', select: 'username avatar profilePhoto', strictPopulate: false })
      .populate('tags', 'username')
      .populate('comments.author', 'username avatar profilePhoto')
      .sort({ createdAt: -1 });

    const postsWithFav = posts.map(doc => {
      const post = doc.toObject();
      post.isFavorited = userFavorites.includes(post._id.toString());
      return post;
    });

    res.json(postsWithFav);
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

    const { content, images, video, isPublic, isAnonymous, commentsDisabled, tags, pollOptions, category } = req.body;

    if ((!content || content.trim().length === 0) && (!images || images.length === 0) && !video) {
      return res.status(400).json({ msg: 'Content, image(s), or video is required' });
    }

    if (images && images.length > 10) {
      return res.status(400).json({ msg: 'You can upload a maximum of 10 images.' });
    }

    const post = new Post({
      author: req.userId,
      content: content && content.trim() ? content.trim() : undefined,
      images,
      video,
      isPublic: isPublic !== undefined ? isPublic : true,
      isAnonymous: isAnonymous === true || isAnonymous === 'true',
      commentsDisabled: commentsDisabled === true || commentsDisabled === 'true',
      likes: [],
      comments: [],
      tags: tags || [],
      pollOptions: pollOptions || [],
      category: category || undefined,
    });

    console.log('💾 Saving post...');
    await post.save();
    console.log('✓ Post saved:', post._id);

    await post.populate('author', 'username avatar profilePhoto bio');
    await post.populate('tags', 'username');
    console.log('✓ Post populated');

    // Add post to user's posts array
    const user = await User.findById(req.userId);
    if (user) {
      user.posts.push(post._id);
      await user.save();
      console.log('✓ User posts updated');
    }

    // Create notifications for tagged users
    if (tags && Array.isArray(tags) && tags.length > 0) {
      const notificationPromises = tags.map(taggedUserId => {
        if (taggedUserId !== req.userId) {
          return Notification.create({
            recipient: taggedUserId,
            sender: req.userId,
            type: 'tag',
            message: 'tagged you in a post',
            relatedPost: post._id,
          });
        }
      });
      await Promise.all(notificationPromises);
    }

    res.json(post);
  } catch (error) {
    console.error('❌ Create Post Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user's favorite posts
router.get('/favorites', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Ensure favorites is an array and filter out any invalid entries
    let favorites = user.favorites;
    if (!Array.isArray(favorites)) {
      favorites = [];
    }
    const favoriteIds = favorites.filter(id => id && mongoose.Types.ObjectId.isValid(id));

    const posts = await Post.find({ _id: { $in: favoriteIds } })
      .populate('author', 'username avatar profilePhoto bio')
      .populate('likes', '_id username avatar profilePhoto')
      .populate({ path: 'reactions.user', select: 'username avatar profilePhoto', strictPopulate: false })
      .populate('tags', 'username')
      .populate('comments.author', 'username avatar profilePhoto')
      .populate('comments.reactions.user', 'username')
      .sort({ createdAt: -1 });

    // Mask anonymous posts
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
      post.isFavorited = true; // By definition, these are favorited
      return post;
    });
    res.json(maskedPosts);
  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get trending posts
router.get('/trending/hot', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate('friends', '_id');
    const userFavorites = user.favorites ? user.favorites.map(id => id.toString()) : [];

    // Get user's friends
    const friendIds = user.friends.map(friend => friend._id);

    // Get friends of friends (excluding user's direct friends and self)
    const friendsOfFriends = await User.find({
      _id: { $in: friendIds },
      friends: { $exists: true, $ne: [] }
    }).populate('friends', '_id isPrivate');

    const friendsOfFriendsIds = [];
    friendsOfFriends.forEach(friend => {
      friend.friends.forEach(fof => {
        if (!friendIds.includes(fof._id) && fof._id.toString() !== req.userId && !fof.isPrivate) {
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

    // Filter out private users from interacted users
    const publicInteractedUsers = [];
    if (filteredInteractedUsers.length > 0) {
      const users = await User.find({ _id: { $in: filteredInteractedUsers } }).select('isPrivate');
      users.forEach(u => {
        if (!u.isPrivate) publicInteractedUsers.push(u._id);
      });
    }

    // Build the query conditions for trending posts
    const queryConditions = [];

    // All posts from friends
    if (friendIds.length > 0) {
      queryConditions.push({ author: { $in: friendIds } });
    }

    // All posts from interacted users
    if (publicInteractedUsers.length > 0) {
      queryConditions.push({
        author: { $in: publicInteractedUsers },
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
      .populate('likes', '_id username avatar profilePhoto')
      .populate('tags', 'username')
      .populate({ path: 'reactions.user', select: 'username avatar profilePhoto', strictPopulate: false })
      .sort({ likes: -1, createdAt: -1 })
      .limit(20);

    const maskedPosts = posts.map(doc => {
      const post = doc.toObject();
      post.isFavorited = userFavorites.includes(post._id.toString());
      return post;
    });

    res.json(maskedPosts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search posts
router.get('/search', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId).select('favorites');
    const userFavorites = currentUser && currentUser.favorites ? currentUser.favorites.map(id => id.toString()) : [];

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
      { content: { $regex: escapedQuery, $options: 'i' } },
      { category: escapedQuery }
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
      .populate('likes', '_id username avatar profilePhoto')
      .populate({ path: 'reactions.user', select: 'username avatar profilePhoto', strictPopulate: false })
      .populate('tags', 'username')
      .sort({ createdAt: -1 })
      .limit(20);

    const maskedPosts = posts.map(doc => {
      const post = doc.toObject();
      post.isFavorited = userFavorites.includes(post._id.toString());
      return post;
    });

    res.json(maskedPosts);
  } catch (error) {
    console.error('Error searching posts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single post
router.get('/:postId', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId).select('favorites');
    const userFavorites = currentUser && currentUser.favorites ? currentUser.favorites.map(id => id.toString()) : [];

    const post = await Post.findById(req.params.postId)
      .populate('author', 'username avatar profilePhoto bio')
      .populate('likes', '_id username avatar profilePhoto')
      .populate({ path: 'reactions.user', select: 'username avatar profilePhoto', strictPopulate: false })
      .populate('tags', 'username')
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
    postObj.isFavorited = userFavorites.includes(postObj._id.toString());

    res.json(postObj);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get post likes with pagination
router.get('/:postId/likes', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Get the slice of likes and populate them
    const post = await Post.findById(req.params.postId)
      .select('likes')
      .slice('likes', [skip, limit])
      .populate('likes', 'username avatar profilePhoto bio');

    if (!post) {
      return res.status(404).json({ msg: 'Post not found' });
    }

    // Get total count of likes efficiently
    const countResult = await Post.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(req.params.postId) } },
      { $project: { count: { $size: '$likes' } } }
    ]);

    const totalLikes = countResult.length > 0 ? countResult[0].count : 0;

    res.json({
      likes: post.likes,
      total: totalLikes,
      page,
      totalPages: Math.ceil(totalLikes / limit),
      hasMore: page * limit < totalLikes
    });
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

      // Create notifications for post author and tagged users
      const notificationPromises = [];

      // Notify post author if not liking own post
      if (post.author.toString() !== userId) {
        const existingAuthor = await Notification.findOne({
          recipient: post.author,
          sender: userId,
          type: 'like',
          relatedPost: post._id,
        });
        if (!existingAuthor) {
          notificationPromises.push(Notification.create({
            recipient: post.author,
            sender: userId,
            type: 'like',
            message: 'liked your post',
            relatedPost: post._id,
          }));
        }
      }

      // Notify tagged users if they exist and aren't the liker
      if (post.tags && Array.isArray(post.tags) && post.tags.length > 0) {
        const taggedNotifications = post.tags
          .filter(taggedUserId => taggedUserId.toString() !== userId)
          .map(taggedUserId => {
            return Notification.findOne({
              recipient: taggedUserId,
              sender: userId,
              type: 'like',
              relatedPost: post._id,
            }).then(existing => {
              if (!existing) {
                return Notification.create({
                  recipient: taggedUserId,
                  sender: userId,
                  type: 'like',
                  message: 'liked a post you\'re tagged in',
                  relatedPost: post._id,
                });
              }
            });
          });
        notificationPromises.push(...taggedNotifications);
      }

      await Promise.all(notificationPromises);
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
    await post.populate('likes', '_id username avatar profilePhoto');
    await post.populate('tags', 'username');
    await post.populate({ path: 'reactions.user', select: 'username avatar profilePhoto', strictPopulate: false });

    // Emit socket event for real-time updates
    if (req.io) {
      req.io.emit('post:updated', post);
    }

    const liked = post.likes.findIndex(id => id.toString() === userId) !== -1;
    res.json({ post, liked, likesCount: post.likes.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// React to a post
router.post('/:postId/react', auth, async (req, res) => {
  try {
    const { reactionType = 'like' } = req.body;
    const post = await Post.findById(req.params.postId);
    
    if (!post) {
      return res.status(404).json({ msg: 'Post not found' });
    }

    const userId = req.userId;

    // Remove any existing reaction from this user
    post.reactions = post.reactions.filter(r => r.user.toString() !== userId);

    // Add new reaction if not removing
    if (reactionType !== 'remove') {
      post.reactions.push({
        user: userId,
        type: reactionType,
        createdAt: new Date()
      });

      // Create notification if not reacting to own post
      if (post.author.toString() !== userId) {
        await Notification.create({
          recipient: post.author,
          sender: userId,
          type: 'react_post',
          message: `reacted to your post with ${reactionType}`,
          relatedPost: post._id,
        });
      }
    }

    await post.save();
    await post.populate('author', 'username avatar profilePhoto bio');
    await post.populate({ path: 'reactions.user', select: 'username avatar profilePhoto', strictPopulate: false });
    await post.populate('likes', '_id username avatar profilePhoto'); // Keep likes populated for backward compat

    // Emit socket event for real-time updates
    if (req.io) {
      req.io.emit('post:updated', post);
    }

    res.json(post);
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

    const { content, parent, isAnonymous, tags } = req.body;

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
      tags: tags || [],
      createdAt: new Date(),
    };

    post.comments.push(newComment);

    // Create notifications for post author, post tagged users, and comment tagged users
    const commentNotificationPromises = [];

    // Notify post author if not commenting on own post
    if (post.author.toString() !== req.userId) {
      commentNotificationPromises.push(Notification.create({
        recipient: post.author,
        sender: req.userId,
        type: 'comment',
        message: 'commented on your post',
        relatedPost: post._id,
      }));
    }

    // Notify users tagged in the post if they exist and aren't the commenter
    if (post.tags && Array.isArray(post.tags) && post.tags.length > 0) {
      const postTaggedNotifications = post.tags
        .filter(taggedUserId => taggedUserId.toString() !== req.userId)
        .map(taggedUserId => {
          return Notification.create({
            recipient: taggedUserId,
            sender: req.userId,
            type: 'comment',
            message: 'commented on a post you\'re tagged in',
            relatedPost: post._id,
          });
        });
      commentNotificationPromises.push(...postTaggedNotifications);
    }

    // Notify users tagged in the comment if they exist and aren't the commenter
    if (tags && Array.isArray(tags) && tags.length > 0) {
      const commentTaggedNotifications = tags
        .filter(taggedUserId => taggedUserId.toString() !== req.userId)
        .map(taggedUserId => {
          return Notification.create({
            recipient: taggedUserId,
            sender: req.userId,
            type: 'tag',
            message: 'tagged you in a comment',
            relatedPost: post._id,
          });
        });
      commentNotificationPromises.push(...commentTaggedNotifications);
    }

    // Notify parent comment author if this is a reply
    if (parent) {
      const parentComment = post.comments.id(parent);
      if (parentComment && parentComment.author.toString() !== req.userId) {
        commentNotificationPromises.push(Notification.create({
          recipient: parentComment.author,
          sender: req.userId,
          type: 'reply',
          message: 'replied to your comment',
          relatedPost: post._id,
        }));
      }
    }

    const createdNotifications = await Promise.all(commentNotificationPromises);

    // Emit socket events for real-time notifications
    if (req.io && createdNotifications.length > 0) {
      createdNotifications.forEach(notification => {
        if (notification && notification.recipient) {
          req.io.to(notification.recipient.toString()).emit('notification:new', notification);
        }
      });
    }

    console.log('💾 Saving post with comment...');
    await post.save();
    console.log('✓ Post saved, populating...');

    await post.populate('author', 'username avatar profilePhoto bio');
    await post.populate('comments.author', 'username avatar profilePhoto');
    await post.populate('likes', '_id username avatar profilePhoto');
    await post.populate('tags', 'username');
    await post.populate({ path: 'reactions.user', select: 'username avatar profilePhoto', strictPopulate: false });
    await post.populate('comments.reactions.user', 'username');

    // Emit socket event for real-time updates
    if (req.io) {
      req.io.emit('post:updated', post);
    }

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

// React to a comment
router.post('/:postId/comment/:commentId/react', auth, async (req, res) => {
  try {
    const { reactionType = 'like' } = req.body;

    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ msg: 'Post not found' });
    }

    const comment = post.comments.id(req.params.commentId);
    if (!comment) {
      return res.status(404).json({ msg: 'Comment not found' });
    }

    const userId = req.userId;

    // Remove any existing reaction from this user
    comment.reactions = comment.reactions.filter(r => r.user.toString() !== userId);

    // Add new reaction if not removing
    if (reactionType !== 'remove') {
      comment.reactions.push({
        user: userId,
        type: reactionType,
      });

      // Create notification if not reacting to own comment
      if (comment.author.toString() !== userId) {
        await Notification.create({
          recipient: comment.author,
          sender: userId,
          type: 'react_comment',
          message: `reacted to your comment with ${reactionType}`,
          relatedPost: post._id,
        });
      }
    }

    await post.save();
    await post.populate('comments.author', 'username avatar profilePhoto');
    await post.populate('comments.reactions.user', 'username');

    res.json(post);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update post
router.put('/:postId', auth, async (req, res) => {
  try {
    const { content, images, video } = req.body;

    if ((!content || content.trim().length === 0) && (!images || images.length === 0) && !video) {
      return res.status(400).json({ msg: 'Content, image(s), or video is required' });
    }

    if (images && images.length > 10) {
      return res.status(400).json({ msg: 'You can upload a maximum of 10 images.' });
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
    if (images !== undefined) {
      post.images = images;
    }
    if (video !== undefined) {
      post.video = video;
    }
    post.updatedAt = new Date();

    await post.save();
    await post.populate('author', 'username avatar profilePhoto bio');
    await post.populate('likes', '_id username avatar profilePhoto');
    await post.populate('tags', 'username');
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
    if (comment.author.toString() !== req.userId && post.author.toString() !== req.userId) {
      return res.status(403).json({ msg: 'Not authorized to delete this comment' });
    }

    // Find all comments to delete (the target comment and its replies)
    const idsToRemove = [req.params.commentId];
    let foundNew = true;
    while (foundNew) {
      foundNew = false;
      post.comments.forEach(c => {
        if (c.parent && idsToRemove.includes(c.parent.toString()) && !idsToRemove.includes(c._id.toString())) {
          idsToRemove.push(c._id.toString());
          foundNew = true;
        }
      });
    }

    // Remove the comments
    post.comments = post.comments.filter(c => !idsToRemove.includes(c._id.toString()));

    await post.save();
    await post.populate('author', 'username avatar profilePhoto bio');
    await post.populate('comments.author', 'username avatar profilePhoto');
    await post.populate('likes', '_id username avatar profilePhoto');
    await post.populate('tags', 'username');
    await post.populate({ path: 'reactions.user', select: 'username avatar profilePhoto', strictPopulate: false });
    await post.populate('comments.reactions.user', 'username');

    // Emit socket event for real-time updates
    if (req.io) {
      req.io.emit('post:updated', post);
    }

    res.json(post);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Report a comment
router.post('/:postId/comment/:commentId/report', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ msg: 'Post not found' });
    }

    const comment = post.comments.id(req.params.commentId);
    if (!comment) {
      return res.status(404).json({ msg: 'Comment not found' });
    }

    if (comment.author.toString() === req.userId) {
      return res.status(400).json({ msg: 'Cannot report your own comment' });
    }

    // Notify post author so they can moderate
    if (post.author.toString() !== req.userId) {
      await Notification.create({
        recipient: post.author,
        sender: req.userId,
        type: 'report_comment',
        message: `reported a comment: "${comment.content.substring(0, 30)}${comment.content.length > 30 ? '...' : ''}"`,
        relatedPost: post._id,
      });
    }

    res.json({ msg: 'Comment reported successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Favorite a post
router.post('/:postId/favorite', auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.postId)) {
      return res.status(400).json({ msg: 'Invalid post ID' });
    }

    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ msg: 'Post not found' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Ensure favorites array exists and filter out invalid entries
    user.favorites = (user.favorites || []).filter(id => id && mongoose.Types.ObjectId.isValid(id));

    // Check if post is already favorited
    const isFavorited = user.favorites.some(id => id.toString() === req.params.postId);

    if (!isFavorited) {
      user.favorites.push(new mongoose.Types.ObjectId(req.params.postId));
      await user.save();
    }
    res.json({ msg: 'Post favorited' });
  } catch (error) {
    console.error('Error favoriting post:', error);
    res.status(500).json({ error: error.message });
  }
});

// Unfavorite a post
router.delete('/:postId/favorite', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Ensure favorites array exists and filter out invalid entries
    user.favorites = (user.favorites || []).filter(id => id && mongoose.Types.ObjectId.isValid(id));

    // Remove the specific post from favorites
    user.favorites = user.favorites.filter(id => id.toString() !== req.params.postId);

    await user.save();
    res.json({ msg: 'Post unfavorited' });
  } catch (error) {
    console.error('Error unfavoriting post:', error);
    res.status(500).json({ error: error.message });
  }
});

// Share a post (increment shares and notify author)
router.post('/:postId/share', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ msg: 'Post not found' });
    }

    // Increment shares count
    post.shares = (post.shares || 0) + 1;
    await post.save();

    // Create notification for post author if not sharing own post
    if (post.author.toString() !== req.userId) {
      await Notification.create({
        recipient: post.author,
        sender: req.userId,
        type: 'share',
        message: 'shared your post',
        relatedPost: post._id,
      });
    }

    res.json({ shares: post.shares });
  } catch (error) {
    console.error('Error sharing post:', error);
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

// Vote on poll
router.post('/:postId/vote-poll', auth, async (req, res) => {
  try {
    const { optionIndex } = req.body;

    if (optionIndex === undefined || optionIndex < 0) {
      return res.status(400).json({ msg: 'Valid option index required' });
    }

    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ msg: 'Post not found' });
    }

    if (!post.pollOptions || post.pollOptions.length === 0) {
      return res.status(400).json({ msg: 'No poll options available' });
    }

    if (optionIndex >= post.pollOptions.length) {
      return res.status(400).json({ msg: 'Invalid option index' });
    }

    const userId = req.userId;

    // Remove user from all options first (in case they already voted)
    post.pollOptions.forEach(option => {
      option.votes = option.votes.filter(id => id.toString() !== userId);
    });

    // Add vote to selected option
    post.pollOptions[optionIndex].votes.push(userId);

    await post.save();

    // Populate and return updated post
    await post.populate('author', 'username avatar profilePhoto bio');
    await post.populate('likes', '_id username avatar profilePhoto');
    await post.populate('tags', 'username');
    await post.populate('comments.author', 'username avatar profilePhoto');

    res.json(post);
  } catch (error) {
    console.error('Error voting on poll:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to escape regex special characters
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = router;
