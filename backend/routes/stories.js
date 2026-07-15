const express = require('express');
const router = express.Router();
const Story = require('../models/Story');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { parsePaginationParams, buildPaginatedResponse } = require('../utils/pagination');
const multer = require('multer');
const { uploadFile, supabase: supabaseStorage } = require('../utils/supabaseStorage');
const pushService = require('../services/push-notification');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/stories/');
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

const upload = multer({ storage, fileFilter, limits: { fileSize: 100 * 1024 * 1024 } });

// Get stories for feed (from users you follow + your own)
router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate('friends', '_id').lean();
    const followingIds = (user.friends || []).filter(f => f).map(friend => friend._id);
    followingIds.push(req.userId); // Include own stories

    // Filter out muted authors
    const mutedAuthors = (user.mutedStoryAuthors || []).map(id => id.toString());
    const filteredFollowingIds = followingIds.filter(id => !mutedAuthors.includes(id.toString()));

    const { page, limit, skip } = parsePaginationParams(req.query);
    const storyQuery = {
      author: { $in: filteredFollowingIds },
      expiresAt: { $gt: new Date() }, // Not expired
    };
    const total = await Story.countDocuments(storyQuery);

    const stories = await Story.find(storyQuery)
      .populate('author', 'username avatar profilePhoto')
      .populate('viewers.user', 'username avatar profilePhoto')
      .populate('tags', 'username')
      .populate({ path: 'reactions.user', select: 'username avatar profilePhoto', strictPopulate: false })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Group stories by author
    const groupedStories = stories.reduce((acc, story) => {
      if (!story.author) return acc;
      const authorId = story.author._id.toString();
      if (!acc[authorId]) {
        acc[authorId] = {
          user: story.author,
          stories: [],
        };
      }
      acc[authorId].stories.push(story);
      return acc;
    }, {});

    // Add allViewed property
    const groupedArray = Object.values(groupedStories);
    const result = groupedArray.map(group => ({
      ...group,
      allViewed: group.stories.every(story => {
        const isAuthor = story.author && story.author._id.toString() === req.userId;
        if (isAuthor) return true;
        return story.viewers.some(viewer => viewer.user && viewer.user.toString() === req.userId);
      }),
    }));

    res.json(buildPaginatedResponse(result, total, { page, limit, skip, hasNextPage: skip + result.length < total, hasPrevPage: page > 1 }));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user's stories
router.get('/user/:userId', auth, async (req, res) => {
  try {
    const stories = await Story.find({
      author: req.params.userId,
      expiresAt: { $gt: new Date() },
    })
      .populate('author', 'username avatar profilePhoto')
      .populate('viewers.user', 'username avatar profilePhoto')
      .populate('tags', 'username')
      .populate({ path: 'reactions.user', select: 'username avatar profilePhoto', strictPopulate: false })
      .sort({ createdAt: -1 });

    res.json(stories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload story image base64
router.post('/upload-image-base64', auth, async (req, res) => {
  try {
    const { imageData, filename } = req.body;
    if (!imageData || !filename) {
      return res.status(400).json({ msg: 'Image data and filename required' });
    }

    // If Supabase is configured, upload to Supabase
    if (supabaseStorage) {
      try {
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const mimeType = imageData.match(/^data:image\/(\w+);base64,/)?.[1] || 'jpeg';
        const imageUrl = await uploadFile(buffer, filename, mimeType, 'stories');
        return res.json({ imageUrl });
      } catch (supabaseError) {
        console.error('❌ Supabase story upload failed:', supabaseError.message);
      }
    }

    // Ensure uploads/stories directory exists
    const fs = require('fs');
    const storiesDir = 'uploads/stories/';
    if (!fs.existsSync(storiesDir)) {
      fs.mkdirSync(storiesDir, { recursive: true });
    }

    // Decode base64 and save as file
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const fileName = Date.now() + '-' + filename;
    const filePath = `${storiesDir}${fileName}`;
    fs.writeFileSync(filePath, buffer);

    const imageUrl = `/uploads/stories/${fileName}`;
    res.json({ imageUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a story
router.post('/', auth, async (req, res) => {
  try {
    const { content, image, video, tags, pollOptions } = req.body;

    if (!content && !image && !video) {
      return res.status(400).json({ msg: 'Story must have content, image, or video' });
    }

    const story = new Story({
      author: req.userId,
      content,
      image,
      video,
      tags: tags || [],
      pollOptions: pollOptions || [],
    });

    await story.save();
    await story.populate('author', 'username avatar profilePhoto');
    await story.populate('tags', 'username');

    // Create notifications for tagged users
    if (tags && Array.isArray(tags) && tags.length > 0) {
      const Notification = require('../models/Notification');
      const notificationPromises = tags.map(taggedUserId => {
        if (taggedUserId !== req.userId) {
          return Notification.create({
            recipient: taggedUserId,
            sender: req.userId,
            type: 'tag',
            message: 'tagged you in a story',
            relatedStory: story._id,
          });
        }
      });
      await Promise.all(notificationPromises);

      tags.filter(taggedUserId => taggedUserId !== req.userId)
        .forEach(taggedUserId => {
          pushService.sendTagNotification(taggedUserId, null, 'story', req.userId, null, story._id).catch(() => {});
        });
    }

    res.json(story);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single story
router.get('/:storyId', auth, async (req, res) => {
  try {
    const story = await Story.findById(req.params.storyId)
      .populate('author', 'username avatar profilePhoto')
      .populate('viewers.user', 'username avatar profilePhoto')
      .populate('tags', 'username')
      .populate({ path: 'reactions.user', select: 'username avatar profilePhoto', strictPopulate: false });

    if (!story) {
      return res.status(404).json({ msg: 'Story not found' });
    }

    res.json(story);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark story as viewed
router.post('/:storyId/view', auth, async (req, res) => {
  try {
    const story = await Story.findById(req.params.storyId);
    if (!story) {
      return res.status(404).json({ msg: 'Story not found' });
    }

    // Check if user is the author (author views shouldn't be counted)
    if (story.author.toString() !== req.userId) {
      // Check if user already viewed
      const alreadyViewed = story.viewers.some(viewer =>
        viewer.user && viewer.user.toString() === req.userId
      );

      if (!alreadyViewed) {
        story.viewers.push({
          user: req.userId,
          viewedAt: new Date(),
        });
        await story.save();
      }
    }

    await story.populate('author', 'username avatar profilePhoto');
    await story.populate('viewers.user', 'username avatar profilePhoto');
    await story.populate('tags', 'username');
    await story.populate({ path: 'reactions.user', select: 'username avatar profilePhoto', strictPopulate: false });

    // Emit socket event for real-time updates
    if (req.io) {
      req.io.emit('story:updated', story);
    }

    res.json(story);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Vote on story poll
router.post('/:storyId/vote-poll', auth, async (req, res) => {
  try {
    const { optionIndex } = req.body;

    if (optionIndex === undefined || optionIndex < 0) {
      return res.status(400).json({ msg: 'Valid option index required' });
    }

    const story = await Story.findById(req.params.storyId);
    if (!story) {
      return res.status(404).json({ msg: 'Story not found' });
    }

    if (!story.pollOptions || story.pollOptions.length === 0) {
      return res.status(400).json({ msg: 'No poll options available' });
    }

    if (optionIndex >= story.pollOptions.length) {
      return res.status(400).json({ msg: 'Invalid option index' });
    }

    const userId = req.userId;

    // Remove user from all options first (in case they already voted)
    story.pollOptions.forEach(option => {
      option.votes = option.votes.filter(id => id.toString() !== userId);
    });

    // Add vote to selected option
    story.pollOptions[optionIndex].votes.push(userId);

    await story.save();

    // Populate and return updated story
    await story.populate('author', 'username avatar profilePhoto');
    await story.populate('viewers.user', 'username avatar profilePhoto');
    await story.populate('tags', 'username');
    if (story.reactions && story.reactions.length > 0) {
      await story.populate({ path: 'reactions.user', select: 'username avatar profilePhoto', strictPopulate: false });
    }

    res.json(story);
  } catch (error) {
    console.error('Error voting on story poll:', error);
    res.status(500).json({ error: error.message });
  }
});

// React to a story
router.post('/:storyId/react', auth, async (req, res) => {
  try {
    const { reactionType } = req.body;
    if (!reactionType) {
      return res.status(400).json({ msg: 'Reaction type is required' });
    }

    const story = await Story.findById(req.params.storyId);
    if (!story) {
      return res.status(404).json({ msg: 'Story not found' });
    }

    // Initialize reactions array if it doesn't exist
    if (!story.reactions) {
      story.reactions = [];
    }

    const userId = req.userId;
    
    // Remove any existing reaction from this user
    story.reactions = story.reactions.filter(r => r.user && r.user.toString() !== userId);

    // Add new reaction if not removing
    if (reactionType !== 'remove') {
      story.reactions.push({
        user: userId,
        type: reactionType,
        createdAt: new Date()
      });
    }

    // Create notification if not reacting to own story
    if (story.author && story.author.toString() !== userId) {
      const Notification = require('../models/Notification');
      
      const REACTION_EMOJIS = {
        like: '👍',
        heart: '❤️',
        laugh: '😂',
        wow: '😮',
        sad: '😢',
        fire: '🔥'
      };
      const emoji = REACTION_EMOJIS[reactionType] || '';

      await Notification.create({
        recipient: story.author,
        sender: userId,
        type: 'like',
        message: `reacted to your story ${emoji}`,
        relatedStory: story._id,
      });
      pushService.sendReactionNotification(story.author, null, reactionType, 'story', userId, null, story._id).catch(() => {});
    }

    await story.save();

    // Populate before returning
    await story.populate('author', 'username avatar profilePhoto');
    await story.populate('viewers.user', 'username avatar profilePhoto');
    await story.populate('tags', 'username');
    await story.populate({ path: 'reactions.user', select: 'username avatar profilePhoto', strictPopulate: false });

    // Emit socket event for real-time updates
    if (req.io) {
      req.io.emit('story:updated', story);
      
      const reactionEntry = story.reactions.find(r => {
          const rUserId = r.user && (r.user._id || r.user);
          return rUserId && rUserId.toString() === userId;
      });
      if (reactionEntry && reactionEntry.user) {
        req.io.emit('story:reaction', {
          storyId: story._id,
          reactionType,
          user: reactionEntry.user
        });
      }
    }

    res.json(story);
  } catch (error) {
    console.error('Error reacting to story:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete story
router.delete('/:storyId', auth, async (req, res) => {
  try {
    const story = await Story.findById(req.params.storyId);
    if (!story) {
      return res.status(404).json({ msg: 'Story not found' });
    }

    // Check authorization
    if (story.author.toString() !== req.userId) {
      return res.status(403).json({ msg: 'Not authorized to delete this story' });
    }

    await Story.findByIdAndDelete(req.params.storyId);

    // Delete related notifications (likes, reactions, tags on the deleted story)
    const Notification = require('../models/Notification');
    await Notification.deleteMany({
      relatedStory: req.params.storyId,
      type: { $in: ['like', 'reaction', 'tag'] }
    });

    res.json({ msg: 'Story deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mute user stories
router.post('/mute/:userId', auth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.userId, {
      $addToSet: { mutedStoryAuthors: req.params.userId }
    }, { strict: false });
    
    res.json({ msg: 'User stories muted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Unmute user stories
router.post('/unmute/:userId', auth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.userId, {
      $pull: { mutedStoryAuthors: req.params.userId }
    });
    res.json({ msg: 'User stories unmuted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get muted users
router.get('/muted/list', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate('mutedStoryAuthors', 'username profilePhoto avatar');
    if (!user) return res.status(404).json({ msg: 'User not found' });
    res.json(user.mutedStoryAuthors || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;