const cluster = require('cluster');
const os = require('os');

// Load Balancing Configuration
const CLUSTER_MODE = process.env.CLUSTER_MODE === 'true';
const NUM_WORKERS = process.env.NUM_WORKERS || os.cpus().length;

// Cluster mode load balancing
if (CLUSTER_MODE && cluster.isMaster) {
  console.log(`⚖️ Load Balancing Mode: Enabled`);
  console.log(`📊 Number of CPU cores: ${os.cpus().length}`);
  console.log(`👥 Starting ${NUM_WORKERS} worker processes...`);
  
  // Fork workers
  for (let i = 0; i < NUM_WORKERS; i++) {
    cluster.fork();
  }

  // Handle worker exit - restart on crash
  cluster.on('exit', (worker, code, signal) => {
    console.log(`⚠️ Worker ${worker.process.pid} died (code: ${code}, signal: ${signal}). Restarting...`);
    cluster.fork();
  });

  // Log when worker starts
  cluster.on('online', (worker) => {
    console.log(`✅ Worker ${worker.process.pid} is online`);
  });

  // Handle worker messages for load monitoring
  cluster.on('message', (worker, message) => {
    if (message.type === 'stats') {
      console.log(`📈 Worker ${worker.process.pid} stats:`, message.data);
    }
  });

  console.log(`🚀 Load balancer master process running on PID: ${process.pid}`);
  console.log(`🌐 Workers will handle incoming connections`);
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('🔴 SIGTERM received. Shutting down gracefully...');
    for (const id in cluster.workers) {
      cluster.workers[id].kill('SIGTERM');
    }
    process.exit(0);
  });

} else {
  // Worker process - run the actual server
  const express = require('express');
  const mongoose = require('mongoose');
  const cors = require('cors');
  const http = require('http');
  const { Server } = require('socket.io');
  const path = require('path');
  require('dotenv').config();

  console.log(`🔧 Worker ${process.pid} starting...`);
  console.log('   MONGODB_URI:', process.env.MONGODB_URI ? 'SET' : 'NOT SET');
  console.log('   SUPABASE_URL:', process.env.SUPABASE_URL ? 'SET' : 'NOT SET');
  console.log('   SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'SET' : 'NOT SET');

  const app = express();
  const httpServer = http.createServer(app);
  
  // Socket.IO with Redis adapter for multi-server support
  let io;
  
  if (process.env.REDIS_URL) {
    // Use Redis adapter for clustering/fan-out across multiple servers
    const { createAdapter } = require('@socket.io/redis-adapter');
    const { createClient } = require('redis');
    
    const pubClient = createClient({ url: process.env.REDIS_URL });
    const subClient = pubClient.duplicate();
    
    Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
      console.log('✅ Redis adapter connected for Socket.IO');
    }).catch(err => {
      console.warn('⚠️ Redis connection failed, using default adapter:', err.message);
    });
    
    io = new Server(httpServer, {
      cors: { origin: '*', methods: ['GET', 'POST'] },
      pingTimeout: 60000,
      pingInterval: 25000,
      transports: ['websocket', 'polling'],
      allowEIO3: true,
      adapter: createAdapter(pubClient, subClient),
    });
  } else {
    // Single server mode - use default adapter
    io = new Server(httpServer, {
      cors: { origin: '*', methods: ['GET', 'POST'] },
      pingTimeout: 60000,
      pingInterval: 25000,
      transports: ['websocket', 'polling'],
      allowEIO3: true,
    });
  }

  // Track worker stats for load balancing
  let workerStats = {
    pid: process.pid,
    connections: 0,
    memory: 0,
    uptime: process.uptime(),
  };

  io.on('error', (error) => {
    console.error(`🔴 Socket.IO Worker ${process.pid} Error:`, error.message);
  });

  io.engine.on('connection_error', (err) => {
    console.error(`🔴 Engine Connection Error Worker ${process.pid}:`, err.message);
  });

  // Track connections per worker
  io.on('connection', (socket) => {
    workerStats.connections++;
    console.log(`📱 Worker ${process.pid}: New connection (${socket.id}), total: ${workerStats.connections}`);
    
    // Send stats to master process
    if (cluster.worker) {
      cluster.worker.send({ type: 'stats', data: workerStats });
    }

    socket.on('disconnect', () => {
      workerStats.connections--;
      console.log(`📱 Worker ${process.pid}: Disconnected (${socket.id}), remaining: ${workerStats.connections}`);
    });
  });

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

  // Initialize Passport and session
  const passport = require('passport');
  const session = require('express-session');

  app.use(
    session({
      secret: process.env.JWT_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: { secure: process.env.NODE_ENV === 'production' },
    })
  );
  app.use(passport.initialize());
  app.use(passport.session());

  // Attach Socket.IO to request object
  app.use((req, res, next) => {
    req.io = io;
    req.workerPid = process.pid; // Track which worker handled request
    next();
  });

  // MongoDB Connection with Load Balancing
  const connectDB = async () => {
    try {
      console.log(`Worker ${process.pid}: Attempting to connect to MongoDB...`);
      
      // MongoDB connection options for load balancing
      const mongoOptions = {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        // Connection pooling for load balancing
        maxPoolSize: 10,
        minPoolSize: 2,
        maxIdleTimeMS: 30000,
        // Retry configuration for high availability
        retryWrites: true,
        retryReads: true,
        // Write concern for consistency
        w: 'majority',
        // Read preference for load distribution (distribute reads across secondaries)
        readPreference: 'secondaryPreferred',
        // Connection timeout
        connectTimeoutMS: 10000,
        // Socket timeout
        socketTimeoutMS: 45000,
      };

      await mongoose.connect(process.env.MONGODB_URI, mongoOptions);
      console.log(`✓ Worker ${process.pid}: MongoDB Connected with load balancing`);
      
      // Log connection pool stats periodically
      mongoose.connection.on('connected', () => {
        const pool = mongoose.connection.pool;
        if (pool) {
          console.log(`📊 MongoDB Pool: ${pool.size} connections`);
        }
      });
      
    } catch (error) {
      console.error(`✗ Worker ${process.pid}: MongoDB Connection Error:`, error.message);
      // Retry connection after 5 seconds
      console.log('🔄 Retrying MongoDB connection in 5 seconds...');
      setTimeout(connectDB, 5000);
    }
  };

  connectDB();

  // Handle MongoDB disconnection for graceful reconnection
  mongoose.connection.on('disconnected', () => {
    console.warn(`⚠️ Worker ${process.pid}: MongoDB disconnected. Attempting to reconnect...`);
  });

  mongoose.connection.on('reconnected', () => {
    console.log(`✓ Worker ${process.pid}: MongoDB reconnected`);
  });

  // Initialize Passport
  require('./config/passport');

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

  // Health Check with worker info
  app.get('/health', (req, res) => {
    workerStats.memory = process.memoryUsage().heapUsed / 1024 / 1024; // MB
    workerStats.uptime = process.uptime();
    
    res.json({ 
      status: 'Server is running', 
      timestamp: new Date(),
      worker: {
        pid: process.pid,
        connections: workerStats.connections,
        memory: workerStats.memory.toFixed(2) + ' MB',
        uptime: Math.floor(workerStats.uptime) + 's',
      }
    });
  });

  // Load balancer health check
  app.get('/health/loadbalancer', (req, res) => {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    res.json({
      status: 'healthy',
      worker: process.pid,
      metrics: {
        memory: {
          heapUsed: (memUsage.heapUsed / 1024 / 1024).toFixed(2) + ' MB',
          heapTotal: (memUsage.heapTotal / 1024 / 1024).toFixed(2) + ' MB',
          rss: (memUsage.rss / 1024 / 1024).toFixed(2) + ' MB',
        },
        cpu: cpuUsage,
        uptime: process.uptime(),
        connections: workerStats.connections,
      },
      loadBalancing: {
        mode: CLUSTER_MODE ? 'cluster' : 'single',
        workers: NUM_WORKERS,
      }
    });
  });

  // Error Handling Middleware
  app.use((err, req, res, next) => {
    console.error(`Worker ${process.pid}:`, err);
    if (err.code === 'LIMIT_FILE_SIZE') {
      const limit = req.uploadLimitMB ? `${req.uploadLimitMB}MB` : 'the allowed limit';
      return res.status(413).json({ msg: `File size exceeds limit. Maximum allowed size is ${limit}.`, code: 'LIMIT_FILE_SIZE' });
    }
    res.status(500).json({ error: err.message, worker: process.pid });
  });

  // Socket.io integration
  require('./sockets/videoChat')(io);
  require('./sockets/chat')(io);

  const PORT = process.env.PORT || 5001;
  const HOST = process.env.HOST || '0.0.0.0';

  // Global exception handlers
  process.on('uncaughtException', (error) => {
    console.error(`🔴 Worker ${process.pid} Uncaught Exception:`, error.message);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error(`🔴 Worker ${process.pid} Unhandled Rejection:`, reason);
  });

  httpServer.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`🔴 Port ${PORT} is already in use.`);
    } else {
      console.error(`🔴 Worker ${process.pid} HTTP Server Error:`, error.message);
    }
  });

  httpServer.listen(PORT, HOST, () => {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    let localIp = 'localhost';
    Object.keys(interfaces).forEach((ifname) => {
      interfaces[ifname].forEach((iface) => {
        if (iface.family === 'IPv4' && !iface.internal) {
          localIp = iface.address;
        }
      });
    });

    console.log(`🚀 Worker ${process.pid} running on ${HOST}:${PORT}`);
    console.log(`👉 Local Network URL: http://${localIp}:${PORT}`);
    
    // Send ready message to master
    if (cluster.worker) {
      cluster.worker.send({ type: 'ready', pid: process.pid });
    }
  });
}
