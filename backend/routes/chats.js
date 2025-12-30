const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const auth = require('../middleware/auth');

// Create a chat (Group or Direct)
router.post('/', auth, async (req, res) => {
  try {
    const { participants, isGroupChat, name, isTemporary, isAnonymous } = req.body;

    if (!participants || participants.length < 2) {
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
      participants,
      isGroupChat: isGroupChat || false,
      name: isGroupChat ? name : undefined,
      admin: isGroupChat ? req.userId : undefined,
      isTemporary: isTemporary || false,
      isAnonymous: isAnonymous || false,
    };

    if (isTemporary) {
        // Set expiration to 24 hours from now
        chatData.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }

    const newChat = new Chat(chatData);

    await newChat.save();
    await newChat.populate('participants', 'username profilePhoto');

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

    const chats = await Chat.find({
      participants: req.params.userId
    })
    .populate('participants', 'username profilePhoto')
    .sort({ updatedAt: -1 });

    const chatsWithLastMessage = await Promise.all(chats.map(async (chat) => {
        const lastMsg = await Message.findOne({ chat: chat._id }).sort({ createdAt: -1 });
        const chatObj = chat.toObject();
        if (lastMsg) {
            chatObj.lastMessage = lastMsg.content;
            chatObj.updatedAt = lastMsg.createdAt; // Use message time for sorting
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
        const chat = await Chat.findById(req.params.chatId).populate('participants', 'username profilePhoto');
        if (!chat) return res.status(404).json({ msg: 'Chat not found' });

        // Check if user is participant
        const isParticipant = chat.participants.some(p => p._id.toString() === req.userId);
        if (!isParticipant) {
             return res.status(403).json({ msg: 'Not authorized' });
        }
        
        const messages = await Message.find({ chat: req.params.chatId })
            .populate('sender', 'username profilePhoto')
            .sort({ createdAt: 1 });

        const chatObj = chat.toObject();
        
        if (chat.isAnonymous) {
             chatObj.participants = chatObj.participants.map(p => ({
                ...p,
                username: 'Anonymous',
                profilePhoto: null
             }));
             
             chatObj.messages = messages.map(msg => {
                 const msgObj = msg.toObject();
                 msgObj.sender = {
                     _id: msgObj.sender._id,
                     username: 'Anonymous',
                     profilePhoto: null
                 };
                 return msgObj;
             });
        } else {
            chatObj.messages = messages;
        }
        
        res.json(chatObj);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Send message
router.post('/:chatId/messages', auth, async (req, res) => {
  try {
    const { content } = req.body;
    const chatId = req.params.chatId;

    if (!content) {
      return res.status(400).json({ msg: 'Message content is required' });
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
      content
    });

    await newMessage.save();
    
    // Update chat updatedAt
    chat.updatedAt = new Date();
    await chat.save();

    await newMessage.populate('sender', 'username profilePhoto');

    res.json(newMessage);
  } catch (error) {
    console.error('Send message error:', error);
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

// Add member to group (admin only)
router.post('/:chatId/members', auth, async (req, res) => {
  try {
    const { userId } = req.body;
    const chat = await Chat.findById(req.params.chatId);

    if (!chat) return res.status(404).json({ msg: 'Chat not found' });
    if (!chat.isGroupChat) return res.status(400).json({ msg: 'Not a group chat' });
    if (chat.admin.toString() !== req.userId) return res.status(403).json({ msg: 'Only admin can add members' });

    if (chat.participants.includes(userId)) {
      return res.status(400).json({ msg: 'User is already a member' });
    }

    chat.participants.push(userId);
    await chat.save();
    await chat.populate('participants', 'username profilePhoto');

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

    chat.participants = chat.participants.filter(id => id.toString() !== req.params.userId);
    await chat.save();
    await chat.populate('participants', 'username profilePhoto');

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

    chat.participants = chat.participants.filter(id => id.toString() !== req.userId);
    await chat.save();

    res.json({ msg: 'Left group successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
