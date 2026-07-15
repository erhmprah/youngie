const express = require('express');
const router = express.Router();
const Community = require('../models/Community');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Chat = require('../models/Chat');
const CommunityInvite = require('../models/CommunityInvite');
const auth = require('../middleware/auth');
const { parsePaginationParams, buildPaginatedResponse } = require('../utils/pagination');
const communityFeedRoutes = require('./community-feed');
const crypto = require('crypto');
const { uploadFile, supabase: supabaseStorage } = require('../utils/supabaseStorage');
const pushService = require('../services/push-notification');

// Upload community image base64
router.post('/upload-image-base64', auth, async (req, res) => {
  try {
    const { imageData, filename } = req.body;
    if (!imageData || !filename) {
      return res.status(400).json({ msg: 'Image data and filename required' });
    }

    // If Supabase is configured, upload to Supabase
    if (supabaseStorage) {
      try {
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const mimeType = imageData.match(/^data:image\/(\w+);base64,/)?.[1] || 'jpeg';
        const imageUrl = await uploadFile(buffer, filename, mimeType, 'communities');
        return res.json({ imageUrl });
      } catch (supabaseError) {
        console.error('❌ Supabase community image upload failed:', supabaseError.message);
      }
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
    const { page, limit, skip } = parsePaginationParams(req.query);
    const total = await Community.countDocuments();

    let communities = await Community.find()
      .populate('creator', 'username avatar profilePhoto')
      .populate('members', 'username avatar profilePhoto')
      .populate('pendingMembers', 'username avatar profilePhoto')
      .populate('chat')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Self-healing: Create chats for communities that don't have one (Legacy data support)
    const updates = communities.map(async (comm) => {
      if (!comm.chat) {
        const newChat = new Chat({
          participants: comm.members.map(m => m._id),
          isGroupChat: true,
          name: comm.name,
          admin: comm.creator._id,
          relatedCommunity: comm._id
        });
        await newChat.save();
        comm.chat = newChat; // Update in-memory object for response
        await Community.updateOne({ _id: comm._id }, { chat: newChat._id });
      }
      return comm;
    });
    await Promise.all(updates);

    res.json(buildPaginatedResponse(communities, total, { page, limit, skip, hasNextPage: skip + communities.length < total, hasPrevPage: page > 1 }));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search communities
router.get('/search', auth, async (req, res) => {
  try {
    console.log('🔍 Searching communities for:', req.query.q);
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ msg: 'Search query required' });
    }

    const escapedQuery = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const searchQuery = {
      $or: [
        { name: { $regex: escapedQuery, $options: 'i' } },
        { description: { $regex: escapedQuery, $options: 'i' } }
      ]
    };

    const { page, limit, skip } = parsePaginationParams(req.query);
    const total = await Community.countDocuments(searchQuery);

    const communities = await Community.find(searchQuery)
      .populate('creator', 'username avatar profilePhoto')
      .populate('members', 'username avatar profilePhoto')
      .populate('chat')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json(buildPaginatedResponse(communities, total, { page, limit, skip, hasNextPage: skip + communities.length < total, hasPrevPage: page > 1 }));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Aggregated feed of posts from communities the user has joined
router.get('/feed/joined', auth, async (req, res) => {
  try {
    const CommunityFeed = require('../models/CommunityFeed');
    const { page, limit, skip } = parsePaginationParams(req.query);

    // Communities the user is a member of or created
    const communities = await Community.find({
      $or: [{ members: req.userId }, { creator: req.userId }],
    }).select('_id');
    const communityIds = communities.map((c) => c._id);

    if (communityIds.length === 0) {
      return res.json(buildPaginatedResponse([], 0, { page, limit, skip, hasNextPage: false, hasPrevPage: page > 1 }));
    }

    const query = { community: { $in: communityIds } };
    const total = await CommunityFeed.countDocuments(query);

    const User = require('../models/User');
    const currentUser = await User.findById(req.userId).select('favorites');
    const userFavorites = currentUser && currentUser.favorites
      ? currentUser.favorites.map((id) => id.toString())
      : [];

    const feeds = await CommunityFeed.find(query)
      .populate('author', 'username avatar profilePhoto')
      .populate('likes', '_id username avatar profilePhoto')
      .populate('community', 'name image')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Mark favorited state for the current user
    const feedsWithFavorite = feeds.map((feed) => {
      const f = feed.toObject();
      f.isFavorited = userFavorites.includes(f._id.toString());
      return f;
    });

    res.json(buildPaginatedResponse(feedsWithFavorite, total, { page, limit, skip, hasNextPage: skip + feeds.length < total, hasPrevPage: page > 1 }));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single community details
router.get('/:communityId', auth, async (req, res) => {
  try {
    let community = await Community.findById(req.params.communityId)
      .populate('creator', 'username avatar profilePhoto')
      .populate('members', 'username avatar profilePhoto')
      .populate('chat');

    if (!community) {
      return res.status(404).json({ msg: 'Community not found' });
    }

    // Self-healing: Create chat if missing
    if (!community.chat) {
      const newChat = new Chat({
        participants: community.members.map(m => m._id),
        isGroupChat: true,
        name: community.name,
        admin: community.creator._id,
        relatedCommunity: community._id
      });
      await newChat.save();
      community.chat = newChat;
      await Community.updateOne({ _id: community._id }, { chat: newChat._id });
    }

    // Populate pending members
    await community.populate('pendingMembers', 'username avatar profilePhoto');

    res.json(community);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a community
router.post('/', auth, async (req, res) => {
  try {
    const { name, description, image, requiresApproval, isAnonymous } = req.body;

    if (!name || !description) {
      return res.status(400).json({ msg: 'Name and description are required' });
    }

    // Create a group chat for the community
    const chat = new Chat({
      participants: [req.userId],
      isGroupChat: true,
      name: name,
      admin: req.userId,
      isAnonymous: isAnonymous === true || isAnonymous === 'true',
    });
    await chat.save();

    const community = new Community({
      name,
      description,
      image,
      creator: req.userId,
      requiresApproval: requiresApproval !== false, // Default to true
      isAnonymous: isAnonymous === true || isAnonymous === 'true',
      members: [req.userId], // Creator is automatically a member
      chat: chat._id,
    });

    await community.save();

    // Link chat back to community
    chat.relatedCommunity = community._id;
    await chat.save();

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

        // Send notification to community creator
        const notification = new Notification({
          recipient: community.creator,
          sender: req.userId,
          type: 'community_join_request',
          message: `wants to join your community "${community.name}"`,
          relatedCommunity: community._id,
        });
        await notification.save();
        pushService.sendCommunityJoinRequestNotification(community.creator, null, community.name, community._id, req.userId).catch(() => {});

        return res.json({ msg: 'Join request sent for approval' });
      }
      return res.status(400).json({ msg: 'Join request already pending' });
    } else {
      // Directly add to members
      community.members.push(req.userId);

      // Add to community chat
      if (community.chat) {
        const chat = await Chat.findById(community.chat);
        if (chat && !chat.participants.includes(req.userId)) {
          chat.participants.push(req.userId);
          await chat.save();

          // Notify user of new chat
          if (req.io) {
            const fullChat = await Chat.findById(chat._id)
              .populate('participants', 'username profilePhoto')
              .populate('relatedCommunity', 'name image');
            req.io.to(req.userId).emit('newChat', fullChat);
          }
        }
      }

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
    console.log('Approve request:', req.params.communityId, req.params.userId, 'by', req.userId);
    const community = await Community.findById(req.params.communityId);
    if (!community) {
      console.log('Community not found');
      return res.status(404).json({ msg: 'Community not found' });
    }

    // Check if user is creator
    console.log('Community creator:', community.creator.toString(), 'req.userId:', req.userId);
    if (community.creator.toString() !== req.userId) {
      console.log('Not creator');
      return res.status(403).json({ msg: 'Only creator can approve members' });
    }

    const userId = req.params.userId;
    const pendingIndex = community.pendingMembers.findIndex(id => id.toString() === userId);
    if (pendingIndex === -1) {
      return res.status(400).json({ msg: 'User not in pending list' });
    }

    community.pendingMembers.splice(pendingIndex, 1);
    community.members.push(userId);

    // Add to community chat
    if (community.chat) {
      const chat = await Chat.findById(community.chat);
      if (chat && !chat.participants.includes(userId)) {
        chat.participants.push(userId);
        await chat.save();

        // Notify user of new chat
        if (req.io) {
          const fullChat = await Chat.findById(chat._id)
            .populate('participants', 'username profilePhoto')
            .populate('relatedCommunity', 'name image');
          req.io.to(userId).emit('newChat', fullChat);
        }
      }
    }

    await community.save();
    await community.populate('members', 'username avatar profilePhoto');
    await community.populate('pendingMembers', 'username avatar profilePhoto');

    const approvedUser = await User.findById(userId);

    const approvalNotification = new Notification({
      recipient: userId,
      sender: req.userId,
      type: 'community_join_request',
      message: `approved your request to join "${community.name}"`,
      relatedCommunity: community._id,
    });
    await approvalNotification.save();
    await approvalNotification.populate('sender', 'username avatar profilePhoto');

    if (req.io) {
      req.io.to(userId).emit('notification:new', approvalNotification);
    }

    if (approvedUser) {
      pushService.sendCommunityJoinRequestApprovedNotification(
        userId, req.userId, community.name, community._id
      ).catch(() => {});
    }

    res.json(community);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reject member
router.post('/:communityId/reject/:userId', auth, async (req, res) => {
  try {
    const community = await Community.findById(req.params.communityId);
    if (!community) {
      return res.status(404).json({ msg: 'Community not found' });
    }

    // Check if user is creator
    if (community.creator.toString() !== req.userId) {
      return res.status(403).json({ msg: 'Only creator can reject members' });
    }

    const userId = req.params.userId;

    // Remove from pending members
    community.pendingMembers = community.pendingMembers.filter(id => id.toString() !== userId);

    await community.save();
    await community.populate('pendingMembers', 'username avatar profilePhoto');

    const rejectionNotification = new Notification({
      recipient: userId,
      sender: req.userId,
      type: 'community_join_request',
      message: `rejected your request to join "${community.name}"`,
      relatedCommunity: community._id,
    });
    await rejectionNotification.save();
    await rejectionNotification.populate('sender', 'username avatar profilePhoto');

    if (req.io) {
      req.io.to(userId).emit('notification:new', rejectionNotification);
    }

    const rejectedUser = await User.findById(userId);
    if (rejectedUser) {
      pushService.sendCommunityJoinRequestRejectedNotification(
        userId, req.userId, community.name, community._id
      ).catch(() => {});
    }

    res.json(community);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Leave community
router.post('/:communityId/leave', auth, async (req, res) => {
  try {
    const community = await Community.findById(req.params.communityId);
    if (!community) {
      return res.status(404).json({ msg: 'Community not found' });
    }

    // Check if user is a member
    if (!community.members.includes(req.userId)) {
      return res.status(400).json({ msg: 'Not a member of this community' });
    }

    // Prevent creator from leaving if there are other members
    if (community.creator.toString() === req.userId && community.members.length > 1) {
      return res.status(400).json({ msg: 'Creator cannot leave community with other members. Transfer ownership first.' });
    }

    // Remove user from members
    community.members = community.members.filter(id => id.toString() !== req.userId);

    // Remove from community chat
    if (community.chat) {
      const chat = await Chat.findById(community.chat);
      if (chat) {
        chat.participants = chat.participants.filter(id => id.toString() !== req.userId);
        await chat.save();
      }
    }

    await community.save();
    await community.populate('members', 'username avatar profilePhoto');

    res.json({ msg: 'Successfully left community', community });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate invite link (only by creator/admin)
router.post('/:communityId/invite', auth, async (req, res) => {
  try {
    const community = await Community.findById(req.params.communityId);
    if (!community) {
      return res.status(404).json({ msg: 'Community not found' });
    }

    // Check if user is the creator
    if (community.creator.toString() !== req.userId) {
      return res.status(403).json({ msg: 'Only the creator can generate invite links' });
    }

    const { maxUses, expiresIn } = req.body; // expiresIn in days

    // Generate unique token
    const inviteToken = crypto.randomBytes(16).toString('hex');

    // Calculate expiration date
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000) : null;

    const invite = new CommunityInvite({
      community: req.params.communityId,
      createdBy: req.userId,
      inviteToken,
      maxUses: maxUses || null,
      expiresAt,
    });

    await invite.save();

    // Generate the invite URL
    const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/join-community/${inviteToken}`;

    res.json({
      inviteToken,
      inviteUrl,
      expiresAt,
      maxUses
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Join community via invite link (public endpoint)
router.post('/join/:inviteToken', async (req, res) => {
  try {
    const invite = await CommunityInvite.findOne({ inviteToken: req.params.inviteToken })
      .populate('community');

    if (!invite) {
      return res.status(404).json({ msg: 'Invalid invite link' });
    }

    if (!invite.isActive) {
      return res.status(400).json({ msg: 'This invite link has been deactivated' });
    }

    if (invite.expiresAt && invite.expiresAt < new Date()) {
      return res.status(400).json({ msg: 'This invite link has expired' });
    }

    if (invite.maxUses && invite.uses >= invite.maxUses) {
      return res.status(400).json({ msg: 'This invite link has reached its usage limit' });
    }

    const community = invite.community;

    // Check if user is already authenticated
    const userId = req.userId; // This will be undefined for non-authenticated users

    if (!userId) {
      // Return community info for unauthenticated users
      return res.json({
        requiresAuth: true,
        community: {
          _id: community._id,
          name: community.name,
          description: community.description,
          image: community.image,
          requiresApproval: community.requiresApproval,
          isPrivate: community.isPrivate,
        }
      });
    }

    // Check if user is already a member
    if (community.members.includes(userId)) {
      return res.status(400).json({ msg: 'Already a member of this community' });
    }

    if (community.requiresApproval) {
      // Add to pending members
      if (!community.pendingMembers.includes(userId)) {
        community.pendingMembers.push(userId);
        await community.save();

        // Send notification to community creator
        const notification = new Notification({
          recipient: community.creator,
          sender: userId,
          type: 'community_join_request',
          message: `wants to join your community "${community.name}" via invite link`,
          relatedCommunity: community._id,
        });
        await notification.save();
        pushService.sendCommunityJoinRequestNotification(community.creator, null, community.name, community._id, userId).catch(() => {});

        // Increment invite usage
        invite.uses += 1;
        await invite.save();

        return res.json({ msg: 'Join request sent for approval' });
      }
      return res.status(400).json({ msg: 'Join request already pending' });
    } else {
      // Directly add to members
      community.members.push(userId);

      // Add to community chat
      if (community.chat) {
        const chat = await Chat.findById(community.chat);
        if (chat && !chat.participants.includes(userId)) {
          chat.participants.push(userId);
          await chat.save();
        }
      }

      await community.save();

      // Increment invite usage
      invite.uses += 1;
      await invite.save();

      await community.populate('members', 'username avatar profilePhoto');
      res.json(community);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get community invite info (public endpoint for invite links)
router.get('/invite/:inviteToken', async (req, res) => {
  try {
    const invite = await CommunityInvite.findOne({ inviteToken: req.params.inviteToken })
      .populate('community', 'name description image requiresApproval isPrivate')
      .populate('createdBy', 'username');

    if (!invite) {
      return res.status(404).json({ msg: 'Invalid invite link' });
    }

    if (!invite.isActive) {
      return res.status(400).json({ msg: 'This invite link has been deactivated' });
    }

    if (invite.expiresAt && invite.expiresAt < new Date()) {
      return res.status(400).json({ msg: 'This invite link has expired' });
    }

    res.json({
      community: invite.community,
      createdBy: invite.createdBy,
      expiresAt: invite.expiresAt,
      maxUses: invite.maxUses,
      uses: invite.uses,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete community (only by creator)
router.delete('/:communityId', auth, async (req, res) => {
  try {
    const community = await Community.findById(req.params.communityId);
    if (!community) {
      return res.status(404).json({ msg: 'Community not found' });
    }

    // Check if user is the creator
    if (community.creator.toString() !== req.userId) {
      return res.status(403).json({ msg: 'Only the creator can delete this community' });
    }

    // Delete associated chat
    if (community.chat) {
      await Chat.findByIdAndDelete(community.chat);
    }

    // Delete associated invites
    await CommunityInvite.deleteMany({ community: req.params.communityId });

    // Delete the community
    await Community.findByIdAndDelete(req.params.communityId);

    // Delete related notifications (join requests, invitations for this community)
    const Notification = require('../models/Notification');
    await Notification.deleteMany({
      relatedCommunity: req.params.communityId,
      type: { $in: ['community_join_request', 'chat_invitation'] }
    });

    res.json({ msg: 'Community deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Community feed (posts within a community)
router.use('/:communityId/feed', communityFeedRoutes);

// Community events
router.get('/:communityId/events', auth, async (req, res) => {
  try {
    const CommunityEvent = require('../models/CommunityEvent');
    const { page, limit, skip } = parsePaginationParams(req.query);

    const total = await CommunityEvent.countDocuments({ community: req.params.communityId });
    const events = await CommunityEvent.find({ community: req.params.communityId })
      .populate('creator', 'username avatar profilePhoto')
      .sort({ date: 1 })
      .skip(skip)
      .limit(limit);

    res.json(buildPaginatedResponse(events, total, { page, limit, skip, hasNextPage: skip + events.length < total, hasPrevPage: page > 1 }));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:communityId/events', auth, async (req, res) => {
  try {
    const CommunityEvent = require('../models/CommunityEvent');
    const { title, description, date, type } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ msg: 'Event title is required' });
    }
    if (!date || isNaN(Date.parse(date))) {
      return res.status(400).json({ msg: 'A valid event date is required' });
    }

    const event = new CommunityEvent({
      community: req.params.communityId,
      creator: req.userId,
      title: title.trim(),
      description: description || '',
      date: new Date(date),
      type: type || 'other',
    });

    await event.save();
    await event.populate('creator', 'username avatar profilePhoto');

    res.status(201).json(event);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:communityId/events/:eventId', auth, async (req, res) => {
  try {
    const CommunityEvent = require('../models/CommunityEvent');
    const event = await CommunityEvent.findById(req.params.eventId);
    if (!event) {
      return res.status(404).json({ msg: 'Event not found' });
    }

    const community = await Community.findById(req.params.communityId);
    const isAdmin = community && community.creator && community.creator.toString() === req.userId;
    const isCreator = event.creator && event.creator.toString() === req.userId;

    if (!isAdmin && !isCreator) {
      return res.status(403).json({ msg: 'Not authorized to delete this event' });
    }

    await CommunityEvent.findByIdAndDelete(req.params.eventId);
    res.json({ msg: 'Event deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;