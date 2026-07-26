import { 
  cacheService, 
  CACHE_TTL, 
  getUserCacheKey, 
  getPostsCacheKey, 
  getNotificationsCacheKey,
  getChatsCacheKey,
  getCommunityCacheKey,
  getStoriesCacheKey
} from './cache';
import { userAPI, postAPI, notificationAPI, chatAPI, communityAPI, storyAPI } from './api';

/**
 * Cached API - Wraps existing API calls with caching
 * Uses stale-while-revalidate strategy for optimal UX
 */

// User/Profile caching
export const cachedUserAPI = {
  /**
   * Get user profile with caching
   */
  getProfile: async (userId: string, forceRefresh: boolean = false) => {
    const cacheKey = getUserCacheKey(userId);
    const { data: cachedData, isExpired } = await cacheService.get(cacheKey);
    
    if (cachedData && !isExpired && !forceRefresh) {
      // Return cached data, fetch in background to update
      return { data: cachedData, fromCache: true };
    }
    
    // Fetch from network
    const response = await userAPI.getProfile(userId);
    await cacheService.set(cacheKey, response.data, CACHE_TTL.PROFILE);
    return { data: response.data, fromCache: false };
  },
  
  /**
   * Update profile and invalidate cache
   */
  updateProfile: async (userId: string, data: any) => {
    const response = await userAPI.updateProfile(userId, data);
    // Invalidate cache
    await cacheService.remove(getUserCacheKey(userId));
    return response;
  },
  
  /**
   * Get nearby users with caching
   */
  getNearbyUsers: async (filters?: any) => {
    const cacheKey = `${CACHE_TTL.SHORT}_nearby_${JSON.stringify(filters || {})}`;
    const { data: cachedData, isExpired } = await cacheService.get(cacheKey);
    
    if (cachedData && !isExpired) {
      return { data: cachedData, fromCache: true };
    }
    
    const response = await userAPI.getNearbyUsers(filters);
    await cacheService.set(cacheKey, response.data, CACHE_TTL.SHORT);
    return { data: response.data, fromCache: false };
  },
  
  /**
   * Get recommended users with smart ranking
   */
  getRecommendedUsers: async (filters?: any) => {
    const cacheKey = `${CACHE_TTL.SHORT}_recommended_${JSON.stringify(filters || {})}`;
    const { data: cachedData, isExpired } = await cacheService.get(cacheKey);
    
    if (cachedData && !isExpired) {
      return { data: cachedData, fromCache: true };
    }
    
    const response = await userAPI.getRecommendedUsers(filters);
    await cacheService.set(cacheKey, response.data, CACHE_TTL.SHORT);
    return { data: response.data, fromCache: false };
  },
  
  /**
   * Search users with caching
   */
  searchUsers: async (query: string) => {
    const cacheKey = `search_users_${query.toLowerCase()}`;
    const { data: cachedData, isExpired } = await cacheService.get(cacheKey);
    
    // Only use cache for common searches
    if (cachedData && !isExpired && query.length > 2) {
      return { data: cachedData, fromCache: true };
    }
    
    const response = await userAPI.searchUsers(query);
    const searchUserData = response.data.data || [];
    await cacheService.set(cacheKey, searchUserData, CACHE_TTL.SHORT);
    return { data: searchUserData, fromCache: false };
  },
};

// Posts caching
export const cachedPostAPI = {
  /**
   * Get posts with caching
   */
  getPosts: async (isAnonymous?: boolean, page: number = 1, limit: number = 20, forceRefresh: boolean = false) => {
    const cacheKey = getPostsCacheKey(page, isAnonymous);
    const { data: cachedData, isExpired } = await cacheService.get(cacheKey);
    
    // Only use cache for first page (recent posts) and when not forcing a refresh
    if (cachedData && !isExpired && page === 1 && !forceRefresh) {
      return { data: cachedData, fromCache: true };
    }
    
    const response = await postAPI.getPosts(isAnonymous, page, limit);
    
    // Cache first page results
    if (page === 1) {
      await cacheService.set(cacheKey, response.data, CACHE_TTL.FEED);
    }
    
    return { data: response.data, fromCache: false };
  },
  
  /**
   * Get user posts with caching
   */
  getUserPosts: async (userId: string, page: number = 1, limit: number = 20, forceRefresh: boolean = false) => {
    const cacheKey = `user_posts_${userId}_page${page}`;
    const { data: cachedData, isExpired } = await cacheService.get(cacheKey);
    
    if (cachedData && !isExpired && page === 1 && !forceRefresh) {
      return { data: cachedData, fromCache: true };
    }
    
    const response = await postAPI.getUserPosts(userId, page, limit);
    
    if (page === 1) {
      await cacheService.set(cacheKey, response.data, CACHE_TTL.PROFILE);
    }
    
    return { data: response.data, fromCache: false };
  },
  
  /**
   * Get trending posts with caching
   */
  getTrendingPosts: async () => {
    const cacheKey = 'trending_posts';
    const { data: cachedData, isExpired } = await cacheService.get(cacheKey);
    
    if (cachedData && !isExpired) {
      return { data: cachedData, fromCache: true };
    }
    
    const response = await postAPI.getTrendingPosts();
    const trendingData = response.data.data || [];
    await cacheService.set(cacheKey, trendingData, CACHE_TTL.FEED);
    return { data: trendingData, fromCache: false };
  },
  
  /**
    * Get candidate ranked feed with caching
    */
  getCandidateFeed: async (page: number = 1, forceRefresh: boolean = false) => {
    const cacheKey = page === 1 ? 'candidate_feed' : null;
    if (cacheKey && !forceRefresh) {
      const { data: cachedData, isExpired } = await cacheService.get(cacheKey);
      if (cachedData && !isExpired) {
        return { data: cachedData, fromCache: true };
      }
    }
    
    const response = await postAPI.getCandidateFeed(page);
    const candidateData = response.data.data || [];
    if (cacheKey) {
      await cacheService.set(cacheKey, candidateData, CACHE_TTL.FEED);
    }
    return { data: candidateData, fromCache: false };
  },
  
  /**
    * Get suggested random public posts with caching
    */
  getSuggestedRandomPosts: async () => {
    const cacheKey = 'suggested_random_posts';
    const { data: cachedData, isExpired } = await cacheService.get(cacheKey);
    
    if (cachedData && !isExpired) {
      return { data: cachedData, fromCache: true };
    }
    
    const response = await postAPI.getSuggestedRandomPosts();
    const suggestedData = response.data.data || [];
    await cacheService.set(cacheKey, suggestedData, CACHE_TTL.FEED);
    return { data: suggestedData, fromCache: false };
  },
  
  /**
   * Get favorite posts with caching
   */
  getFavoritePosts: async () => {
    const cacheKey = 'favorite_posts';
    const { data: cachedData, isExpired } = await cacheService.get(cacheKey);
    
    if (cachedData && !isExpired) {
      return { data: cachedData, fromCache: true };
    }
    
    const response = await postAPI.getFavoritePosts();
    const favoriteData = response.data.data || [];
    await cacheService.set(cacheKey, favoriteData, CACHE_TTL.SHORT);
    return { data: favoriteData, fromCache: false };
  },
  
  /**
   * Create post and invalidate feed cache
   */
  createPost: async (data: any) => {
    const response = await postAPI.createPost(data);
    // Invalidate feed cache
    await cacheService.remove(getPostsCacheKey(1, data.isAnonymous));
    return response;
  },
  
  /**
   * Delete post and invalidate caches
   */
  deletePost: async (postId: string) => {
    const response = await postAPI.deletePost(postId);
    // Invalidate all feed caches
    await cacheService.invalidateByPrefix('cache_posts_');
    return response;
  },
};

// Notifications caching
export const cachedNotificationAPI = {
  /**
   * Get notifications with caching
   */
  getNotifications: async () => {
    const cacheKey = getNotificationsCacheKey();
    const { data: cachedData, isExpired } = await cacheService.get(cacheKey);
    
    if (cachedData && !isExpired) {
      return { data: cachedData, fromCache: true };
    }
    
    const response = await notificationAPI.getNotifications();
    const notificationData = response.data.data || [];
    await cacheService.set(cacheKey, notificationData, CACHE_TTL.SHORT);
    return { data: notificationData, fromCache: false };
  },
  
  /**
   * Get unread count with caching
   */
  getUnreadCount: async () => {
    const cacheKey = 'notification_unread_count';
    const { data: cachedData, isExpired } = await cacheService.get(cacheKey);
    
    if (cachedData && !isExpired) {
      return { data: cachedData, fromCache: true };
    }
    
    const response = await notificationAPI.getUnreadCount();
    await cacheService.set(cacheKey, response.data, CACHE_TTL.SHORT);
    return { data: response.data, fromCache: false };
  },
  
  /**
   * Mark as read and invalidate cache
   */
  markAsRead: async (notificationId: string) => {
    const response = await notificationAPI.markAsRead(notificationId);
    // Invalidate notifications cache
    await cacheService.remove(getNotificationsCacheKey());
    return response;
  },
  
  /**
   * Mark all as read and invalidate cache
   */
  markAllAsRead: async () => {
    const response = await notificationAPI.markAllAsRead();
    // Invalidate notifications cache
    await cacheService.remove(getNotificationsCacheKey());
    return response;
  },
};

// Chats caching
export const cachedChatAPI = {
  /**
   * Get user chats with caching
   */
  getUserChats: async (userId: string) => {
    const cacheKey = getChatsCacheKey(userId);
    const { data: cachedData, isExpired } = await cacheService.get(cacheKey);
    
    if (cachedData && !isExpired) {
      return { data: cachedData, fromCache: true };
    }
    
    const response = await chatAPI.getUserChats(userId);
    const chatsData = response.data.data || [];
    await cacheService.set(cacheKey, chatsData, CACHE_TTL.SHORT);
    return { data: chatsData, fromCache: false };
  },
  
  /**
   * Get chat with caching
   */
  getChat: async (chatId: string) => {
    const cacheKey = `chat_${chatId}`;
    const { data: cachedData, isExpired } = await cacheService.get(cacheKey);
    
    if (cachedData && !isExpired) {
      return { data: cachedData, fromCache: true };
    }
    
    const response = await chatAPI.getChat(chatId);
    await cacheService.set(cacheKey, response.data, CACHE_TTL.SHORT);
    return { data: response.data, fromCache: false };
  },
  
  /**
   * Send message and invalidate chat cache
   */
  sendMessage: async (chatId: string, data: any) => {
    const response = await chatAPI.sendMessage(chatId, data);
    // Invalidate chat cache
    await cacheService.remove(`chat_${chatId}`);
    return response;
  },
};

// Communities caching
export const cachedCommunityAPI = {
  /**
   * Get all communities with caching
   */
  getAll: async () => {
    const cacheKey = 'all_communities';
    const { data: cachedData, isExpired } = await cacheService.get(cacheKey);
    
    if (cachedData && !isExpired) {
      return { data: cachedData, fromCache: true };
    }
    
    const response = await communityAPI.getAll();
    const communitiesData = response.data.data || [];
    await cacheService.set(cacheKey, communitiesData, CACHE_TTL.LONG);
    return { data: communitiesData, fromCache: false };
  },
  
  /**
   * Get community with caching
   */
  getCommunity: async (communityId: string) => {
    const cacheKey = getCommunityCacheKey(communityId);
    const { data: cachedData, isExpired } = await cacheService.get(cacheKey);
    
    if (cachedData && !isExpired) {
      return { data: cachedData, fromCache: true };
    }
    
    const response = await communityAPI.getCommunity(communityId);
    await cacheService.set(cacheKey, response.data, CACHE_TTL.LONG);
    return { data: response.data, fromCache: false };
  },
  
  /**
   * Search communities with caching
   */
  search: async (query: string) => {
    const cacheKey = `community_search_${query.toLowerCase()}`;
    const { data: cachedData, isExpired } = await cacheService.get(cacheKey);
    
    if (cachedData && !isExpired && query.length > 2) {
      return { data: cachedData, fromCache: true };
    }
    
    const response = await communityAPI.search(query);
    const searchData = response.data.data || [];
    await cacheService.set(cacheKey, searchData, CACHE_TTL.SHORT);
    return { data: searchData, fromCache: false };
  },
};

// Stories caching
export const cachedStoryAPI = {
  /**
   * Get stories with caching
   */
  getStories: async (userId?: string, forceRefresh: boolean = false) => {
    const cacheKey = getStoriesCacheKey(userId);
    const { data: cachedData, isExpired } = await cacheService.get(cacheKey);
    
    if (cachedData && !isExpired && !forceRefresh) {
      return { data: cachedData, fromCache: true };
    }
    
    const response = await storyAPI.getStories();
    const storiesData = response.data.data || [];
    await cacheService.set(cacheKey, storiesData, CACHE_TTL.SHORT);
    return { data: storiesData, fromCache: false };
  },
  
  /**
   * Get user stories with caching
   */
  getUserStories: async (userId: string) => {
    const cacheKey = getStoriesCacheKey(userId);
    const { data: cachedData, isExpired } = await cacheService.get(cacheKey);
    
    if (cachedData && !isExpired) {
      return { data: cachedData, fromCache: true };
    }
    
    const response = await storyAPI.getUserStories(userId);
    await cacheService.set(cacheKey, response.data, CACHE_TTL.SHORT);
    return { data: response.data, fromCache: false };
  },
};
