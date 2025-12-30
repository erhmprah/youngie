const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http'); // Import http module
const { Server } = require('socket.io'); // Import Server from socket.io
require('dotenv').config();

const app = express();
const httpServer = http.createServer(app); // Create http server
const io = new Server(httpServer, {
  cors: {
    origin: '*', // Allow all origins for now, refine later
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static('uploads'));

// MongoDB Connection
const connectDB = async () => {
  try {
    console.log('Attempting to connect to MongoDB...');
    console.log('URI:', process.env.MONGODB_URI);
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✓ MongoDB Connected');
  } catch (error) {
    console.error('✗ MongoDB Connection Error:', error.message);
    // Don't exit, allow the server to run without DB
  }
};

connectDB();

// Import Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const chatRoutes = require('./routes/chats');
const postRoutes = require('./routes/posts');
const notificationRoutes = require('./routes/notifications');
const storyRoutes = require('./routes/stories');
const communityRoutes = require('./routes/communities');

// Use Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/communities', communityRoutes);

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'Server is running', timestamp: new Date() });
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});


// Socket.io integration
require('./sockets/videoChat')(io); // Pass the io instance to the socket handler
require('./sockets/chat')(io); // Pass the io instance to the socket handler

const PORT = 5000;
const HOST = process.env.HOST || '0.0.0.0';
httpServer.listen(PORT, HOST, () => { // Change app.listen to httpServer.listen
  console.log(`🚀 Server running on ${HOST}:${PORT}`);
});
