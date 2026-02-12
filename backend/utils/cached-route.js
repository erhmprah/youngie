/**
 * Cached Route Handler
 * Example showing how to use pagination and caching together
 */

const { parsePaginationParams, buildPaginatedResponse } = require('./pagination');
const { cacheQuery, deleteCachePattern, generateCacheKey } = require('./cache');

/**
 * Create a cached paginated route handler
 * @param {Object} options
 * @param {Function} options.getQuery - Function that returns a Mongoose query
 * @param {Function} options.getCount - Function that returns a count query
 * @param {string} options.cacheKeyPrefix - Prefix for cache key
 * @param {number} options.cacheTTL - Cache TTL in seconds
 */
const createCachedPaginatedRoute = (options) => {
  const { getQuery, getCount, cacheKeyPrefix, cacheTTL = 300 } = options;
  
  return async (req, res, next) => {
    try {
      const params = parsePaginationParams(req.query);
      const cacheKey = `${cacheKeyPrefix}:${generateCacheKey(cacheKeyPrefix, req.query)}`;
      
      // Try to get from cache first
      const cached = await cacheQuery(cacheKey, async () => {
        const [data, total] = await Promise.all([
          getQuery(req, params).exec(),
          getCount(req).countDocuments()
        ]);
        return buildPaginatedResponse(data, total, params);
      }, cacheTTL);
      
      res.json(cached.data);
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Invalidate cache for a model after create/update/delete
 * @param {string} modelName - Model name
 * @param {Object} req - Express request
 */
const invalidateModelCache = async (modelName, req) => {
  const pattern = `${modelName.toLowerCase()}:*`;
  await deleteCachePattern(pattern);
};

/**
 * Cache key generator for common patterns
 */
const cacheKeyGenerators = {
  posts: (userId, page) => `posts:user:${userId}:page:${page}`,
  feed: (userId, page) => `feed:user:${userId}:page:${page}`,
  notifications: (userId, page) => `notifications:user:${userId}:page:${page}`,
  chats: (userId, page) => `chats:user:${userId}:page:${page}`,
  messages: (chatId, page) => `messages:chat:${chatId}:page:${page}`,
  user: (userId) => `user:${userId}`,
  community: (communityId) => `community:${communityId}`,
};

module.exports = {
  createCachedPaginatedRoute,
  invalidateModelCache,
  cacheKeyGenerators
};
