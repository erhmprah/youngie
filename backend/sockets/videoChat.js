module.exports = (io) => {
  let waitingUsers = []; // Users waiting for a match
  let activeChats = new Map(); // Maps socket.id to peer socket.id

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Add user to waiting list
    socket.on('join_room', () => {
      console.log(`User ${socket.id} joined waiting room.`);
      waitingUsers.push(socket.id);
      attemptMatch();
    });

    // WebRTC Signaling
    socket.on('offer', (offer, peerId) => {
      console.log(`Offer from ${socket.id} to ${peerId}`);
      io.to(peerId).emit('offer', offer, socket.id);
    });

    socket.on('answer', (answer, peerId) => {
      console.log(`Answer from ${socket.id} to ${peerId}`);
      io.to(peerId).emit('answer', answer, socket.id);
    });

    socket.on('ice_candidate', (candidate, peerId) => {
      console.log(`ICE candidate from ${socket.id} to ${peerId}`);
      io.to(peerId).emit('ice_candidate', candidate, socket.id);
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
      // Add back to waiting queue and try to match
      waitingUsers.push(socket.id);
      attemptMatch();
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
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

    // Matching logic
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

          io.to(user1Id).emit('match_found', user2Id);
          io.to(user2Id).emit('match_found', user1Id);
        } else {
          // One or both disconnected while waiting, put remaining back
          if (user1Socket) waitingUsers.push(user1Id);
          if (user2Socket) waitingUsers.push(user2Id);
          attemptMatch(); // Try matching again
        }
      }
    };
  });
};
