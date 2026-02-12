# Performance Optimization Guide

This document describes the database indexing, pagination, and caching strategies implemented to improve application performance.

## Table of Contents

1. [Database Indexes](#database-indexes)
2. [Pagination](#pagination)
3. [Caching Layer](#caching-layer)
4. [Usage Examples](#usage-examples)
5. [Monitoring](#monitoring)

---

## Database Indexes

All MongoDB models have been updated with appropriate indexes to optimize query performance.

### User Model

```javascript
UserSchema.index({ username: 1 });           // Username lookup
UserSchema.index({ email: 1 });             // Email lookup
UserSchema.index({ firebaseUid: 1 });       // Firebase auth
UserSchema.index({ suspended: 1, isActive: 1 }); // Account status
UserSchema.index({ createdAt: -1 });        // Sorting by date
UserSchema.index({ followers: 1 });         // Follower counts
UserSchema.index({ following: 1 });         // Following counts
UserSchema.index({ interests: 1 });        // Interest-based queries
UserSchema.index({ username: 'text', bio: 'text' }); // Full-text search
```

### Chat Model

```javascript
ChatSchema.index({ participants: 1 });      // User's chats
ChatSchema.index({ participants: 1, createdAt: -1 }); // Recent chats per user
ChatSchema.index({ relatedCommunity: 1 }); // Community chats
ChatSchema.index({ isGroupChat: 1, createdAt: -1 }); // Group chat listing
ChatSchema.index({ expiresAt: 1 }, { sparse: true }); // Temporary chats
```

### Message Model

```javascript
MessageSchema.index({ chat: 1, createdAt: -1 }); // Chat messages (most common)
MessageSchema.index({ sender: 1, createdAt: -1 }); // User's messages
MessageSchema.index({ chat: 1, readBy: 1 }); // Unread counts
MessageSchema.index({ createdAt: -1 }); // Message timeline
```

### Post Model

```javascript
PostSchema.index({ author: 1, createdAt: -1 }); // User's posts
PostSchema.index({ isPublic: 1, createdAt: -1 }); // Public feed
PostSchema.index({ likes: 1 }); // Popular posts
PostSchema.index({ 'reactions.type': 1 }); // Reaction filtering
PostSchema.index({ tags: 1 }); // Tagged posts
PostSchema.index({ 'comments.category': 1 }); // Category filtering
PostSchema.index({ content: 'text' }); // Content search
```

### Notification Model

```javascript
NotificationSchema.index({ recipient: 1, createdAt: -1 }); // User notifications
NotificationSchema.index({ recipient: 1, isRead: 1 }); // Unread count
NotificationSchema.index({ sender: 1, createdAt: -1 }); // Activity from user
NotificationSchema.index({ type: 1, createdAt: -1 }); // Notification type
```

### Story Model

```javascript
StorySchema.index({ author: 1, createdAt: -1 }); // User's stories
StorySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL (auto-delete)
```

### Community Model

```javascript
CommunitySchema.index({ name: 1 }); // Community lookup
CommunitySchema.index({ creator: 1, createdAt: -1 }); // User's communities
CommunitySchema.index({ members: 1 }); // Member count
CommunitySchema.index({ isPrivate: 1, createdAt: -1 }); // Public communities
CommunitySchema.index({ name: 'text', description: 'text' }); // Search
```

### AlbumPhoto Model

```javascript
AlbumPhotoSchema.index({ user: 1, createdAt: -1 }); // User's album
```

---

## Pagination

The `pagination.js` utility provides consistent pagination across all API routes.

### Usage

```javascript
const { parsePaginationParams, buildPaginatedResponse, paginateQuery } = require('./utils/pagination');

// In your route handler
router.get('/posts', async (req, res, next) => {
  try {
    const params = parsePaginationParams(req.query);
    
    const query = Post.find({ isPublic: true });
    paginateQuery(query, params);
    
    const posts = await query;
    const total = await Post.countDocuments({ isPublic: true });
    
    res.json(buildPaginatedResponse(posts, total, params));
  } catch (error) {
    next(error);
  }
});
```

### Query Parameters

- `page` (default: 1) - Page number
- `limit` (default: 20, max: 100) - Items per page

### Response Format

```json
{
  "data": [...],
  "pagination": {
    "currentPage": 1,
    "totalPages": 10,
    "totalItems": 200,
    "itemsPerPage": 20,
    "hasNextPage": true,
    "hasPrevPage": false,
    "nextPage": 2,
    "prevPage": null
  }
}
```

---

## Caching Layer

The `cache.js` utility provides Redis-based caching with in-memory fallback.

### Configuration

Add to your `.env` file:

```env
REDIS_URL=redis://localhost:6379
# Or for cloud Redis:
# REDIS_URL=redis://user:password@host:port
```

### Basic Usage

```javascript
const { getCache, setCache, cacheQuery, deleteCachePattern } = require('./utils/cache');

// Simple cache get/set
const cached = await getCache('user:123');
await setCache('user:123', userData, 300); // 5 minutes TTL

// Cache database query
const result = await cacheQuery(
  'posts:user:123',
  async () => {
    return Post.find({ author: '123' }).exec();
  },
  300 // TTL in seconds
);

console.log(result.fromCache); // true if from cache

// Invalidate cache
await deleteCachePattern('posts:user:123:*');
```

### Cached Route Handler

```javascript
const { createCachedPaginatedRoute, cacheKeyGenerators } = require('./utils/cached-route');

router.get(
  '/posts',
  createCachedPaginatedRoute({
    getQuery: (req, params) => {
      return Post.find({ author: req.user._id })
        .sort({ createdAt: -1 })
        .skip(params.skip)
        .limit(params.limit);
    },
    getCount: (req) => {
      return Post.countDocuments({ author: req.user._id });
    },
    cacheKeyPrefix: 'posts',
    cacheTTL: 300
  })
);
```

---

## Usage Examples

### Using Pagination and Caching Together

```javascript
router.get('/notifications', async (req, res, next) => {
  try {
    const params = parsePaginationParams(req.query);
    const cacheKey = `notifications:${req.user._id}:${params.page}`;
    
    // Try cache first
    const cached = await cacheQuery(cacheKey, async () => {
      const [notifications, total] = await Promise.all([
        Notification.find({ recipient: req.user._id })
          .sort({ createdAt: -1 })
          .skip(params.skip)
          .limit(params.limit)
          .populate('sender', 'username avatar'),
        Notification.countDocuments({ recipient: req.user._id })
      ]);
      return buildPaginatedResponse(notifications, total, params);
    }, 60); // 1 minute cache for notifications
    
    res.json(cached.data);
  } catch (error) {
    next(error);
  }
});

// Invalidate on new notification
router.post('/notifications', async (req, res) => {
  // ... create notification ...
  
  // Invalidate user's notification cache
  await deleteCachePattern(`notifications:${userId}:*`);
});
```

### N+1 Query Prevention

Instead of:
```javascript
// BAD: N+1 query
const posts = await Post.find();
for (const post of posts) {
  const author = await User.findById(post.author); // Separate query per post!
}
```

Use:
```javascript
// GOOD: Single query with population
const posts = await Post.find()
  .populate('author', 'username avatar')
  .lean(); // Use lean() for read-only queries (faster)
```

---

## Monitoring

### Check Index Usage

Run this in MongoDB shell to check index efficiency:

```javascript
db.posts.find({ isPublic: true }).sort({ createdAt: -1 }).explain('executionStats')
```

### Cache Statistics

Add to your monitoring:

```javascript
const { getCache, setCache } = require('./utils/cache');

// Log cache hits/misses
const originalGet = getCache;
getCache = async (key) => {
  const start = Date.now();
  const result = await originalGet(key);
  const duration = Date.now() - start;
  console.log(`Cache ${result ? 'HIT' : 'MISS'} for ${key} (${duration}ms)`);
  return result;
};
```

---

## Performance Tips

1. **Use `lean()` for read-only queries**: `Post.find(...).lean()` returns plain objects instead of Mongoose documents.

2. **Select only needed fields**: `Post.find().select('title content createdAt')`

3. **Limit population depth**: `User.find().populate('posts', null, null, { limit: 10 })`

4. **Use cursor pagination for infinite scroll**: See `cursorPaginate` in pagination.js

5. **Set appropriate TTLs**:
   - Frequently changing data: 30-60 seconds
   - User profiles: 5-10 minutes
   - Static content: 1 hour or more

6. **Monitor cache memory**: Set `maxmemory` in Redis config if needed.

---

## Running Index Creation

To create all indexes:

```bash
npm run create-indexes
```

This will display all current indexes for all models.
