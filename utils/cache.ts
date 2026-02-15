import AsyncStorage from '@react-native-async-storage/async-storage';

// Cache configuration - TTL in milliseconds
export const CACHE_TTL = {
  // 5 minutes for frequently changing data
  SHORT: 5 * 60 * 1000,
  // 15 minutes for profile data
  PROFILE: 15 * 60 * 1000,
  // 30 minutes for feed data
  FEED: 30 * 60 * 1000,
  // 1 hour for static content
  LONG: 60 * 60 * 1000,
  // No cache (always fetch)
  NONE: 0,
};

// Cache key prefixes
export const CACHE_KEYS = {
  USER: 'cache_user_',
  PROFILE: 'cache_profile_',
  POSTS: 'cache_posts_',
  NOTIFICATIONS: 'cache_notifications_',
  CHATS: 'cache_chats_',
  COMMUNITIES: 'cache_communities_',
  STORIES: 'cache_stories_',
  SETTINGS: 'cache_settings_',
  EXPIRED: 'cache_expired_',
};

// Cache metadata
interface CacheMetadata {
  timestamp: number;
  ttl: number;
  key: string;
}

/**
 * Cache Service - Provides persistent caching using AsyncStorage
 */
export const cacheService = {
  /**
   * Get cached data if still valid
   */
  async get<T>(key: string): Promise<{ data: T | null; isExpired: boolean }> {
    try {
      const cachedData = await AsyncStorage.getItem(key);
      const metadataKey = `${CACHE_KEYS.EXPIRED}${key}`;
      const metadataStr = await AsyncStorage.getItem(metadataKey);
      
      if (!cachedData || !metadataStr) {
        return { data: null, isExpired: true };
      }
      
      const metadata: CacheMetadata = JSON.parse(metadataStr);
      const now = Date.now();
      const isExpired = now - metadata.timestamp > metadata.ttl;
      
      if (isExpired) {
        // Don't delete immediately, let stale-while-revalidate work
        return { data: JSON.parse(cachedData), isExpired: true };
      }
      
      return { data: JSON.parse(cachedData), isExpired: false };
    } catch (error) {
      console.error('Cache get error:', error);
      return { data: null, isExpired: true };
    }
  },

  /**
   * Set data in cache with TTL
   */
  async set<T>(key: string, data: T, ttl: number = CACHE_TTL.SHORT): Promise<void> {
    try {
      if (ttl === CACHE_TTL.NONE) return;
      
      await AsyncStorage.setItem(key, JSON.stringify(data));
      
      const metadata: CacheMetadata = {
        timestamp: Date.now(),
        ttl,
        key,
      };
      
      const metadataKey = `${CACHE_KEYS.EXPIRED}${key}`;
      await AsyncStorage.setItem(metadataKey, JSON.stringify(metadata));
    } catch (error) {
      console.error('Cache set error:', error);
    }
  },

  /**
   * Remove specific cache entry
   */
  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.multiRemove([key, `${CACHE_KEYS.EXPIRED}${key}`]);
    } catch (error) {
      console.error('Cache remove error:', error);
    }
  },

  /**
   * Invalidate all cache entries with a specific prefix
   */
  async invalidateByPrefix(prefix: string): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const keysToRemove = allKeys.filter(key => 
        key.startsWith(prefix) || key.startsWith(`${CACHE_KEYS.EXPIRED}${prefix}`)
      );
      
      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
      }
    } catch (error) {
      console.error('Cache invalidate error:', error);
    }
  },

  /**
   * Clear all cache
   */
  async clearAll(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => 
        key.startsWith('cache_')
      );
      
      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
      }
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  },

  /**
   * Get cache size (number of entries)
   */
  async getSize(): Promise<number> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      return allKeys.filter(key => key.startsWith('cache_')).length;
    } catch (error) {
      console.error('Cache size error:', error);
      return 0;
    }
  },

  /**
   * Check if cache exists and is valid
   */
  async hasValid(key: string): Promise<boolean> {
    const { isExpired } = await this.get(key);
    return !isExpired;
  },
};

/**
 * Generate cache key for user profile
 */
export const getUserCacheKey = (userId: string): string => 
  `${CACHE_KEYS.PROFILE}${userId}`;

/**
 * Generate cache key for posts
 */
export const getPostsCacheKey = (page: number = 1, isAnonymous?: boolean): string => 
  `${CACHE_KEYS.POSTS}${isAnonymous ? 'anonymous' : 'public'}_page${page}`;

/**
 * Generate cache key for notifications
 */
export const getNotificationsCacheKey = (): string => 
  `${CACHE_KEYS.NOTIFICATIONS}all`;

/**
 * Generate cache key for user chats
 */
export const getChatsCacheKey = (userId: string): string => 
  `${CACHE_KEYS.CHATS}${userId}`;

/**
 * Generate cache key for community
 */
export const getCommunityCacheKey = (communityId: string): string => 
  `${CACHE_KEYS.COMMUNITIES}${communityId}`;

/**
 * Generate cache key for stories
 */
export const getStoriesCacheKey = (userId?: string): string => 
  userId ? `${CACHE_KEYS.STORIES}user_${userId}` : `${CACHE_KEYS.STORIES}all`;
