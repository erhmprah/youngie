const express = require('express');
const router = express.Router();
const Community = require('../models/Community');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Upload community image base64
router.post('/upload-image-base64', auth, async (req, res) => {
  try {
    const { imageData, filename } = req.body;
    if (!imageData || !filename) {
      return res.status(400).json({ msg: 'Image data and filename required' });
    }

    // Ensure uploads/communities directory exists
    const fs = require('fs');
    const communitiesDir = 'uploads/communities/';
    if (!fs.existsSync(communitiesDir)) {
      fs.mkdirSync(communitiesDir, { recursive: true });
    }

    // Decode base64 and save as file
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const fileName = Date.now() + '-' + filename;
    const filePath = `${communitiesDir}${fileName}`;
    fs.writeFileSync(filePath, buffer);

    const imageUrl = `/uploads/communities/${fileName}`;
    res.json({ imageUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all communities
router.get('/', auth, async (req, res) => {
  try {
    const communities = await Community.find()
      .populate('creator', 'username avatar profilePhoto')
      .populate('members', 'username avatar profilePhoto')
      .sort({ createdAt: -1 });

    res.json(communities);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a community
router.post('/', auth, async (req, res) => {
  try {
    const { name, description, image, requiresApproval } = req.body;

    if (!name || !description) {
      return res.status(400).json({ msg: 'Name and description are required' });
    }

    const community = new Community({
      name,
      description,
      image,
      creator: req.userId,
      requiresApproval: requiresApproval !== false, // Default to true
      members: [req.userId], // Creator is automatically a member
    });

    await community.save();
    await community.populate('creator', 'username avatar profilePhoto');
    await community.populate('members', 'username avatar profilePhoto');

    res.json(community);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Join a community
router.post('/:communityId/join', auth, async (req, res) => {
  try {
    const community = await Community.findById(req.params.communityId);
    if (!community) {
      return res.status(404).json({ msg: 'Community not found' });
    }

    if (community.members.includes(req.userId)) {
      return res.status(400).json({ msg: 'Already a member' });
    }

    if (community.requiresApproval) {
      // Add to pending members
      if (!community.pendingMembers.includes(req.userId)) {
        community.pendingMembers.push(req.userId);
        await community.save();
        return res.json({ msg: 'Join request sent for approval' });
      }
      return res.status(400).json({ msg: 'Join request already pending' });
    } else {
      // Directly add to members
      community.members.push(req.userId);
      await community.save();
      await community.populate('members', 'username avatar profilePhoto');
      res.json(community);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Approve member
router.post('/:communityId/approve/:userId', auth, async (req, res) => {
  try {
    const community = await Community.findById(req.params.communityId);
    if (!community) {
      return res.status(404).json({ msg: 'Community not found' });
    }

    // Check if user is creator
    if (community.creator.toString() !== req.userId) {
      return res.status(403).json({ msg: 'Only creator can approve members' });
    }

    const userId = req.params.userId;
    const pendingIndex = community.pendingMembers.indexOf(userId);
    if (pendingIndex === -1) {
      return res.status(400).json({ msg: 'User not in pending list' });
    }

    community.pendingMembers.splice(pendingIndex, 1);
    community.members.push(userId);
    await community.save();
    await community.populate('members', 'username avatar profilePhoto');
    await community.populate('pendingMembers', 'username avatar profilePhoto');

    res.json(community);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;