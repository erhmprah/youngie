/**
 * Redis Client Manager
 * Manages Redis connection with connection pooling and reconnection logic
 */

let redisClient = null;
let isConnecting = false;

/**
 * Get or create Redis client
 * @returns {Promise<Object>} - Redis client instance
 */
const getClient = async () => {
  const Redis = require('ioredis');
  
  if (redisClient && redisClient.status === 'ready') {
    return redisClient;
  }
  
  if (isConnecting) {
    // Wait for existing connection attempt
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (redisClient && redisClient.status === 'ready') {
      return redisClient;
    }
    throw new Error('Redis connection still in progress');
  }
  
  isConnecting = true;
  
  try {
    redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      lazyConnect: true,
      // Connection pooling - reuse connections
      connections: null,
    });
    
    redisClient.on('error', (err) => {
      console.error('Redis connection error:', err.message);
    });
    
    redisClient.on('connect', () => {
      console.log('Redis connected');
      isConnecting = false;
    });
    
    redisClient.on('close', () => {
      console.log('Redis connection closed');
      redisClient = null;
    });
    
    await redisClient.connect();
    return redisClient;
  } catch (error) {
    isConnecting = false;
    console.error('Redis connection failed:', error.message);
    throw error;
  }
};

/**
 * Close Redis connection
 */
const closeClient = async () => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
};

/**
 * Health check for Redis
 * @returns {Promise<boolean>}
 */
const isHealthy = async () => {
  try {
    const client = await getClient();
    const result = await client.ping();
    return result === 'PONG';
  } catch (error) {
    return false;
  }
};

module.exports = {
  getClient,
  closeClient,
  isHealthy
};
