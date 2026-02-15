// sockets/chat.js

const Chat = require('../models/Chat');
const User = require('../models/User');
const Message = require('../models/Message');

module.exports = function (io) {
  const users = {}; // In-memory store for user sockets

  io.on('connection', (socket) => {
    console.log(`✓ User connected: ${socket.id}`);

    // Store user's socket ID upon login/connection
    socket.on('user-online', async ({ userId }) => {
      if (userId) {
        users[userId] = socket.id;
        console.log(`User ${userId} is online with socket ${socket.id}`);
        // Update user's status in the database
        await User.findByIdAndUpdate(userId, { isActive: true, lastSeen: new Date() });
        io.emit('user_status_change', { userId, isOnline: true, lastSeen: new Date() });
      }
    });

    // Join a chat room
    socket.on('join-chat', ({ chatId }) => {
      socket.join(chatId);
      console.log(`User ${socket.id} joined chat ${chatId}`);
    });

    // Listen for a new message (via socket - for real-time, but don't save as REST API handles persistence)
    socket.on('new-message', async ({ chatId, senderId, content, attachment, isAnonymous, tempId }) => {
      try {
        const chat = await Chat.findById(chatId);
        if (!chat) {
          // Handle error: chat not found
          return;
        }

        // Don't save here - REST API already saves the message
        // Just broadcast the message for real-time updates to other users
        
        // Populate sender info for the message
        let senderData = chat.isAnonymous
          ? { _id: senderId, username: 'Anonymous', profilePhoto: null }
          : await User.findById(senderId, 'username profilePhoto');

        if (!senderData) {
          senderData = { _id: senderId, username: 'Unknown User', profilePhoto: null };
        }

        // Create a message object for broadcasting (use tempId if provided, otherwise generate one)
        // This allows the sender to match and replace their temporary message
        const messageId = tempId || `temp-${Date.now()}`;

        const broadcastMessage = {
            _id: messageId,
            chat: chatId,
            sender: senderData,
            content: content || null,
            attachment: attachment || null,
            isAnonymous: isAnonymous || false,
            createdAt: new Date().toISOString(),
            readBy: [senderId],
        };

        // Broadcast the new message to all clients in the chat room
        io.to(chatId).emit('message-received', broadcastMessage);
        
        // Also send a notification to other participants
        chat.participants.forEach(participantId => {
            const participantSocketId = users[participantId.toString()];
            if (participantId.toString() !== senderId && participantSocketId) {
                io.to(participantSocketId).emit('new-notification', {
                    type: 'message',
                    message: `New message from ${senderData.username}`,
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

   // Handle voice call signaling for private chats
   socket.on('voice-call-offer', ({ chatId, offer, caller }) => {
     Chat.findById(chatId).populate('participants', '_id').then(chat => {
       if (!chat) return;

       // Emit to all participants except the caller
       chat.participants.forEach(participant => {
         if (participant._id.toString() !== caller._id) {
           const participantSocketId = users[participant._id.toString()];
           if (participantSocketId) {
             io.to(participantSocketId).emit('voice-call-offer', { offer, caller, chatId });
           }
         }
       });
     }).catch(error => {
       console.error('Error handling voice call offer:', error);
     });
   });

   socket.on('voice-call-answer', ({ chatId, answer }) => {
     socket.to(chatId).emit('voice-call-answer', { answer });
   });

   socket.on('voice-call-ice-candidate', ({ chatId, candidate }) => {
     socket.to(chatId).emit('voice-call-ice-candidate', { candidate });
   });

   socket.on('voice-call-end', ({ chatId }) => {
     socket.to(chatId).emit('voice-call-end');
   });

   // Handle user disconnecting
   socket.on('disconnect', async () => {
     console.log(`✗ User disconnected: ${socket.id}`);
     for (const userId in users) {
       if (users[userId] === socket.id) {
         delete users[userId];
         // Update user's status in the database
         const lastSeen = new Date();
         await User.findByIdAndUpdate(userId, { isActive: false, lastSeen });
         io.emit('user_status_change', { userId, isOnline: false, lastSeen });
         break;
       }
     }
   });
  });
};