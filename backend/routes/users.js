const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');
const multer = require('multer');
const { uploadFile, supabase: supabaseStorage } = require('../utils/supabaseStorage');

const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/profile-photos/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

// Get muted users list
router.get('/muted', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Get muted users details
    const mutedUsers = await User.find({
      _id: { $in: user.mutedUsers || [] }
    }).select('username profilePhoto avatar');

    res.json(mutedUsers);
  } catch (error) {
    console.error('Error fetching muted users:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get blocked users list
router.get('/blocked', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const blockedUsers = await User.find({
      _id: { $in: user.blockedUsers || [] }
    }).select('username profilePhoto avatar');

    res.json(blockedUsers);
  } catch (error) {
    console.error('Error fetching blocked users:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mute user
router.post('/mute/:userId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const targetUserId = req.params.userId;

    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ msg: 'Target user not found' });
    }

    // Check if already muted
    if (user.mutedUsers.includes(targetUserId)) {
      return res.status(400).json({ msg: 'User already muted' });
    }

    // Add to muted users list
    user.mutedUsers.push(targetUserId);
    await user.save();

    res.json({ msg: 'User muted successfully' });
  } catch (error) {
    console.error('Error muting user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Unmute user
router.post('/unmute/:userId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const targetUserId = req.params.userId;

    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Remove from muted users list
    user.mutedUsers = user.mutedUsers.filter(id => id.toString() !== targetUserId);
    await user.save();

    res.json({ msg: 'User unmuted successfully' });
  } catch (error) {
    console.error('Error unmuting user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get login activity
router.get('/login-activity', auth, async (req, res) => {
  try {
    console.log('Fetching login activity for user:', req.userId);
    const user = await User.findById(req.userId).select('loginActivity');
    if (!user) {
      console.log('User not found');
      return res.status(404).json({ msg: 'User not found' });
    }

    console.log('User loginActivity:', user.loginActivity);

    // Ensure loginActivity is an array (handle migration for existing users)
    const loginActivity = (user.loginActivity || [])
      .sort((a, b) => new Date(b.loginTime) - new Date(a.loginTime))
      .slice(0, 10)
      .map((session, index) => ({
        _id: session._id || `session_${Date.now()}_${index}`,
        device: session.device || 'Unknown Device',
        location: session.location || 'Unknown Location',
        ipAddress: session.ipAddress || 'Unknown IP',
        loginTime: session.loginTime,
        isCurrentSession: session.isActive,
      }));

    console.log('Returning login activity:', loginActivity.length, 'sessions');
    res.json(loginActivity);
  } catch (error) {
    console.error('Error fetching login activity:', error);
    res.status(500).json({ error: error.message });
  }
});

// Clear login activity
router.delete('/login-activity', auth, async (req, res) => {
  try {
    console.log('Clearing login activity for user:', req.userId);
    const user = await User.findById(req.userId);
    if (!user) {
      console.log('User not found');
      return res.status(404).json({ msg: 'User not found' });
    }

    user.loginActivity = [];
    user.markModified('loginActivity');
    await user.save();

    console.log('Login activity cleared');
    res.json({ msg: 'Login activity cleared successfully' });
  } catch (error) {
    console.error('Error clearing login activity:', error);
    res.status(500).json({ error: error.message });
  }
});

// Remove specific login session
router.delete('/login-activity/:sessionId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    user.loginActivity = user.loginActivity.filter(
      session => session._id.toString() !== req.params.sessionId
    );

    user.markModified('loginActivity');
    await user.save();

    res.json({ msg: 'Session removed successfully' });
  } catch (error) {
    console.error('Error removing session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Logout from all other devices
router.post('/login-activity/logout-others', auth, async (req, res) => {
  try {
    const { currentSessionId } = req.body;
    if (!currentSessionId) {
      return res.status(400).json({ msg: 'Current session ID is required' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Deactivate all sessions except the current one
    user.loginActivity.forEach(session => {
      if (session._id.toString() !== currentSessionId) {
        session.isActive = false;
      }
    });

    user.markModified('loginActivity');
    await user.save();

    res.json({ msg: 'Logged out from all other devices' });
  } catch (error) {
    console.error('Error logging out other devices:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user profile
router.get('/:userId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select('-password')
      .populate('friends', 'username avatar profilePhoto age')
      .populate('matches', 'username avatar profilePhoto age')
      .populate('followers', 'username avatar profilePhoto')
      .populate('following', 'username avatar profilePhoto');

    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Check privacy settings
    const isSelf = req.userId === user._id.toString();
    const isFriend = user.friends.some(f => f._id.toString() === req.userId);
    const isFollower = user.followers.some(f => f._id.toString() === req.userId);

    if (user.isPrivate && !isSelf && !isFriend && !isFollower) {
      return res.json({
        _id: user._id,
        username: user.username,
        profilePhoto: user.profilePhoto,
        bio: user.bio,
        isPrivate: true,
        friends: [],
        matches: [],
        followers: [],
        following: [],
        interests: [],
        location: null
      });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user profile
router.put('/:userId', auth, async (req, res) => {
  try {
    const { bio, interests, avatar, location, username, isPrivate } = req.body;

    let user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Authorization check
    if (user._id.toString() !== req.userId && req.userId) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    if (bio !== undefined) user.bio = bio;
    if (interests !== undefined) user.interests = interests;
    if (avatar !== undefined) user.avatar = avatar;
    if (location !== undefined) user.location = location;
    if (username !== undefined) user.username = username;
    if (isPrivate !== undefined) user.isPrivate = isPrivate;
    if (coverPhoto !== undefined) user.coverPhoto = coverPhoto;

    await user.save();
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload profile photo
router.post('/:userId/upload-profile-photo', auth, upload.single('profilePhoto'), async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Authorization check
    if (user._id.toString() !== req.userId) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    if (!req.file) {
      return res.status(400).json({ msg: 'No file uploaded' });
    }

    // If Supabase is configured, upload to Supabase
    if (supabaseStorage) {
      const fs = require('fs');
      const buffer = fs.readFileSync(req.file.path);
      const imageUrl = await uploadFile(buffer, req.file.originalname, req.file.mimetype, 'profiles');
      
      // Clean up local file
      fs.unlinkSync(req.file.path);
      
      user.profilePhoto = imageUrl;
      await user.save();
      
      return res.json({ msg: 'Profile photo uploaded successfully', profilePhoto: user.profilePhoto });
    }

    user.profilePhoto = `/uploads/profile-photos/${req.file.filename}`;
    await user.save();

    res.json({ msg: 'Profile photo uploaded successfully', profilePhoto: user.profilePhoto });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload profile photo (base64)
router.post('/:userId/upload-profile-photo-base64', auth, async (req, res) => {
  try {
    const { imageData, filename } = req.body;
    if (!imageData || !filename) {
      return res.status(400).json({ msg: 'Image data and filename required' });
    }

    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Authorization check
    if (user._id.toString() !== req.userId) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    // If Supabase is configured, upload to Supabase
    if (supabaseStorage) {
      try {
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const mimeType = imageData.match(/^data:image\/(\w+);base64,/)?.[1] || 'jpeg';
        const imageUrl = await uploadFile(buffer, filename, mimeType, 'profiles');
        
        user.profilePhoto = imageUrl;
        await user.save();
        
        console.log('✅ Profile photo uploaded (Supabase):', user.profilePhoto);
        return res.json({ msg: 'Profile photo uploaded successfully', profilePhoto: user.profilePhoto });
      } catch (supabaseError) {
        console.error('❌ Supabase profile photo upload failed:', supabaseError.message);
      }
    }

    // Create uploads directory if it doesn't exist
    const uploadDir = 'uploads/profile-photos/';
    if (!require('fs').existsSync(uploadDir)) {
      require('fs').mkdirSync(uploadDir, { recursive: true });
    }

    // Save base64 image as file
    const timestamp = Date.now();
    const filenameSafe = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filepath = `${uploadDir}${timestamp}-${filenameSafe}`;
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    require('fs').writeFileSync(filepath, buffer);

    user.profilePhoto = `/uploads/profile-photos/${timestamp}-${filenameSafe}`;
    await user.save();

    console.log('✅ Profile photo uploaded (base64):', user.profilePhoto);
    res.json({ msg: 'Profile photo uploaded successfully', profilePhoto: user.profilePhoto });
  } catch (error) {
    console.error('❌ Profile photo upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload cover photo
router.post('/:userId/upload-cover-photo', auth, upload.single('coverPhoto'), async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Authorization check
    if (user._id.toString() !== req.userId) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    if (!req.file) {
      return res.status(400).json({ msg: 'No file uploaded' });
    }

    // If Supabase is configured, upload to Supabase
    if (supabaseStorage) {
      const fs = require('fs');
      const buffer = fs.readFileSync(req.file.path);
      const imageUrl = await uploadFile(buffer, req.file.originalname, req.file.mimetype, 'covers');
      
      // Clean up local file
      fs.unlinkSync(req.file.path);
      
      user.coverPhoto = imageUrl;
      await user.save();
      
      return res.json({ msg: 'Cover photo uploaded successfully', coverPhoto: user.coverPhoto });
    }

    user.coverPhoto = `/uploads/cover-photos/${req.file.filename}`;
    await user.save();

    res.json({ msg: 'Cover photo uploaded successfully', coverPhoto: user.coverPhoto });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload cover photo (base64)
router.post('/:userId/upload-cover-photo-base64', auth, async (req, res) => {
  try {
    const { imageData, filename } = req.body;
    if (!imageData || !filename) {
      return res.status(400).json({ msg: 'Image data and filename required' });
    }

    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Authorization check
    if (user._id.toString() !== req.userId) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    // If Supabase is configured, upload to Supabase
    if (supabaseStorage) {
      try {
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const mimeType = imageData.match(/^data:image\/(\w+);base64,/)?.[1] || 'jpeg';
        const imageUrl = await uploadFile(buffer, filename, mimeType, 'covers');
        
        user.coverPhoto = imageUrl;
        await user.save();
        
        console.log('✅ Cover photo uploaded (Supabase):', user.coverPhoto);
        return res.json({ msg: 'Cover photo uploaded successfully', coverPhoto: user.coverPhoto });
      } catch (supabaseError) {
        console.error('❌ Supabase cover photo upload failed:', supabaseError.message);
      }
    }

    // Create uploads directory if it doesn't exist
    const uploadDir = 'uploads/cover-photos/';
    if (!require('fs').existsSync(uploadDir)) {
      require('fs').mkdirSync(uploadDir, { recursive: true });
    }

    // Save base64 image as file
    const timestamp = Date.now();
    const filenameSafe = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filepath = `${uploadDir}${timestamp}-${filenameSafe}`;
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    require('fs').writeFileSync(filepath, buffer);

    user.coverPhoto = `/uploads/cover-photos/${timestamp}-${filenameSafe}`;
    await user.save();

    console.log('✅ Cover photo uploaded (base64):', user.coverPhoto);
    res.json({ msg: 'Cover photo uploaded successfully', coverPhoto: user.coverPhoto });
  } catch (error) {
    console.error('❌ Cover photo upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to escape regex special characters
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Search users
router.get('/search/query', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ msg: 'Search query required' });
    }

    const escapedQuery = escapeRegex(q);

    // Build search conditions
    const searchConditions = [
      { username: { $regex: escapedQuery, $options: 'i' } },
      // { bio: { $regex: escapedQuery, $options: 'i' } }, // Keep commented if not intended for now
    ];

    // Search interests array for matching elements
    searchConditions.push({
      interests: { $elemMatch: { $regex: escapedQuery, $options: 'i' } }
    });

    const users = await User.find({ $or: searchConditions }).limit(10);

    res.json(users);
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get nearby users (for swipe feature)
router.get('/nearby/all', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId);
    if (!currentUser) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const excludedUsers = [
      ...currentUser.friends,
      ...currentUser.ignoredUsers,
      ...currentUser.friendRequests,
      ...currentUser.incomingRequests,
      ...currentUser.blockedUsers,
    ];

    const currentYear = new Date().getFullYear();
    const { minAge, maxAge, gender, location, latitude, longitude, radius, page = 0, limit = 20 } = req.query;

    // Calculate birth year range based on age
    // Default: 13-29 years old
    // Age 13 => Born in (Current - 13)
    // Age 29 => Born in (Current - 29)
    // So for age range [min, max], birthYear range is [Current-max, Current-min]

    let minBirthYear = currentYear - 29;
    let maxBirthYear = currentYear - 13;

    if (minAge) {
      maxBirthYear = currentYear - parseInt(minAge);
    }
    if (maxAge) {
      minBirthYear = currentYear - parseInt(maxAge);
    }

    // Build query with filters
    let query = {
      _id: {
        $ne: currentUser._id,
        $nin: excludedUsers,
      },
      birthYear: { $gte: minBirthYear, $lte: maxBirthYear },
    };

    if (gender && Array.isArray(gender)) {
      query.gender = { $in: gender };
    } else if (gender) {
      query.gender = gender;
    }
    if (location) {
      query.location = { $regex: location, $options: 'i' };
    }

    // First, get total count for hasMore calculation
    const totalCount = await User.countDocuments(query);

    // Apply pagination
    const skip = parseInt(page) * parseInt(limit);
    const users = await User.find(query)
      .select('-password -email')
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Filter by radius if provided
    let filteredUsers = users;
    if (latitude && longitude && radius) {
      const lat = parseFloat(latitude);
      const lon = parseFloat(longitude);
      const rad = parseFloat(radius);
      filteredUsers = users.filter(user => {
        if (!user.latitude || !user.longitude) return false;
        const distance = getDistanceFromLatLonInKm(lat, lon, user.latitude, user.longitude);
        return distance <= rad;
      });
    }

    // Add age property to users
    const usersWithAge = filteredUsers.map(user => ({
      ...user,
      age: currentYear - user.birthYear
    }));

    const hasMore = (skip + parseInt(limit)) < totalCount;

    res.json({
      users: usersWithAge,
      hasMore,
      totalCount
    });
  } catch (error) {
    console.error('Error fetching nearby users:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add friend
router.post('/:userId/friends/:friendId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    const friend = await User.findById(req.params.friendId);

    if (!user || !friend) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Check if already friends
    if (user.friends.includes(friend._id)) {
      return res.status(400).json({ msg: 'Already friends' });
    }

    user.friends.push(friend._id);
    friend.friends.push(user._id);
    user.following.push(friend._id);
    friend.followers.push(user._id);

    // Create notification for the friend
    await Notification.create({
      recipient: friend._id,
      sender: user._id,
      type: 'follow',
      message: 'started following you',
    });

    await user.save();
    await friend.save();

    res.json({ msg: 'Friend added successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove friend
router.delete('/:userId/friends/:friendId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    const friend = await User.findById(req.params.friendId);

    if (!user || !friend) {
      return res.status(404).json({ msg: 'User not found' });
    }

    user.friends = user.friends.filter(id => id.toString() !== friend._id.toString());
    friend.friends = friend.friends.filter(id => id.toString() !== user._id.toString());
    user.following = user.following.filter(id => id.toString() !== friend._id.toString());
    friend.followers = friend.followers.filter(id => id.toString() !== user._id.toString());

    await user.save();
    await friend.save();

    res.json({ msg: 'Friend removed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add match
router.post('/:userId/matches/:matchId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    const match = await User.findById(req.params.matchId);

    if (!user || !match) {
      return res.status(404).json({ msg: 'User not found' });
    }

    if (!user.matches.includes(match._id)) {
      user.matches.push(match._id);
      match.matches.push(user._id);

      // Create notification for the match
      await Notification.create({
        recipient: match._id,
        sender: user._id,
        type: 'match',
        message: 'matched with you!',
      });

      await user.save();
      await match.save();
    }

    res.json({ msg: 'Match added successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send friend request (for swipe right)
router.post('/:userId/friend-request/:targetUserId', auth, async (req, res) => {
  try {
    const sender = await User.findById(req.userId);
    const target = await User.findById(req.params.targetUserId);

    if (!sender || !target) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Check if already friends or has pending request
    if (sender.friends.includes(target._id) ||
        sender.friendRequests.includes(target._id) ||
        target.incomingRequests.includes(sender._id)) {
      return res.status(400).json({ msg: 'Friend request already exists or users are friends' });
    }

    // Add to sender's friend requests
    sender.friendRequests.push(target._id);
    // Add to target's incoming requests
    target.incomingRequests.push(sender._id);

    await sender.save();
    await target.save();

    // Notification for friend request
    await Notification.create({
      recipient: target._id,
      sender: sender._id,
      type: 'follow',
      message: 'sent you a friend request',
    });

    res.json({ msg: 'Friend request sent' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Accept friend request
router.post('/:userId/accept-request/:senderId', auth, async (req, res) => {
  try {
    const accepter = await User.findById(req.userId);
    const sender = await User.findById(req.params.senderId);

    if (!accepter || !sender) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Check if request exists
    if (!accepter.incomingRequests.includes(sender._id) ||
        !sender.friendRequests.includes(accepter._id)) {
      return res.status(400).json({ msg: 'No friend request found' });
    }

    // Add to friends
    accepter.friends.push(sender._id);
    sender.friends.push(accepter._id);

    // Add following/followers
    accepter.following.push(sender._id);
    sender.followers.push(accepter._id);

    // Remove from requests
    accepter.incomingRequests = accepter.incomingRequests.filter(id => !id.equals(sender._id));
    sender.friendRequests = sender.friendRequests.filter(id => !id.equals(accepter._id));

    await accepter.save();
    await sender.save();

    // Notification for acceptance
    await Notification.create({
      recipient: sender._id,
      sender: accepter._id,
      type: 'follow',
      message: 'accepted your friend request! You are now friends.',
    });

    res.json({ msg: 'Friend request accepted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ignore friend request
router.post('/:userId/ignore-request/:senderId', auth, async (req, res) => {
  try {
    const ignorer = await User.findById(req.userId);
    const sender = await User.findById(req.params.senderId);

    if (!ignorer || !sender) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Check if request exists
    if (!ignorer.incomingRequests.includes(sender._id)) {
      return res.status(400).json({ msg: 'No friend request found' });
    }

    // Add to ignored
    ignorer.ignoredUsers.push(sender._id);

    // Remove from requests
    ignorer.incomingRequests = ignorer.incomingRequests.filter(id => !id.equals(sender._id));
    sender.friendRequests = sender.friendRequests.filter(id => !id.equals(ignorer._id));

    await ignorer.save();
    await sender.save();

    // Delete the notification for the ignored friend request
    await Notification.deleteMany({
      recipient: ignorer._id,
      sender: sender._id,
      type: 'follow',
      message: 'sent you a friend request'
    });

    res.json({ msg: 'Friend request ignored' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cancel friend request
router.post('/:userId/cancel-request/:targetUserId', auth, async (req, res) => {
  try {
    const sender = await User.findById(req.userId);
    const target = await User.findById(req.params.targetUserId);

    if (!sender || !target) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Check if request exists
    if (!sender.friendRequests.includes(target._id)) {
      return res.status(400).json({ msg: 'No friend request found' });
    }

    // Remove from sender's friend requests
    sender.friendRequests = sender.friendRequests.filter(id => !id.equals(target._id));
    // Remove from target's incoming requests
    target.incomingRequests = target.incomingRequests.filter(id => !id.equals(sender._id));

    await sender.save();
    await target.save();

    // Delete the notification for the friend request
    await Notification.deleteMany({
      recipient: target._id,
      sender: sender._id,
      type: 'follow',
      message: 'sent you a friend request'
    });

    res.json({ msg: 'Friend request cancelled' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Block user
router.post('/:userId/block/:targetUserId', auth, async (req, res) => {
  try {
    const blocker = await User.findById(req.userId);
    const target = await User.findById(req.params.targetUserId);

    if (!blocker || !target) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Check if already blocked
    if (blocker.blockedUsers.includes(target._id)) {
      return res.status(400).json({ msg: 'User already blocked' });
    }

    // Add to blocked
    blocker.blockedUsers.push(target._id);

    // Remove from friends if they are friends
    blocker.friends = blocker.friends.filter(id => id.toString() !== target._id.toString());
    target.friends = target.friends.filter(id => id.toString() !== blocker._id.toString());

    // Remove from following/followers
    blocker.following = blocker.following.filter(id => id.toString() !== target._id.toString());
    target.followers = target.followers.filter(id => id.toString() !== blocker._id.toString());

    await blocker.save();
    await target.save();

    res.json({ msg: 'User blocked' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Unblock user
router.post('/:userId/unblock/:targetUserId', auth, async (req, res) => {
  try {
    const unblocker = await User.findById(req.userId);
    const target = await User.findById(req.params.targetUserId);

    if (!unblocker || !target) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Check if blocked
    if (!unblocker.blockedUsers.includes(target._id)) {
      return res.status(400).json({ msg: 'User not blocked' });
    }

    // Remove from blocked
    unblocker.blockedUsers = unblocker.blockedUsers.filter(id => id.toString() !== target._id.toString());

    await unblocker.save();

    res.json({ msg: 'User unblocked' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get friends list
router.get('/friends/list', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .populate('friends', 'username avatar profilePhoto age bio location');

    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    res.json(user.friends);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get incoming friend requests
router.get('/friend-requests/incoming', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .populate('incomingRequests', 'username avatar profilePhoto age bio location');

    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    res.json(user.incomingRequests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get sent friend requests
router.get('/friend-requests/sent', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .populate('friendRequests', 'username avatar profilePhoto age bio location');

    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    res.json(user.friendRequests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user stats
router.get('/:userId/stats', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    res.json({
      userId: user._id,
      username: user.username,
      posts: user.posts.length,
      friends: user.friends.length,
      matches: user.matches.length,
      followers: user.followers.length,
      following: user.following.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
