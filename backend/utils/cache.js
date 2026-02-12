/**
 * Redis Caching Layer
 * Provides caching for frequently accessed data
 */

const mongoose = require('mongoose');

// In-memory cache fallback for when Redis is not available
const memoryCache = new Map();
const CACHE_TTL = 300; // 5 minutes default TTL

/**
 * Check if Redis is available
 */
const isRedisAvailable = () => {
  return process.env.REDIS_URL && process.env.REDIS_URL !== '';
};

/**
 * Get value from cache
 * @param {string} key - Cache key
 * @returns {Promise<any>} - Cached value or null
 */
const getCache = async (key) => {
  try {
    if (isRedisAvailable()) {
      const redis = require('./redis-client');
      const client = await redis.getClient();
      const value = await client.get(key);
      return value ? JSON.parse(value) : null;
    } else {
      // Fallback to memory cache
      const cached = memoryCache.get(key);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.value;
      }
      memoryCache.delete(key);
      return null;
    }
  } catch (error) {
    console.error('Cache get error:', error);
    return null;
  }
};

/**
 * Set value in cache
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} ttl - Time to live in seconds (optional)
 * @returns {Promise<boolean>}
 */
const setCache = async (key, value, ttl = CACHE_TTL) => {
  try {
    if (isRedisAvailable()) {
      const redis = require('./redis-client');
      const client = await redis.getClient();
      await client.setEx(key, ttl, JSON.stringify(value));
    } else {
      // Fallback to memory cache
      memoryCache.set(key, {
        value,
        expiresAt: Date.now() + (ttl * 1000)
      });
    }
    return true;
  } catch (error) {
    console.error('Cache set error:', error);
    return false;
  }
};

/**
 * Delete value from cache
 * @param {string} key - Cache key
 * @returns {Promise<boolean>}
 */
const deleteCache = async (key) => {
  try {
    if (isRedisAvailable()) {
      const redis = require('./redis-client');
      const client = await redis.getClient();
      await client.del(key);
    } else {
      memoryCache.delete(key);
    }
    return true;
  } catch (error) {
    console.error('Cache delete error:', error);
    return false;
  }
};

/**
 * Delete multiple keys matching a pattern
 * @param {string} pattern - Key pattern (e.g., 'user:*')
 * @returns {Promise<boolean>}
 */
const deleteCachePattern = async (pattern) => {
  try {
    if (isRedisAvailable()) {
      const redis = require('./redis-client');
      const client = await redis.getClient();
      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        await client.del(keys);
      }
    } else {
      // For memory cache, iterate and delete matching keys
      const regex = new RegExp(pattern.replace('*', '.*'));
      for (const key of memoryCache.keys()) {
        if (regex.test(key)) {
          memoryCache.delete(key);
        }
      }
    }
    return true;
  } catch (error) {
    console.error('Cache pattern delete error:', error);
    return false;
  }
};

/**
 * Cache wrapper for database queries
 * @param {string} key - Cache key
 * @param {Function} fetchFn - Function to fetch data if cache miss
 * @param {number} ttl - Time to live in seconds
 * @returns {Promise<any>} - Cached or fetched data
 */
const cacheQuery = async (key, fetchFn, ttl = CACHE_TTL) => {
  const cached = await getCache(key);
  if (cached !== null) {
    return { data: cached, fromCache: true };
  }
  
  const data = await fetchFn();
  await setCache(key, data, ttl);
  return { data, fromCache: false };
};

/**
 * Invalidate cache for a specific model
 * @param {string} modelName - Model name (e.g., 'User', 'Post')
 * @param {string} id - Document ID
 */
const invalidateModelCache = async (modelName, id) => {
  await deleteCache(`${modelName.toLowerCase()}:${id}`);
};

/**
 * Generate cache key for a query
 * @param {string} model - Model name
 * @param {Object} params - Query parameters
 * @returns {string} - Cache key
 */
const generateCacheKey = (model, params) => {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${JSON.stringify(params[key])}`)
    .join('&');
  return `${model.toLowerCase()}:${Buffer.from(sortedParams).toString('base64')}`;
};

/**
 * Middleware to add caching to Express routes
 * @param {string} keyPrefix - Prefix for cache key
 * @param {number} ttl - Cache TTL in seconds
 */
const cacheMiddleware = (keyPrefix, ttl = CACHE_TTL) => {
  return async (req, res, next) => {
    const cacheKey = `${keyPrefix}:${req.originalUrl}`;
    
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }
    
    // Store original json method
    const originalJson = res.json.bind(res);
    
    // Override json method to cache response
    res.json = (data) => {
      setCache(cacheKey, data, ttl);
      return originalJson(data);
    };
    
    next();
  };
};

/**
 * Clear all cache (useful for testing or resets)
 */
const clearAllCache = async () => {
  if (isRedisAvailable()) {
    const redis = require('./redis-client');
    const client = await redis.getClient();
    await client.flushall();
  } else {
    memoryCache.clear();
  }
};

module.exports = {
  getCache,
  setCache,
  deleteCache,
  deleteCachePattern,
  cacheQuery,
  invalidateModelCache,
  generateCacheKey,
  cacheMiddleware,
  clearAllCache,
  CACHE_TTL
};
