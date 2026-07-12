const express = require('express');
const router = express.Router({ mergeParams: true });
const Community = require('../models/Community');
const CommunityFeed = require('../models/CommunityFeed');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');

// Helper: resolve community and compute membership/admin
async function getCommunityContext(communityId, userId) {
  const community = await Community.findById(communityId);
  if (!community) {
    return { community: null };
  }
  const isAdmin = community.creator && community.creator.toString() === userId;
  const isMember = community.members.some(
    (m) => m.toString() === userId
  );
  return { community, isAdmin, isMember };
}

// Get feed posts for a community
// Access: admin or approved member
router.get('/', auth, async (req, res) => {
  try {
    const { community, isAdmin, isMember } = await getCommunityContext(req.params.communityId, req.userId);
    if (!community) {
      return res.status(404).json({ msg: 'Community not found' });
    }
    if (!isAdmin && !isMember) {
      return res.status(403).json({ msg: 'Only members can view the community feed' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const query = { community: req.params.communityId };

    const feeds = await CommunityFeed.find(query)
      .populate('author', 'username avatar profilePhoto')
      .populate('likes', '_id username avatar profilePhoto')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await CommunityFeed.countDocuments(query);

    res.json({ feeds, hasMore: skip + feeds.length < total, total });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a feed post
// Access: admin or approved member
router.post('/', auth, async (req, res) => {
  try {
    const { community, isAdmin, isMember } = await getCommunityContext(req.params.communityId, req.userId);
    if (!community) {
      return res.status(404).json({ msg: 'Community not found' });
    }
    if (!isAdmin && !isMember) {
      return res.status(403).json({ msg: 'Only members can post to the community feed' });
    }

    const { content, images } = req.body;

    if ((!content || content.trim().length === 0) && (!images || images.length === 0)) {
      return res.status(400).json({ msg: 'Content or image(s) are required' });
    }

    if (images && images.length > 10) {
      return res.status(400).json({ msg: 'You can attach a maximum of 10 images.' });
    }

    const feed = new CommunityFeed({
      community: req.params.communityId,
      author: req.userId,
      content: content && content.trim() ? content.trim() : undefined,
      images: images || [],
      likes: [],
    });

    await feed.save();
    await feed.populate('author', 'username avatar profilePhoto');
    await feed.populate('likes', '_id username avatar profilePhoto');

    res.json(feed);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Toggle like on a feed post
// Access: admin or approved member
router.post('/:feedId/like', auth, async (req, res) => {
  try {
    const { community, isAdmin, isMember } = await getCommunityContext(req.params.communityId, req.userId);
    if (!community) {
      return res.status(404).json({ msg: 'Community not found' });
    }
    if (!isAdmin && !isMember) {
      return res.status(403).json({ msg: 'Only members can interact with the community feed' });
    }

    const feed = await CommunityFeed.findById(req.params.feedId);
    if (!feed) {
      return res.status(404).json({ msg: 'Feed post not found' });
    }

    const likeIndex = feed.likes.findIndex((id) => id.toString() === req.userId);
    if (likeIndex === -1) {
      feed.likes.push(new mongoose.Types.ObjectId(req.userId));
    } else {
      feed.likes.splice(likeIndex, 1);
    }

    await feed.save();
    await feed.populate('author', 'username avatar profilePhoto');
    await feed.populate('likes', '_id username avatar profilePhoto');

    res.json({ feed, liked: likeIndex === -1, likesCount: feed.likes.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a feed post
// Access: the author (member) or the community admin
router.delete('/:feedId', auth, async (req, res) => {
  try {
    const community = await Community.findById(req.params.communityId);
    if (!community) {
      return res.status(404).json({ msg: 'Community not found' });
    }

    const isAdmin = community.creator && community.creator.toString() === req.userId;

    const feed = await CommunityFeed.findById(req.params.feedId);
    if (!feed) {
      return res.status(404).json({ msg: 'Feed post not found' });
    }

    const isAuthor = feed.author.toString() === req.userId;

    // Members can delete their own feed; admin can delete any feed
    if (!isAuthor && !isAdmin) {
      return res.status(403).json({ msg: 'Not authorized to delete this feed post' });
    }

    await CommunityFeed.findByIdAndDelete(req.params.feedId);

    res.json({ msg: 'Feed post deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
