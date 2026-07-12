// sockets/chat.js

const mongoose = require('mongoose');
const Chat = require('../models/Chat');
const User = require('../models/User');
const Message = require('../models/Message');

// Timeout in milliseconds - user is considered offline after this period of inactivity
const ONLINE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const CLEANUP_INTERVAL = 60 * 1000; // Run cleanup every minute

// Export users and userLastActivity for use in API routes
let users = {}; // In-memory store for user sockets
let userLastActivity = {}; // Track last activity timestamp for each user

module.exports = function (io) {
  // Run immediate cleanup on server start - mark all users as offline
  User.updateMany({}, { isActive: false, lastSeen: new Date() }).then(result => {
    if (result.modifiedCount > 0) {
      console.log(`✓ Initial cleanup: Marked ${result.modifiedCount} users as offline`);
    }
  }).catch(err => {
    console.error('Error in initial cleanup:', err);
  });

  // Periodic cleanup to mark users as offline who haven't been active
  const cleanupInterval = setInterval(async () => {
    const now = Date.now();
    const staleUsers = [];
    
    for (const userId in userLastActivity) {
      const lastActivity = userLastActivity[userId];
      if (now - lastActivity > ONLINE_TIMEOUT) {
        staleUsers.push(userId);
      }
    }
    
    // Mark stale users as offline
    for (const userId of staleUsers) {
      delete users[userId];
      delete userLastActivity[userId];
      
      // Update user's status in the database
      await User.findByIdAndUpdate(userId, { isActive: false, lastSeen: new Date() });
      io.emit('user_status_change', { userId, isOnline: false, lastSeen: new Date() });
      console.log(`Marked user ${userId} as offline due to inactivity`);
    }
  }, CLEANUP_INTERVAL);

  // Helper to update user activity timestamp
  const updateUserActivity = (userId) => {
    userLastActivity[userId] = Date.now();
  };

  io.on('connection', (socket) => {
    console.log(`✓ User connected: ${socket.id}`);

    // Handle socket-level errors - this is the proper way to catch errors
    socket.on('error', (error) => {
      console.error(`Socket error for ${socket.id}:`, error.message || error);
      // Clean up user from users map if they had one
      for (const userId in users) {
        if (users[userId] === socket.id) {
          delete users[userId];
          delete userLastActivity[userId];
          break;
        }
      }
    });

    // Handle disconnect first (important to clean up resources)
    socket.on('disconnect', async (reason) => {
      console.log(`✗ User disconnected: ${socket.id}, reason: ${reason}`);
      for (const userId in users) {
        if (users[userId] === socket.id) {
          delete users[userId];
          delete userLastActivity[userId];
          // Update user's status in the database
          try {
            const lastSeen = new Date();
            await User.findByIdAndUpdate(userId, { isActive: false, lastSeen });
            io.emit('user_status_change', { userId, isOnline: false, lastSeen });
          } catch (error) {
            console.error(`Error updating user ${userId} status on disconnect:`, error.message);
          }
          break;
        }
      }
    });

    // Store user's socket ID upon login/connection
    socket.on('user-online', async ({ userId }) => {
      try {
        if (userId) {
          users[userId] = socket.id;
          updateUserActivity(userId);
          console.log(`User ${userId} is online with socket ${socket.id}`);
          // Update user's status in the database
          await User.findByIdAndUpdate(userId, { isActive: true, lastSeen: new Date() });
          io.emit('user_status_change', { userId, isOnline: true, lastSeen: new Date() });
        }
      } catch (error) {
        console.error(`Error in user-online for ${userId}:`, error.message);
      }
    });

    // Join a chat room
    socket.on('join-chat', ({ chatId }) => {
      if (!chatId) {
        console.warn(`User ${socket.id} tried to join chat without chatId`);
        return;
      }
      socket.join(chatId);
      console.log(`User ${socket.id} joined chat ${chatId}`);
    });

    // Listen for a new message (via socket - for real-time, but don't save as REST API handles persistence)
    socket.on('new-message', async ({ chatId, senderId, content, attachment, isAnonymous, tempId, replyTo }) => {
      try {
        // Update sender's activity timestamp
        if (senderId) {
          updateUserActivity(senderId);
        }
        
        const chat = await Chat.findById(chatId);
        if (!chat) {
          // Handle error: chat not found
          return;
        }

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

        // Fetch replyTo data if provided
        let replyToData = null;
        if (replyTo && mongoose.Types.ObjectId.isValid(replyTo)) {
          const replyMessage = await Message.findById(replyTo).populate('sender', 'username').select('content sender attachment');
          if (replyMessage) {
            replyToData = {
              _id: replyMessage._id,
              content: replyMessage.content,
              sender: {
                username: replyMessage.sender?.username || 'Unknown'
              },
              attachment: replyMessage.attachment
            };
          }
        }

        const broadcastMessage = {
            _id: messageId,
            chat: chatId,
            sender: senderData,
            content: content || '',
            attachment: attachment || null,
            isAnonymous: isAnonymous || false,
            createdAt: new Date().toISOString(),
            readBy: [senderId],
            replyTo: replyToData,
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
    
    // Handle typing indicators with error handling
    socket.on('typing', ({ chatId, username, userId }) => {
      try {
        if (userId) {
          updateUserActivity(userId);
        }
        if (chatId) {
          socket.to(chatId).emit('user-typing', { username });
        }
      } catch (error) {
        console.error('Error in typing event:', error.message);
      }
    });
    
    socket.on('stop-typing', ({ chatId }) => {
      try {
        if (chatId) {
          socket.to(chatId).emit('user-stop-typing');
        }
      } catch (error) {
        console.error('Error in stop-typing event:', error.message);
      }
    });

   // Handle voice call signaling for private chats
   socket.on('voice-call-offer', ({ chatId, offer, caller }) => {
     try {
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
     } catch (error) {
       console.error('Error in voice-call-offer:', error.message);
     }
   });

   socket.on('voice-call-answer', ({ chatId, answer }) => {
     try {
       if (chatId) {
         socket.to(chatId).emit('voice-call-answer', { answer });
       }
     } catch (error) {
       console.error('Error in voice-call-answer:', error.message);
     }
   });

   socket.on('voice-call-ice-candidate', ({ chatId, candidate }) => {
     try {
       if (chatId) {
         socket.to(chatId).emit('voice-call-ice-candidate', { candidate });
       }
     } catch (error) {
       console.error('Error in voice-call-ice-candidate:', error.message);
     }
   });

   socket.on('voice-call-end', ({ chatId }) => {
     try {
       if (chatId) {
         socket.to(chatId).emit('voice-call-end');
       }
     } catch (error) {
       console.error('Error in voice-call-end:', error.message);
     }
   });

   // Handle user disconnecting
   socket.on('disconnect', async (reason) => {
     console.log(`✗ User disconnected: ${socket.id}, reason: ${reason}`);
     for (const userId in users) {
       if (users[userId] === socket.id) {
         delete users[userId];
         // Update user's status in the database
         try {
           const lastSeen = new Date();
           await User.findByIdAndUpdate(userId, { isActive: false, lastSeen });
           io.emit('user_status_change', { userId, isOnline: false, lastSeen });
         } catch (error) {
           console.error(`Error updating user ${userId} status on disconnect:`, error.message);
         }
         break;
       }
     }
   });
  });
};