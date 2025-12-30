const express = require('express');
const router = express.Router();
const Story = require('../models/Story');
const User = require('../models/User');
const auth = require('../middleware/auth');
const multer = require('multer');

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

const upload = multer({ storage, fileFilter });

// Get stories for feed (from users you follow + your own)
router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate('friends', '_id');
    const followingIds = user.friends.map(friend => friend._id);
    followingIds.push(req.userId); // Include own stories

    const stories = await Story.find({
      author: { $in: followingIds },
      expiresAt: { $gt: new Date() }, // Not expired
    })
      .populate('author', 'username avatar profilePhoto')
      .populate('viewers.user', 'username')
      .sort({ createdAt: -1 })
      .limit(50);

    // Group stories by author
    const groupedStories = stories.reduce((acc, story) => {
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
      allViewed: group.stories.every(story => story.viewers.some(viewer => viewer.user.toString() === req.userId)),
    }));

    res.json(result);
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
      .populate('viewers.user', 'username')
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
    const { content, image, video } = req.body;

    if (!content && !image && !video) {
      return res.status(400).json({ msg: 'Story must have content, image, or video' });
    }

    const story = new Story({
      author: req.userId,
      content,
      image,
      video,
    });

    await story.save();
    await story.populate('author', 'username avatar profilePhoto');

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
      .populate('viewers.user', 'username');

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

    // Check if user already viewed
    const alreadyViewed = story.viewers.some(viewer =>
      viewer.user.toString() === req.userId
    );

    if (!alreadyViewed) {
      story.viewers.push({
        user: req.userId,
        viewedAt: new Date(),
      });
      await story.save();
    }

    res.json(story);
  } catch (error) {
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
    res.json({ msg: 'Story deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;