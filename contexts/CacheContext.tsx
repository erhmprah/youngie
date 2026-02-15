import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { cacheService, CACHE_KEYS, CACHE_TTL } from '../utils/cache';
import { useAuth } from './AuthContext';

interface CacheContextType {
  // Invalidation methods
  invalidateUserCache: (userId?: string) => Promise<void>;
  invalidateProfileCache: (userId: string) => Promise<void>;
  invalidatePostsCache: () => Promise<void>;
  invalidateNotificationsCache: () => Promise<void>;
  invalidateChatsCache: () => Promise<void>;
  invalidateCommunitiesCache: () => Promise<void>;
  invalidateStoriesCache: () => Promise<void>;
  invalidateAllUserData: () => Promise<void>;
  
  // Clear all cache
  clearAllCache: () => Promise<void>;
  
  // Cache statistics
  cacheSize: number;
  refreshCacheSize: () => Promise<void>;
  
  // Preload data
  preloadProfile: (userId: string) => Promise<void>;
}

const CacheContext = createContext<CacheContextType | undefined>(undefined);

/**
 * Provider component for cache management
 * Handles automatic cache invalidation when user data changes
 */
export function CacheProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [cacheSize, setCacheSize] = useState(0);

  const refreshCacheSize = useCallback(async () => {
    const size = await cacheService.getSize();
    setCacheSize(size);
  }, []);

  useEffect(() => {
    refreshCacheSize();
  }, [refreshCacheSize]);

  // Invalidate user cache
  const invalidateUserCache = useCallback(async (userId?: string) => {
    if (userId) {
      await cacheService.invalidateByPrefix(`${CACHE_KEYS.USER}${userId}`);
    } else if (user?._id) {
      await cacheService.invalidateByPrefix(CACHE_KEYS.USER);
    }
    await refreshCacheSize();
  }, [user?._id, refreshCacheSize]);

  // Invalidate specific profile
  const invalidateProfileCache = useCallback(async (userId: string) => {
    await cacheService.invalidateByPrefix(`${CACHE_KEYS.PROFILE}${userId}`);
    await refreshCacheSize();
  }, [refreshCacheSize]);

  // Invalidate posts cache
  const invalidatePostsCache = useCallback(async () => {
    await cacheService.invalidateByPrefix(CACHE_KEYS.POSTS);
    await refreshCacheSize();
  }, [refreshCacheSize]);

  // Invalidate notifications cache
  const invalidateNotificationsCache = useCallback(async () => {
    await cacheService.invalidateByPrefix(CACHE_KEYS.NOTIFICATIONS);
    await refreshCacheSize();
  }, [refreshCacheSize]);

  // Invalidate chats cache
  const invalidateChatsCache = useCallback(async () => {
    await cacheService.invalidateByPrefix(CACHE_KEYS.CHATS);
    await refreshCacheSize();
  }, [refreshCacheSize]);

  // Invalidate communities cache
  const invalidateCommunitiesCache = useCallback(async () => {
    await cacheService.invalidateByPrefix(CACHE_KEYS.COMMUNITIES);
    await refreshCacheSize();
  }, [refreshCacheSize]);

  // Invalidate stories cache
  const invalidateStoriesCache = useCallback(async () => {
    await cacheService.invalidateByPrefix(CACHE_KEYS.STORIES);
    await refreshCacheSize();
  }, [refreshCacheSize]);

  // Invalidate all user-related cache (for logout or major changes)
  const invalidateAllUserData = useCallback(async () => {
    await Promise.all([
      cacheService.invalidateByPrefix(CACHE_KEYS.USER),
      cacheService.invalidateByPrefix(CACHE_KEYS.PROFILE),
      cacheService.invalidateByPrefix(CACHE_KEYS.POSTS),
      cacheService.invalidateByPrefix(CACHE_KEYS.NOTIFICATIONS),
      cacheService.invalidateByPrefix(CACHE_KEYS.CHATS),
      cacheService.invalidateByPrefix(CACHE_KEYS.COMMUNITIES),
      cacheService.invalidateByPrefix(CACHE_KEYS.STORIES),
      cacheService.invalidateByPrefix(CACHE_KEYS.SETTINGS),
    ]);
    await refreshCacheSize();
  }, [refreshCacheSize]);

  // Clear all cache
  const clearAllCache = useCallback(async () => {
    await cacheService.clearAll();
    await refreshCacheSize();
  }, [refreshCacheSize]);

  // Preload profile data (for faster navigation)
  const preloadProfile = useCallback(async (userId: string) => {
    // Only preload if we have a current user and it's a different profile
    if (!user?._id || userId === user._id) return;
    
    const cacheKey = `${CACHE_KEYS.PROFILE}${userId}`;
    const { isExpired } = await cacheService.get(cacheKey);
    
    // If cache doesn't exist or is expired, we could preload here
    // For now, just mark that we could do it
    if (isExpired) {
      // Preloading would require access to the API fetch function
      // This is handled in the profile screen component
    }
  }, [user?._id]);

  return (
    <CacheContext.Provider
      value={{
        invalidateUserCache,
        invalidateProfileCache,
        invalidatePostsCache,
        invalidateNotificationsCache,
        invalidateChatsCache,
        invalidateCommunitiesCache,
        invalidateStoriesCache,
        invalidateAllUserData,
        clearAllCache,
        cacheSize,
        refreshCacheSize,
        preloadProfile,
      }}
    >
      {children}
    </CacheContext.Provider>
  );
}

/**
 * Hook to access cache context
 */
export function useCache() {
  const context = useContext(CacheContext);
  if (!context) {
    throw new Error('useCache must be used within a CacheProvider');
  }
  return context;
}

// Export cache key utilities for use in components
export { CACHE_KEYS, CACHE_TTL };
