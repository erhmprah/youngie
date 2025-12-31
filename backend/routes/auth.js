const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');

// Register
router.post('/register', [
  body('username').isLength({ min: 3 }).trim().escape(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('age').isInt({ min: 13, max: 18 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, age } = req.body;

    // Check if user exists
    let user = await User.findOne({ $or: [{ email }, { username }] });
    if (user) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    // Create new user
    user = new User({
      username,
      email,
      password,
      age,
      interests: [],
      friends: [],
      matches: [],
      followers: [],
      following: [],
    });

    await user.save();

    // Create JWT token
    const payload = { userId: user._id };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        age: user.age,
        bio: user.bio,
        location: user.location,
        interests: user.interests,
        avatar: user.avatar,
        friends: user.friends,
        followers: user.followers,
        following: user.following,
        posts: user.posts,
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
    console.log('Login attempt for email:', req.body.email);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    console.log('Entered email:', email);
    console.log('Entered password length:', password.length);

    // Find user
    const user = await User.findOne({ email }).select('+password');
    console.log('User found:', !!user);
    if (!user) {
      console.log('No user found with email:', email);
      return res.status(400).json({ msg: 'Invalid credentials' });
    }
    console.log('User email in DB:', user.email);
    console.log('User password hash exists:', !!user.password);

    // Check password
    const isMatch = await user.comparePassword(password);
    console.log('Password match:', isMatch);
    if (!isMatch) {
      console.log('Password does not match for user:', email);
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    // Update last seen
    user.lastSeen = new Date();
    await user.save();

    // Create JWT token
    const payload = { userId: user._id };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        age: user.age,
        bio: user.bio,
        location: user.location,
        interests: user.interests,
        avatar: user.avatar,
        friends: user.friends,
        followers: user.followers,
        following: user.following,
        posts: user.posts,
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
