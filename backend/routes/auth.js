const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Notification = require('../models/Notification');

// Register
router.post('/register', [
  body('username').isLength({ min: 3 }).trim().escape(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('birthYear').isInt({ min: new Date().getFullYear() - 29, max: new Date().getFullYear() }),
  body('gender').isIn(['male', 'female', 'other']),
  body('location').optional().isString().trim().escape(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, birthYear, gender, location, deviceName, clientLocation } = req.body;

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

    // Record initial login activity
    const userAgent = req.get('User-Agent') || 'Unknown';
    const ipAddress = req.ip || req.connection.remoteAddress || req.socket?.remoteAddress || 'Unknown';
    
    let device = deviceName || 'Unknown Device';
    if (!deviceName) {
       if (userAgent.includes('Mobile')) device = 'Mobile Device';
       else if (userAgent.includes('Windows')) device = 'Windows Device';
       else if (userAgent.includes('Macintosh')) device = 'Mac Device';
       else device = 'Web Browser';
    }

    user.loginActivity.push({
      device,
      location: clientLocation || location || 'Unknown Location',
      ipAddress,
      userAgent,
      loginTime: new Date(),
      isActive: true
    });

    await user.save();

    // Auto-login after registration
    const payload = { userId: user._id };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
    const currentSession = user.loginActivity[user.loginActivity.length - 1];

    res.status(201).json({
      msg: 'Registration successful. You are now logged in.',
      token,
      sessionId: currentSession._id,
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

    const { email, password, deviceName, clientLocation } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }
    
    // Check age and suspend if >29
    const currentYear = new Date().getFullYear();
    const age = currentYear - user.birthYear;
    if (age > 29 && !user.suspended) {
      user.suspended = true;
      await user.save();
      // Create suspension notification
      const notification = new Notification({
        recipient: user._id,
        sender: user._id, // Self-notification
        type: 'suspension',
        message: 'Your account has been suspended because you are over 29 years old.',
      });
      await notification.save();
    }

    // Update last seen
    user.lastSeen = new Date();

    // Record login activity
    const userAgent = req.get('User-Agent') || 'Unknown';
    const ipAddress = req.ip || req.connection.remoteAddress || req.socket?.remoteAddress || 'Unknown';

    console.log('Login activity - User-Agent:', userAgent);
    console.log('Login activity - IP Address:', ipAddress);

    // Extract device info from User-Agent
    let device = deviceName || 'Unknown Device';
    if (!deviceName) {
      if (userAgent.includes('iPhone')) device = 'iPhone';
      else if (userAgent.includes('iPad')) device = 'iPad';
      else if (userAgent.includes('Android')) device = 'Android Device';
      else if (userAgent.includes('Chrome')) device = 'Chrome on Desktop';
      else if (userAgent.includes('Firefox')) device = 'Firefox on Desktop';
      else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) device = 'Safari on Desktop';
      else if (userAgent.includes('React Native') || userAgent.includes('Expo')) device = 'Mobile App';
      else if (userAgent.includes('Mobile') || userAgent.includes('Android') || userAgent.includes('iPhone')) device = 'Mobile Device';
      else if (userAgent.includes('Windows')) device = 'Windows Device';
      else if (userAgent.includes('Macintosh') || userAgent.includes('Mac OS')) device = 'Mac Device';
      else if (userAgent.includes('Linux')) device = 'Linux Device';
    }

    console.log('Detected device:', device);

    // Get location from IP (using free ipapi.co service)
    let location = clientLocation || 'Unknown Location';
    if (ipAddress && ipAddress !== 'Unknown' && ipAddress !== '::1' && !ipAddress.startsWith('127.')) {
      console.log('Attempting geolocation for IP:', ipAddress);
      try {
        const https = require('https');
        const geoData = await new Promise((resolve, reject) => {
          const url = `https://ipapi.co/${ipAddress}/json/`;
          https.get(url, { timeout: 2000 }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
              try {
                resolve(JSON.parse(data));
              } catch (e) {
                reject(e);
              }
            });
          }).on('error', reject).on('timeout', () => reject(new Error('Timeout')));
        });

        console.log('Geolocation response:', geoData);
        if (geoData && geoData.city && geoData.country_name) {
          location = `${geoData.city}, ${geoData.country_name}`;
        } else if (geoData && geoData.country_name) {
          location = geoData.country_name;
        }
      } catch (error) {
        console.log('Geolocation failed:', error.message);
        location = 'Unknown Location';
      }
    } else {
      console.log('Skipping geolocation - IP is local:', ipAddress);
    }

    console.log('Final location:', location);

    // Ensure loginActivity is initialized as an array
    if (!user.loginActivity) {
      user.loginActivity = [];
    }

    // Mark all previous sessions as inactive
    user.loginActivity.forEach(session => {
      session.isActive = false;
    });

    // Add new login session
    const newSession = {
      device,
      location,
      ipAddress,
      userAgent,
      loginTime: new Date(),
      isActive: true,
    };

    user.loginActivity.push(newSession);

    // Keep only last 20 login sessions
    if (user.loginActivity.length > 20) {
      user.loginActivity = user.loginActivity.slice(-20);
    }

    // Mark the field as modified for Mongoose
    user.markModified('loginActivity');

    await user.save();

    const payload = { userId: user._id };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
    const currentSession = user.loginActivity[user.loginActivity.length - 1];

    res.json({
      token,
      sessionId: currentSession._id,
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

    // Check age and suspend if >29
    const currentYear = new Date().getFullYear();
    const age = currentYear - user.birthYear;
    if (age > 29 && !user.suspended) {
      user.suspended = true;
      await user.save();
      // Create suspension notification
      const notification = new Notification({
        recipient: user._id,
        sender: user._id, // Self-notification
        type: 'suspension',
        message: 'Your account has been suspended because you are over 29 years old.',
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
      return res.json({ available: false, msg: 'Email is already registered', isGoogleUser: !!user.firebaseUid });
    }

    res.json({ available: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Check if email is a Google user
router.get('/google-user/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const user = await User.findOne({ email });

    if (!user) {
      return res.json({ isGoogleUser: false, msg: 'No account found with this email' });
    }

    // Check if user has firebaseUid (Google user)
    if (user.firebaseUid) {
      return res.json({ isGoogleUser: true, msg: 'This account was created with Google' });
    }

    res.json({ isGoogleUser: false, msg: 'This account uses email and password' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Forgot Password - Send reset email
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;
    const user = await User.findOne({ email });

    // Always return success to prevent email enumeration
    // This is a security best practice
    if (!user) {
      return res.json({ msg: 'If an account exists with this email, a password reset link has been sent.' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour from now

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetTokenExpiry;
    await user.save();

    // In production, you would send an email with the reset link
    // For now, we'll return the token in the response (for development only)
    // In production, use a proper email service like SendGrid, Nodemailer, etc.
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (isProduction) {
      // In production, send email with reset link
      // TODO: Implement email sending
      console.log('Password reset token (production):', resetToken);
      console.log('Reset link would be sent to:', email);
    }

    // For development, return the reset token in the response
    res.json({ 
      msg: 'If an account exists with this email, a password reset link has been sent.',
      resetToken: isProduction ? undefined : resetToken // Only return token in development
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Reset Password
router.post('/reset-password', [
  body('token').notEmpty(),
  body('newPassword').isLength({ min: 6 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { token, newPassword } = req.body;

    // Find user with valid reset token that hasn't expired
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ msg: 'Invalid or expired reset token' });
    }

    // Update password
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ msg: 'Password has been reset successfully' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Set Password (for Google users who want to add a password)
router.post('/set-password', [
  body('email').isEmail().normalizeEmail(),
  body('newPassword').isLength({ min: 6 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, newPassword } = req.body;

    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Check if user has a firebaseUid (Google user)
    if (!user.firebaseUid) {
      return res.status(400).json({ msg: 'This account was not created with Google. Please use the forgot password option.' });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({ msg: 'Password has been set successfully' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Complete Profile (for Supabase users - creates MongoDB user after Supabase signup)
router.post('/complete-profile', [
  body('supabaseUserId').notEmpty().trim(),
  body('email').isEmail().normalizeEmail(),
  body('username').isLength({ min: 3 }).trim().escape(),
  body('birthYear').isInt({ min: new Date().getFullYear() - 29, max: new Date().getFullYear() }),
  body('gender').isIn(['male', 'female', 'other']),
  body('location').optional().isString().trim().escape(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { supabaseUserId, email, username, birthYear, gender, location, deviceName, clientLocation } = req.body;

    // Check if user already exists
    let user = await User.findOne({ $or: [{ email }, { username }] });
    if (user) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    // Also check if supabaseUserId is already used
    user = await User.findOne({ supabaseUserId });
    if (user) {
      return res.status(400).json({ msg: 'Supabase user already linked to an account' });
    }

    // Create new user in MongoDB with Supabase user ID
    user = new User({
      username,
      email,
      supabaseUserId, // Store the Supabase user ID
      birthYear,
      gender,
      location: location || 'Nearby',
    });

    // Record initial login activity
    const userAgent = req.get('User-Agent') || 'Unknown';
    const ipAddress = req.ip || req.connection.remoteAddress || req.socket?.remoteAddress || 'Unknown';
    
    let device = deviceName || 'Unknown Device';
    if (!deviceName) {
       if (userAgent.includes('Mobile')) device = 'Mobile Device';
       else if (userAgent.includes('Windows')) device = 'Windows Device';
       else if (userAgent.includes('Macintosh')) device = 'Mac Device';
       else device = 'Web Browser';
    }

    user.loginActivity.push({
      device,
      location: clientLocation || location || 'Unknown Location',
      ipAddress,
      userAgent,
      loginTime: new Date(),
      isActive: true
    });

    await user.save();

    // Generate JWT token for the user
    const payload = { userId: user._id };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
    const currentSession = user.loginActivity[user.loginActivity.length - 1];

    res.status(201).json({
      msg: 'Profile completed successfully',
      token,
      sessionId: currentSession._id,
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


module.exports = router;
