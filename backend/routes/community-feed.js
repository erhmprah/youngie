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
  return { community, communityId: communityId.toString(), isAdmin, isMember };
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
      .populate({
        path: 'comments.author',
        select: 'username avatar profilePhoto',
      })
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

// Update a feed post (content / images)
// Access: the author (member) or the community admin
router.put('/:feedId', auth, async (req, res) => {
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
    if (!isAuthor && !isAdmin) {
      return res.status(403).json({ msg: 'Not authorized to edit this feed post' });
    }

    const { content, images } = req.body;

    if (typeof content === 'string') {
      feed.content = content.trim() ? content.trim() : undefined;
    }
    if (Array.isArray(images)) {
      if (images.length > 10) {
        return res.status(400).json({ msg: 'You can attach a maximum of 10 images.' });
      }
      feed.images = images;
    }

    if ((!feed.content || feed.content.trim().length === 0) && (!feed.images || feed.images.length === 0)) {
      return res.status(400).json({ msg: 'Content or image(s) are required' });
    }

    await feed.save();
    await feed.populate('author', 'username avatar profilePhoto');
    await feed.populate('likes', '_id username avatar profilePhoto');
    await feed.populate({
      path: 'comments.author',
      select: 'username avatar profilePhoto',
    });

    res.json(feed);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Report a feed post
// Access: admin or approved member (not the author)
router.post('/:feedId/report', auth, async (req, res) => {
  try {
    const { community, isAdmin, isMember } = await getCommunityContext(req.params.communityId, req.userId);
    if (!community) {
      return res.status(404).json({ msg: 'Community not found' });
    }
    if (!isAdmin && !isMember) {
      return res.status(403).json({ msg: 'Only members can report community feed posts' });
    }

    const feed = await CommunityFeed.findById(req.params.feedId);
    if (!feed) {
      return res.status(404).json({ msg: 'Feed post not found' });
    }

    if (feed.author.toString() === req.userId) {
      return res.status(400).json({ msg: 'Cannot report your own post' });
    }

    const { reason } = req.body || {};
    feed.reports.push({
      reporter: req.userId,
      reason: typeof reason === 'string' ? reason : '',
      createdAt: new Date(),
    });
    await feed.save();

    res.json({ msg: 'Feed post reported successfully' });
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

// Add a comment to a feed post
// Access: admin or approved member
router.post('/:feedId/comment', auth, async (req, res) => {
  try {
    const { community, isAdmin, isMember } = await getCommunityContext(req.params.communityId, req.userId);
    if (!community) {
      return res.status(404).json({ msg: 'Community not found' });
    }
    if (!isAdmin && !isMember) {
      return res.status(403).json({ msg: 'Only members can comment on the community feed' });
    }

    const { content, parent } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ msg: 'Comment content is required' });
    }

    const feed = await CommunityFeed.findById(req.params.feedId);
    if (!feed) {
      return res.status(404).json({ msg: 'Feed post not found' });
    }

    feed.comments.push({ author: req.userId, content: content.trim(), parent: parent || undefined });
    await feed.save();
    await feed.populate('comments.author', 'username avatar profilePhoto');

    // Notify the parent comment's author when this is a reply
    if (parent) {
      const parentComment = feed.comments.id(parent);
      if (parentComment && parentComment.author.toString() !== req.userId) {
        try {
          const Notification = require('../models/Notification');
          const io = req.app.get('io');
          const notification = await Notification.create({
            recipient: parentComment.author,
            sender: req.userId,
            type: 'reply',
            message: 'replied to your comment',
            relatedCommunity: community._id,
          });
          if (io) {
            io.to(parentComment.author.toString()).emit('notification:new', notification);
          }
          const pushService = require('../services/push-notification');
          pushService.sendCommentReplyNotification(
            parentComment.author, null, feed._id, parent, community._id, req.userId, false
          ).catch(() => {});
        } catch (notifyErr) {
          console.error('Reply notification error:', notifyErr);
        }
      }
    }

    res.json({ feed, comments: feed.comments });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a comment from a feed post
// Access: comment author (member) or the community admin
router.delete('/:feedId/comment/:commentId', auth, async (req, res) => {
  try {
    const { community, isAdmin } = await getCommunityContext(req.params.communityId, req.userId);
    if (!community) {
      return res.status(404).json({ msg: 'Community not found' });
    }

    const feed = await CommunityFeed.findById(req.params.feedId);
    if (!feed) {
      return res.status(404).json({ msg: 'Feed post not found' });
    }

    const comment = feed.comments.id(req.params.commentId);
    if (!comment) {
      return res.status(404).json({ msg: 'Comment not found' });
    }

    const isCommentAuthor = comment.author.toString() === req.userId;
    if (!isCommentAuthor && !isAdmin) {
      return res.status(403).json({ msg: 'Not authorized to delete this comment' });
    }

    feed.comments = feed.comments.filter((c) => c._id.toString() !== req.params.commentId);
    await feed.save();
    await feed.populate('comments.author', 'username avatar profilePhoto');

    res.json({ feed, comments: feed.comments });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Favorite a feed post (saved to the user's favorites, like regular posts)
router.post('/:feedId/favorite', auth, async (req, res) => {
  try {
    const { community, isAdmin, isMember } = await getCommunityContext(req.params.communityId, req.userId);
    if (!community) {
      return res.status(404).json({ msg: 'Community not found' });
    }
    if (!isAdmin && !isMember) {
      return res.status(403).json({ msg: 'Only members can save community feed posts' });
    }

    const User = require('../models/User');
    const user = await User.findById(req.userId).select('favorites');
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    user.favorites = (user.favorites || []).filter((id) => id && mongoose.Types.ObjectId.isValid(id));
    const isFavorited = user.favorites.some((id) => id.toString() === req.params.feedId);
    if (!isFavorited) {
      user.favorites.push(new mongoose.Types.ObjectId(req.params.feedId));
      await user.save();
    }

    res.json({ msg: 'Feed post saved', isFavorited: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Unfavorite a feed post
router.delete('/:feedId/favorite', auth, async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.userId).select('favorites');
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    user.favorites = (user.favorites || []).filter((id) => id && mongoose.Types.ObjectId.isValid(id));
    user.favorites = user.favorites.filter((id) => id.toString() !== req.params.feedId);
    await user.save();

    res.json({ msg: 'Feed post unsaved', isFavorited: false });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
