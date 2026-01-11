const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Notification = require('../models/Notification');

// Register
router.post('/register', [
  body('username').isLength({ min: 3 }).trim().escape(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('birthYear').isInt({ min: 1997, max: new Date().getFullYear() }),
  body('gender').isIn(['male', 'female', 'other']),
  body('location').optional().isString().trim().escape(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, birthYear, gender, location } = req.body;

    let user = await User.findOne({ $or: [{ email }, { username }] });
    if (user) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    user = new User({
      username,
      email,
      password,
      birthYear,
      gender,
      location: location || undefined,
    });

    await user.save();

    // Auto-login after registration
    const payload = { userId: user._id };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      msg: 'Registration successful. You are now logged in.',
      token,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        birthYear: user.birthYear,
        gender: user.gender,
        bio: user.bio,
        location: user.location,
        interests: user.interests,
        avatar: user.avatar,
        friends: user.friends,
        followers: user.followers,
        following: user.following,
        posts: user.posts,
        suspended: user.suspended,
      },
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').exists(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }
    
    // Check age and suspend if >28
    const currentYear = new Date().getFullYear();
    const age = currentYear - user.birthYear;
    if (age > 28 && !user.suspended) {
      user.suspended = true;
      await user.save();
      // Create suspension notification
      const notification = new Notification({
        recipient: user._id,
        sender: user._id, // Self-notification
        type: 'suspension',
        message: 'Your account has been suspended because you are over 28 years old.',
      });
      await notification.save();
    }

    // Update last seen
    user.lastSeen = new Date();
    await user.save();

    const payload = { userId: user._id };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        birthYear: user.birthYear,
        gender: user.gender,
        bio: user.bio,
        location: user.location,
        interests: user.interests,
        avatar: user.avatar,
        friends: user.friends,
        followers: user.followers,
        following: user.following,
        posts: user.posts,
        suspended: user.suspended,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});


// Get current user
router.get('/me', async (req, res) => {
  try {
    const token = req.header('x-auth-token');
    if (!token) {
      return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Check age and suspend if >28
    const currentYear = new Date().getFullYear();
    const age = currentYear - user.birthYear;
    if (age > 28 && !user.suspended) {
      user.suspended = true;
      await user.save();
      // Create suspension notification
      const notification = new Notification({
        recipient: user._id,
        sender: user._id, // Self-notification
        type: 'suspension',
        message: 'Your account has been suspended because you are over 28 years old.',
      });
      await notification.save();
    }

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Check if username exists
router.get('/check-username/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username });
    
    if (user) {
      return res.json({ available: false, msg: 'Username is already taken' });
    }
    
    res.json({ available: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Check if email exists
router.get('/check-email/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const user = await User.findOne({ email });
    
    if (user) {
      return res.json({ available: false, msg: 'Email is already registered' });
    }
    
    res.json({ available: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});


module.exports = router;
