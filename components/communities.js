const express = require('express');
const router = express.Router();
const Community = require('../models/Community');
const auth = require('../middleware/auth');
const fs = require('fs');
const path = require('path');

// Create a community
router.post('/', auth, async (req, res) => {
  try {
    const { name, description, image, requiresApproval } = req.body;

    const existing = await Community.findOne({ name });
    if (existing) {
      return res.status(400).json({ msg: 'Community name already taken' });
    }

    const community = new Community({
      name,
      description,
      image,
      requiresApproval: requiresApproval !== undefined ? requiresApproval : true,
      creator: req.userId,
      members: [req.userId]
    });

    await community.save();
    res.json(community);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get all communities (Discovery)
router.get('/', auth, async (req, res) => {
  try {
    const communities = await Community.find()
      .populate('creator', 'username profilePhoto')
      .sort({ members: -1 }); // Sort by popularity
    res.json(communities);
  } catch (error) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// Join a community
router.post('/:id/join', auth, async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    if (!community) return res.status(404).json({ msg: 'Community not found' });

    if (community.members.includes(req.userId)) {
      return res.status(400).json({ msg: 'Already a member' });
    }

    if (community.requiresApproval) {
      if (!community.pendingMembers.includes(req.userId)) {
        community.pendingMembers.push(req.userId);
        await community.save();
      }
      return res.json({ status: 'pending', msg: 'Request sent' });
    } else {
      community.members.push(req.userId);
      await community.save();
      return res.json({ status: 'joined', msg: 'Joined successfully' });
    }
  } catch (error) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// Approve member (Creator only)
router.post('/:id/approve/:userId', auth, async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    if (!community) return res.status(404).json({ msg: 'Community not found' });

    if (community.creator.toString() !== req.userId) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    const targetId = req.params.userId;
    community.pendingMembers = community.pendingMembers.filter(id => id.toString() !== targetId);
    if (!community.members.includes(targetId)) {
      community.members.push(targetId);
    }

    await community.save();
    res.json(community);
  } catch (error) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// Upload Image
router.post('/upload-image-base64', auth, async (req, res) => {
  try {
    const { imageData, filename } = req.body;
    const uploadDir = 'uploads/communities/';
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    
    const fileName = Date.now() + '-' + filename;
    fs.writeFileSync(path.join(uploadDir, fileName), Buffer.from(imageData.replace(/^data:image\/\w+;base64,/, ''), 'base64'));
    res.json({ imageUrl: `/uploads/communities/${fileName}` });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

module.exports = router;