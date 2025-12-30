// sockets/chat.js

const Chat = require('../models/Chat');
const User = require('../models/User');
const Message = require('../models/Message');

module.exports = function (io) {
  const users = {}; // In-memory store for user sockets

  io.on('connection', (socket) => {
    console.log(`✓ User connected: ${socket.id}`);

    // Store user's socket ID upon login/connection
    socket.on('user-online', ({ userId }) => {
      if (userId) {
        users[userId] = socket.id;
        console.log(`User ${userId} is online with socket ${socket.id}`);
        // Optionally, update user's status in the database
        User.findByIdAndUpdate(userId, { isActive: true, lastSeen: new Date() }).exec();
      }
    });

    // Join a chat room
    socket.on('join-chat', ({ chatId }) => {
      socket.join(chatId);
      console.log(`User ${socket.id} joined chat ${chatId}`);
    });

    // Listen for a new message
    socket.on('new-message', async ({ chatId, senderId, content, attachment }) => {
      try {
        const chat = await Chat.findById(chatId);
        if (!chat) {
          // Handle error: chat not found
          return;
        }

        const message = {
          sender: senderId,
          content: content || null,
          attachment: attachment || null,
          readBy: [senderId],
          createdAt: new Date(),
        };

        // Create Message document for database consistency
        const newMessage = new Message({
          chat: chatId,
          sender: senderId,
          content: content || null,
          attachment: attachment || null,
          readBy: [senderId],
        });

        await newMessage.save();

        chat.messages.push(newMessage);
        chat.lastMessage = attachment ? `📎 ${attachment.fileName}` : content;
        chat.lastMessageTime = new Date();

        await chat.save();

        // Populate sender info for the message
        let senderData = chat.isAnonymous
          ? { _id: senderId, username: 'Anonymous', profilePhoto: null }
          : await User.findById(senderId, 'username profilePhoto');

        if (!senderData) {
          senderData = { _id: senderId, username: 'Unknown User', profilePhoto: null };
        }

        const populatedMessage = {
            ...message,
            _id: newMessage._id,
            sender: senderData,
        };

        // Broadcast the new message to all clients in the chat room
        io.to(chatId).emit('message-received', populatedMessage);
        
        // Also send a notification to other participants
        chat.participants.forEach(participantId => {
            const participantSocketId = users[participantId.toString()];
            if (participantId.toString() !== senderId && participantSocketId) {
                io.to(participantSocketId).emit('new-notification', {
                    type: 'message',
                    message: `New message from ${populatedMessage.sender.username}`,
                });
            }
        });

      } catch (error) {
        console.error('Error handling new message:', error);
        // Optionally emit an error event back to the sender
        socket.emit('send-error', { error: 'Failed to send message' });
      }
    });
    
    // Handle typing indicators
    socket.on('typing', ({ chatId, username }) => {
        socket.to(chatId).emit('user-typing', { username });
    });
    
    socket.on('stop-typing', ({ chatId }) => {
        socket.to(chatId).emit('user-stop-typing');
    });

    // Handle user disconnecting
    socket.on('disconnect', () => {
      console.log(`✗ User disconnected: ${socket.id}`);
      for (const userId in users) {
        if (users[userId] === socket.id) {
          delete users[userId];
          // Optionally, update user's status in the database
          User.findByIdAndUpdate(userId, { isActive: false, lastSeen: new Date() }).exec();
          break;
        }
      }
    });
  });
};