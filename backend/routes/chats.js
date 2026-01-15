const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const User = require('../models/User');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/chats');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

// Upload attachment
router.post('/upload-attachment', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ msg: 'No file uploaded' });
    const attachment = {
      fileName: req.file.filename,
      url: `/uploads/chats/${req.file.filename}`,
      size: req.file.size,
      type: req.file.mimetype,
    };
    res.json(attachment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload attachment base64
router.post('/upload-attachment-base64', auth, async (req, res) => {
  try {
    const { imageData, filename } = req.body;
    if (!imageData || !filename) return res.status(400).json({ msg: 'Image data and filename required' });

    const buffer = Buffer.from(imageData, 'base64');
    const fileName = Date.now() + '-' + filename;
    const filePath = path.join(__dirname, '../uploads/chats', fileName);

    const dir = path.join(__dirname, '../uploads/chats');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, buffer);

    const attachment = {
      fileName,
      url: `/uploads/chats/${fileName}`,
      size: buffer.length,
      type: 'image/jpeg', // Assume JPEG for base64 uploads
    };
    res.json(attachment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a chat (Group or Direct)
router.post('/', auth, async (req, res) => {
  try {
    const { participants, isGroupChat, name, isTemporary, isAnonymous } = req.body;

    const filteredParticipants = participants.filter(p => p && p.toString().trim() !== '');

    if (!filteredParticipants || filteredParticipants.length < 2) {
      return res.status(400).json({ msg: 'At least 2 participants are required' });
    }

    // For direct chats, check if one already exists
    if (!isGroupChat) {
      if (participants.length > 2) {
         return res.status(400).json({ msg: 'Direct chat can only have 2 participants' });
      }
      
      const existingChat = await Chat.findOne({
        isGroupChat: false,
        participants: { $all: participants, $size: 2 }
      }).populate('participants', 'username profilePhoto');

      if (existingChat) {
        return res.json(existingChat);
      }
    }

    const chatData = {
      participants: filteredParticipants,
      isGroupChat: isGroupChat || false,
      name: isGroupChat ? name : undefined,
      admin: isGroupChat ? req.userId : undefined,
      isTemporary: isTemporary || false,
      isAnonymous: isAnonymous || false,
      pendingMembers: [],
    };

    if (isTemporary) {
        // Set expiration to 24 hours from now
        chatData.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }

    const newChat = new Chat(chatData);

    await newChat.save();
    await newChat.populate('participants', 'username profilePhoto');

    // Notify participants about the new chat
    if (req.io) {
      newChat.participants.filter(p => p).forEach(p => {
        req.io.to(p._id.toString()).emit('newChat', newChat);
      });
    }

    res.json(newChat);
  } catch (error) {
    console.error('Create chat error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user chats
router.get('/user/:userId', auth, async (req, res) => {
  try {
    // Filter out expired temporary chats
    const now = new Date();
    await Chat.deleteMany({ isTemporary: true, expiresAt: { $lt: now } });

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    const chats = await Chat.find({
      participants: req.params.userId
    })
    .populate('participants', 'username profilePhoto isActive lastSeen')
    .populate('relatedCommunity', 'name image')
    .sort({ updatedAt: -1 });

    // Filter out chats with blocked users
    const filteredChats = chats.filter(chat =>
      !chat.participants.some(p => user.blockedUsers.includes(p._id))
    );

    const chatsWithLastMessage = await Promise.all(filteredChats.map(async (chat) => {
        // Filter out null participants (in case some users were deleted)
        chat.participants = chat.participants.filter(p => p);

        // Check for cleared history
        let messageFilter = { chat: chat._id };
        if (chat.clearedHistory) {
            const clearEntry = chat.clearedHistory.find(entry => entry.user && entry.user.toString() === req.params.userId);
            if (clearEntry) {
                messageFilter.createdAt = { $gt: clearEntry.clearedAt };
            }
        }

        const lastMsg = await Message.findOne(messageFilter).sort({ createdAt: -1 });
        const chatObj = chat.toObject();
        if (lastMsg) {
            chatObj.lastMessage = lastMsg.content || (lastMsg.attachment ? 'Sent an attachment' : 'Message');
            chatObj.updatedAt = lastMsg.createdAt; // Use message time for sorting
        }
        
        const unreadCount = await Message.countDocuments({
            ...messageFilter,
            readBy: { $ne: req.params.userId }
        });
        chatObj.unreadCount = unreadCount;

        // Map status fields
        if (chatObj.participants) {
            chatObj.participants = chatObj.participants.map(p => ({
                ...p,
                isOnline: p.isActive,
                lastSeen: p.lastSeen
            }));
        }

        // Handle anonymous chats
        if (chat.isAnonymous) {
            chatObj.participants = chatObj.participants.map(p => ({
                ...p,
                username: 'Anonymous',
                profilePhoto: null
            }));
        }
        
        return chatObj;
    }));
    
    chatsWithLastMessage.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    res.json(chatsWithLastMessage);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single chat
router.get('/:chatId', auth, async (req, res) => {
    try {
        const chat = await Chat.findById(req.params.chatId)
          .populate('participants', 'username profilePhoto isActive lastSeen')
          .populate('relatedCommunity', 'name image');
        if (!chat) return res.status(404).json({ msg: 'Chat not found' });

        // Filter out null participants (in case some users were deleted)
        chat.participants = chat.participants.filter(p => p);

        // Initialize pendingMembers if undefined (for old chats)
        if (!chat.pendingMembers) chat.pendingMembers = [];

        // Check if user is participant or admin (for pending members)
        const isParticipant = chat.participants.some(p => p._id.toString() === req.userId);
        const isAdmin = chat.admin && chat.admin.toString() === req.userId;
        const hasPendingInvitation = chat.pendingMembers.some(p => p && p.toString() === req.userId);

        if (!isParticipant && !isAdmin && !hasPendingInvitation) {
              return res.status(403).json({ msg: 'Not authorized' });
        }

        // Populate pending members only for admins
        if (isAdmin) {
          await chat.populate('pendingMembers', 'username profilePhoto');
          // Filter out null pending members
          chat.pendingMembers = chat.pendingMembers.filter(p => p);
        }

        // Determine the timestamp from which to show messages for this user
        let messagesFilter = { chat: req.params.chatId };
        if (chat.clearedHistory) {
            const clearEntry = chat.clearedHistory.find(entry => entry.user && entry.user.toString() === req.userId);
            if (clearEntry) {
                messagesFilter.createdAt = { $gt: clearEntry.clearedAt };
            }
        }

        const messages = await Message.find(messagesFilter)
            .populate('sender', 'username profilePhoto')
            .populate('readBy', '_id')
            .populate('replyTo', 'content sender')
            .sort({ createdAt: 1 });

        // Populate the sender of replyTo
        await Message.populate(messages, {
            path: 'replyTo.sender',
            select: 'username'
        });

        const chatObj = chat.toObject();

        // Map status fields
        if (chatObj.participants) {
            chatObj.participants = chatObj.participants.map(p => ({
                ...p,
                isOnline: p.isActive,
                lastSeen: p.lastSeen
            }));
        }

        if (chat.isAnonymous) {
              chatObj.participants = chatObj.participants.map(p => ({
                ...p,
                username: 'Anonymous',
                profilePhoto: null
              }));

              chatObj.messages = messages.map(msg => {
                  const msgObj = msg.toObject();
                  if (!msgObj.sender) {
                      msgObj.sender = { _id: 'unknown', username: 'Unknown', profilePhoto: null };
                  }
                  msgObj.sender = {
                      _id: msgObj.sender._id,
                      username: 'Anonymous',
                      profilePhoto: null
                  };
                  msgObj.readBy = msg.readBy.filter(u => u).map(u => u._id.toString());
                  return msgObj;
              });
        } else {
            chatObj.messages = messages.map(msg => {
                const msgObj = msg.toObject();
                if (!msgObj.sender) {
                    msgObj.sender = { _id: 'unknown', username: 'Unknown', profilePhoto: null };
                }
                if (msgObj.isAnonymous && msgObj.sender._id.toString() !== req.userId) {
                    msgObj.sender = {
                        _id: 'anonymous',
                        username: 'Anonymous',
                        profilePhoto: null
                    };
                }
                msgObj.readBy = msg.readBy.filter(u => u).map(u => u._id.toString());
                return msgObj;
            });
        }

        res.json(chatObj);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Send message
router.post('/:chatId/messages', auth, async (req, res) => {
  try {
    const { content, isAnonymous, replyTo, attachment, pollOptions } = req.body;
    const chatId = req.params.chatId;

    if (!content && !attachment && (!pollOptions || pollOptions.length === 0)) {
      return res.status(400).json({ msg: 'Message content or attachment is required' });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ msg: 'Chat not found' });
    }

    // Check if user is participant
    const isParticipant = chat.participants.some(id => id.toString() === req.userId);
    if (!isParticipant) {
      return res.status(403).json({ msg: 'Not authorized to send message to this chat' });
    }

    const newMessage = new Message({
      chat: chatId,
      sender: req.userId,
      content,
      replyTo: replyTo || undefined,
      isAnonymous: isAnonymous || false,
      readBy: [req.userId],
      attachment: attachment || undefined,
      pollOptions: pollOptions || undefined
    });

    await newMessage.save();

    // Update chat updatedAt
    chat.updatedAt = new Date();
    await chat.save();

    await newMessage.populate('sender', 'username profilePhoto');
    if (replyTo) {
      await newMessage.populate('replyTo', 'content sender');
      await Message.populate(newMessage.replyTo, {
        path: 'sender',
        select: 'username'
      });
    }

    // Emit socket event for real-time updates
    if (req.io) {
      req.io.to(chatId).emit('newMessage', newMessage);

      // Emit event to participants for chat list updates
      chat.participants.filter(id => id).forEach(participantId => {
        req.io.to(participantId.toString()).emit('chatUpdated', newMessage);
      });
    }

    res.json(newMessage);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Vote on a poll in a message
router.post('/:chatId/messages/:messageId/vote', auth, async (req, res) => {
  try {
    const { optionIndex } = req.body;
    const message = await Message.findById(req.params.messageId);
    if (!message) return res.status(404).json({ msg: 'Message not found' });
    
    // Check if message has poll
    if (!message.pollOptions || message.pollOptions.length === 0) {
         return res.status(400).json({ msg: 'This message is not a poll' });
    }

    // Remove existing vote if any
    message.pollOptions.forEach(opt => {
        opt.votes = opt.votes.filter(v => v.toString() !== req.userId);
    });

    // Add new vote
    if (message.pollOptions[optionIndex]) {
        message.pollOptions[optionIndex].votes.push(req.userId);
    }

    await message.save();
    
    // Emit update
    if (req.io) {
         req.io.to(req.params.chatId).emit('messageUpdated', message);
    }

    res.json(message);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark chat as read
router.put('/:chatId/read', auth, async (req, res) => {
  try {
    await Message.updateMany(
      { chat: req.params.chatId, readBy: { $ne: req.userId } },
      { $addToSet: { readBy: req.userId } }
    );

    // Emit socket event for read receipts
    if (req.io) {
      req.io.to(req.params.chatId).emit('messages-read', { userId: req.userId, chatId: req.params.chatId });
    }

    res.json({ msg: 'Marked as read' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear chat history for user
router.post('/:chatId/clear', auth, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId);
    if (!chat) return res.status(404).json({ msg: 'Chat not found' });

    // Check if user is participant
    const isParticipant = chat.participants.some(id => id.toString() === req.userId);
    if (!isParticipant) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    // Use atomic updates to ensure data integrity
    const userId = new mongoose.Types.ObjectId(req.userId);

    await Chat.findByIdAndUpdate(req.params.chatId, {
      $pull: { clearedHistory: { user: userId } }
    });
    
    await Chat.findByIdAndUpdate(req.params.chatId, {
      $push: { clearedHistory: { user: userId, clearedAt: new Date() } }
    });
    
    res.json({ msg: 'Chat history cleared' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update group name (admin only)
router.put('/:chatId/name', auth, async (req, res) => {
  try {
    const { name } = req.body;
    const chat = await Chat.findById(req.params.chatId);

    if (!chat) return res.status(404).json({ msg: 'Chat not found' });
    if (!chat.isGroupChat) return res.status(400).json({ msg: 'Not a group chat' });
    if (chat.admin.toString() !== req.userId) return res.status(403).json({ msg: 'Only admin can change group name' });

    chat.name = name;
    await chat.save();

    res.json(chat);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Invite member to group (admin only) - adds to pending
router.post('/:chatId/members', auth, async (req, res) => {
  try {
    const { userId } = req.body;
    const chat = await Chat.findById(req.params.chatId);

    if (!chat) return res.status(404).json({ msg: 'Chat not found' });
    if (!chat.isGroupChat) return res.status(400).json({ msg: 'Not a group chat' });
    if (chat.admin.toString() !== req.userId) return res.status(403).json({ msg: 'Only admin can invite members' });

    // Initialize pendingMembers if undefined (for old chats)
    if (!chat.pendingMembers) chat.pendingMembers = [];

    if (chat.participants.includes(userId)) {
      return res.status(400).json({ msg: 'User is already a member' });
    }

    if (chat.pendingMembers.includes(userId)) {
      return res.status(400).json({ msg: 'User already has a pending invitation' });
    }

    chat.pendingMembers.push(userId);
    await chat.save();
    await chat.populate('participants', 'username profilePhoto');
    await chat.populate('pendingMembers', 'username profilePhoto');

    // Create notification for the invited user
    const Notification = require('../models/Notification');
    const notification = new Notification({
      recipient: userId,
      sender: req.userId,
      type: 'chat_invitation',
      message: `invited you to join "${chat.name || 'a group chat'}"`,
      relatedChat: chat._id,
    });
    await notification.save();

    // Emit notification to the invited user
    if (req.io) {
      req.io.to(userId.toString()).emit('notification', notification);
    }

    res.json(chat);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove member from group (admin only)
router.delete('/:chatId/members/:userId', auth, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId);

    if (!chat) return res.status(404).json({ msg: 'Chat not found' });
    if (!chat.isGroupChat) return res.status(400).json({ msg: 'Not a group chat' });
    if (chat.admin.toString() !== req.userId) return res.status(403).json({ msg: 'Only admin can remove members' });
chat.participants = chat.participants.filter(id => id && id.toString() !== req.params.userId);

    await chat.save();
    await chat.populate('participants', 'username profilePhoto');

    res.json(chat);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Accept chat invitation
router.post('/:chatId/accept', auth, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId);

    if (!chat) return res.status(404).json({ msg: 'Chat not found' });
    if (!chat.isGroupChat) return res.status(400).json({ msg: 'Not a group chat' });

    const pendingIndex = chat.pendingMembers.findIndex(id => id && id.toString() === req.userId);
    if (pendingIndex === -1) {
      return res.status(400).json({ msg: 'No pending invitation found' });
    }

    // Remove from pending and add to participants
    chat.pendingMembers.splice(pendingIndex, 1);
    if (!chat.participants.includes(req.userId)) {
      chat.participants.push(req.userId);
    }

    await chat.save();
    await chat.populate('participants', 'username profilePhoto');
    await chat.populate('pendingMembers', 'username profilePhoto');

    // Notify user of new chat
    if (req.io) {
      const fullChat = await Chat.findById(chat._id)
        .populate('participants', 'username profilePhoto')
        .populate('relatedCommunity', 'name image');
      req.io.to(req.userId).emit('newChat', fullChat);
    }

    res.json({ msg: 'Successfully joined the chat', chat });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reject chat invitation
router.post('/:chatId/reject', auth, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId);

    if (!chat) return res.status(404).json({ msg: 'Chat not found' });
    if (!chat.isGroupChat) return res.status(400).json({ msg: 'Not a group chat' });
chat.pendingMembers = chat.pendingMembers.filter(id => id && id.toString() !== req.userId);

    await chat.save();
    await chat.populate('pendingMembers', 'username profilePhoto');

    res.json({ msg: 'Chat invitation rejected' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cancel pending invitation (admin only)
router.delete('/:chatId/pending/:userId', auth, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId);

    if (!chat) return res.status(404).json({ msg: 'Chat not found' });
    if (!chat.isGroupChat) return res.status(400).json({ msg: 'Not a group chat' });
    if (chat.admin.toString() !== req.userId) return res.status(403).json({ msg: 'Only admin can cancel invitations' });
chat.pendingMembers = chat.pendingMembers.filter(id => id && id.toString() !== req.params.userId);

    await chat.save();
    await chat.populate('participants', 'username profilePhoto');
    await chat.populate('pendingMembers', 'username profilePhoto');

    res.json(chat);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Leave group
router.post('/:chatId/leave', auth, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId);

    if (!chat) return res.status(404).json({ msg: 'Chat not found' });
    if (!chat.isGroupChat) return res.status(400).json({ msg: 'Not a group chat' });
chat.participants = chat.participants.filter(id => id && id.toString() !== req.userId);

    await chat.save();

    res.json({ msg: 'Left group successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete message
router.delete('/:chatId/messages/:messageId', auth, async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);
    if (!message || message.chat.toString() !== req.params.chatId) {
      return res.status(404).json({ msg: 'Message not found' });
    }

    const chat = await Chat.findById(req.params.chatId);
    if (!chat) return res.status(404).json({ msg: 'Chat not found' });

    // Allow sender or admin to delete
    if (message.sender.toString() !== req.userId && chat.admin && chat.admin.toString() !== req.userId) {
      return res.status(403).json({ msg: 'Not authorized to delete this message' });
    }

    await Message.findByIdAndDelete(req.params.messageId);

    // Notify all participants
    if (req.io) {
      chat.participants.filter(id => id).forEach(participantId => {
        req.io.to(participantId.toString()).emit('messageDeleted', {
          messageId: req.params.messageId,
          chatId: req.params.chatId
        });
      });
    }

    res.json({ msg: 'Message deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete chat (admin only)
router.delete('/:chatId', auth, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId);

    if (!chat) return res.status(404).json({ msg: 'Chat not found' });
    if (!chat.isGroupChat) return res.status(400).json({ msg: 'Cannot delete direct messages' });
    if (chat.admin.toString() !== req.userId) return res.status(403).json({ msg: 'Only admin can delete chat' });

    // Delete all messages in the chat
    await Message.deleteMany({ chat: req.params.chatId });

    // Delete the chat
    await Chat.findByIdAndDelete(req.params.chatId);

    // Notify all participants that the chat was deleted
    if (req.io) {
      chat.participants.filter(id => id).forEach(participantId => {
        req.io.to(participantId.toString()).emit('chatDeleted', {
          chatId: req.params.chatId
        });
      });
    }

    res.json({ msg: 'Chat deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
