module.exports = (io) => {
  let waitingUsers = []; // Users waiting for a match
  let activeChats = new Map(); // Maps socket.id to peer socket.id

  // Move attemptMatch outside of connection handler so it's shared across all connections
  const attemptMatch = () => {
    if (waitingUsers.length >= 2) {
      const user1Id = waitingUsers.shift();
      const user2Id = waitingUsers.shift();

      // Ensure both users are still connected
      const user1Socket = io.sockets.sockets.get(user1Id);
      const user2Socket = io.sockets.sockets.get(user2Id);

      if (user1Socket && user2Socket) {
        console.log(`Matching ${user1Id} with ${user2Id}`);
        activeChats.set(user1Id, user2Id);
        activeChats.set(user2Id, user1Id);

        io.to(user1Id).emit('match_found', { peerId: user2Id, initiator: true });
        io.to(user2Id).emit('match_found', { peerId: user1Id, initiator: false });
      } else {
        // One or both disconnected while waiting, put remaining back
        if (user1Socket) waitingUsers.push(user1Id);
        if (user2Socket) waitingUsers.push(user2Id);
        attemptMatch(); // Try matching again
      }
    }
  };

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Handle connection errors (server-side)
    socket.on('connect_error', (error) => {
      console.error(`Connection error for ${socket.id}:`, error.message);
    });

    // Handle disconnect errors
    socket.on('disconnect', (reason) => {
      console.log(`Socket disconnected: ${socket.id}, reason: ${reason}`);
      // Remove from waiting list
      waitingUsers = waitingUsers.filter((id) => id !== socket.id);

      // Notify peer if in an active chat
      const peerId = activeChats.get(socket.id);
      if (peerId) {
        io.to(peerId).emit('peer_disconnected');
        activeChats.delete(peerId);
      }
      activeChats.delete(socket.id);
    });

    // Handle socket-level errors - this is the proper way to catch errors
    socket.on('error', (error) => {
      console.error(`Socket error for ${socket.id}:`, error.message || error);
      // Clean up the socket from waiting list
      waitingUsers = waitingUsers.filter((id) => id !== socket.id);
      // Notify peer if in an active chat
      const peerId = activeChats.get(socket.id);
      if (peerId) {
        io.to(peerId).emit('peer_disconnected');
        activeChats.delete(peerId);
      }
      activeChats.delete(socket.id);
    });

    // Handle unexpected errors with try-catch wrapper
    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception in socket handler:', error);
    });

    process.on('unhandledRejection', (reason) => {
      console.error('Unhandled rejection in socket handler:', reason);
    });

    // Add user to waiting list
    socket.on('join_room', () => {
      console.log(`User ${socket.id} joined waiting room.`);
      // Avoid duplicate entries
      if (!waitingUsers.includes(socket.id)) {
        waitingUsers.push(socket.id);
        attemptMatch();
      }
    });

    // WebRTC Signaling with error handling
    socket.on('offer', (offer, peerId) => {
      try {
        console.log(`Offer from ${socket.id} to ${peerId}`);
        io.to(peerId).emit('offer', offer, socket.id);
      } catch (error) {
        console.error(`Error sending offer from ${socket.id}:`, error.message);
        socket.emit('socket_error', { message: 'Failed to send offer' });
      }
    });

    socket.on('answer', (answer, peerId) => {
      try {
        console.log(`Answer from ${socket.id} to ${peerId}`);
        io.to(peerId).emit('answer', answer, socket.id);
      } catch (error) {
        console.error(`Error sending answer from ${socket.id}:`, error.message);
        socket.emit('socket_error', { message: 'Failed to send answer' });
      }
    });

    socket.on('ice_candidate', (candidate, peerId) => {
      try {
        console.log(`ICE candidate from ${socket.id} to ${peerId}`);
        io.to(peerId).emit('ice_candidate', candidate, socket.id);
      } catch (error) {
        console.error(`Error sending ICE candidate from ${socket.id}:`, error.message);
        socket.emit('socket_error', { message: 'Failed to send ICE candidate' });
      }
    });

    // Request next peer
    socket.on('next_peer', () => {
      console.log(`User ${socket.id} requested next peer.`);
      // Disconnect from current peer if any
      const currentPeer = activeChats.get(socket.id);
      if (currentPeer) {
        io.to(currentPeer).emit('peer_disconnected');
        activeChats.delete(currentPeer);
        activeChats.delete(socket.id);
      }
      // Remove from waiting list if already there to avoid duplicates
      waitingUsers = waitingUsers.filter((id) => id !== socket.id);
      // Add back to waiting queue and try to match
      waitingUsers.push(socket.id);
      attemptMatch();
    });

    // Notify peer when user ends the call
    socket.on('peer_disconnected', (peerId) => {
      try {
        if (peerId) {
          io.to(peerId).emit('peer_disconnected');
          activeChats.delete(peerId);
        }
      } catch (error) {
        console.error(`Error sending peer_disconnected from ${socket.id}:`, error.message);
      }
    });
  });
};
