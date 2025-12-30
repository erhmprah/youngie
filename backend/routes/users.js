const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');
const multer = require('multer');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/profile-photos/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

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

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user profile
router.put('/:userId', auth, async (req, res) => {
  try {
    const { bio, interests, avatar, location, username } = req.body;

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
    ];

    const users = await User.find({
      _id: {
        $ne: currentUser._id,
        $nin: excludedUsers,
      },
      age: { $gte: 13, $lte: 18 },
    })
      .select('-password -email')
      .limit(20);

    res.json(users);
  } catch (error) {
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

    res.json({ msg: 'Friend request ignored' });
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
