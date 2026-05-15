import axios, { AxiosInstance } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { CustomAlert } from './alert';

// Use machine IP for iOS simulator or physical devices.
// For Android emulator, '10.0.2.2' maps to the host machine's localhost.
// For iOS simulator, 'localhost' (or your machine's IP) often works.
// For physical devices, you MUST use your machine's actual local IP address (e.g., '192.168.1.X').
// Ensure your backend server is running and accessible on the specified port.
// If you encounter a 'Network Error', verify this URL is correct for your device/emulator and network.
// Default to 10.0.2.2 for Android emulator (backend runs on port 5001)
// For physical devices, use machine's IP (e.g., '192.168.1.61:5001')

// Load Balancing Configuration
// Support multiple server endpoints for failover and load distribution
const SERVER_ENDPOINTS = process.env.EXPO_PUBLIC_SERVER_ENDPOINTS 
  ? process.env.EXPO_PUBLIC_SERVER_ENDPOINTS.split(',').map(s => s.trim())
  : ['http://10.0.2.2:5001'];

// Primary API URL (main server)
const PRIMARY_API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:5001/api';

// For backwards compatibility, use single URL
const API_URL = PRIMARY_API_URL;

console.log('🌐 API Configured:', API_URL);
const BASE_URL = API_URL.replace('/api', '');

// ============== LOAD BALANCING & FAILOVER ==============

/**
 * Load balancer configuration for multiple server endpoints
 */
export interface ServerEndpoint {
  url: string;
  healthy: boolean;
  lastChecked: number;
  failureCount: number;
}

/**
 * Initialize server endpoints with health tracking
 */
export function initializeLoadBalancer(): ServerEndpoint[] {
  return SERVER_ENDPOINTS.map(url => ({
    url: `${url}/api`,
    healthy: true,
    lastChecked: Date.now(),
    failureCount: 0,
  }));
}

// Global load balancer state
let serverEndpoints: ServerEndpoint[] = initializeLoadBalancer();
let currentEndpointIndex = 0;
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
const MAX_FAILURES_BEFORE_MARK_UNHEALTHY = 3;

/**
 * Get the next healthy server endpoint (round-robin with health check)
 */
export function getNextEndpoint(): string {
  const now = Date.now();
  
  // Filter healthy endpoints
  const healthyEndpoints = serverEndpoints.filter(ep => ep.healthy);
  
  if (healthyEndpoints.length === 0) {
    // All servers unhealthy, reset all and use first one
    console.warn('⚠️ All servers unhealthy, resetting...');
    serverEndpoints.forEach(ep => {
      ep.healthy = true;
      ep.failureCount = 0;
    });
    return serverEndpoints[0].url;
  }
  
  // Round-robin through healthy servers
  const endpoint = healthyEndpoints[currentEndpointIndex % healthyEndpoints.length];
  currentEndpointIndex++;
  
  console.log(`🔄 Using server: ${endpoint.url}`);
  return endpoint.url;
}

/**
 * Mark endpoint as failed
 */
export function markEndpointFailed(url: string): void {
  const endpoint = serverEndpoints.find(ep => ep.url === url);
  if (endpoint) {
    endpoint.failureCount++;
    endpoint.lastChecked = Date.now();
    
    if (endpoint.failureCount >= MAX_FAILURES_BEFORE_MARK_UNHEALTHY) {
      endpoint.healthy = false;
      console.warn(`🔴 Server marked unhealthy: ${url} (${endpoint.failureCount} failures)`);
    }
  }
}

/**
 * Mark endpoint as successful
 */
export function markEndpointHealthy(url: string): void {
  const endpoint = serverEndpoints.find(ep => ep.url === url);
  if (endpoint) {
    endpoint.healthy = true;
    endpoint.failureCount = 0;
    endpoint.lastChecked = Date.now();
    console.log(`✅ Server marked healthy: ${url}`);
  }
}

/**
 * Execute request with automatic failover
 * Tries each server in sequence until one succeeds
 */
export async function executeWithFailover<T>(
  requestFn: (baseURL: string) => Promise<T>,
  maxRetries: number = SERVER_ENDPOINTS.length
): Promise<T> {
  const errors: Error[] = [];
  
  for (let i = 0; i < maxRetries; i++) {
    const endpoint = getNextEndpoint();
    
    try {
      const result = await requestFn(endpoint);
      markEndpointHealthy(endpoint);
      return result;
    } catch (error) {
      errors.push(error as Error);
      markEndpointFailed(endpoint);
      console.warn(`⚠️ Request failed for ${endpoint}, trying next...`);
    }
  }
  
  // All endpoints failed
  throw new Error(`All ${maxRetries} servers failed. Last error: ${errors[errors.length - 1]?.message}`);
}

/**
 * Get load balancer status
 */
export function getLoadBalancerStatus(): { servers: ServerEndpoint[]; currentIndex: number } {
  return {
    servers: serverEndpoints,
    currentIndex: currentEndpointIndex,
  };
}

// Periodic health check (every 30 seconds)
setInterval(() => {
  const now = Date.now();
  
  serverEndpoints.forEach(async (endpoint) => {
    // Skip if recently checked
    if (now - endpoint.lastChecked < HEALTH_CHECK_INTERVAL) return;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${endpoint.url.replace('/api', '')}/health`, {
        method: 'GET',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        markEndpointHealthy(endpoint.url);
      } else {
        markEndpointFailed(endpoint.url);
      }
    } catch (error) {
      markEndpointFailed(endpoint.url);
    }
  });
}, HEALTH_CHECK_INTERVAL);

console.log('⚖️ Load Balancer initialized with', SERVER_ENDPOINTS.length, 'endpoints');

// Track last alert time to prevent alert flooding
let lastAlertTime = 0;
const ALERT_COOLDOWN_MS = 3000;

/**
 * Get user-friendly error message based on status code
 */
function getApiErrorMessage(status: number, data?: any): { title: string; message: string; shouldRedirect?: boolean } {
  const serverMessage = data?.msg || data?.message;
  
  switch (status) {
    case 400:
      return { title: 'Invalid Request', message: serverMessage || 'Please check your input and try again.' };
    case 401:
      return { title: 'Session Expired', message: 'Your session has expired. Please log in again.', shouldRedirect: true };
    case 403:
      return { title: 'Access Denied', message: serverMessage || 'You do not have permission to perform this action.' };
    case 404:
      return { title: 'Not Found', message: serverMessage || 'The requested item was not found.' };
    case 409:
      return { title: 'Conflict', message: serverMessage || 'A conflict occurred. Please try again.' };
    case 422:
      return { title: 'Validation Error', message: serverMessage || 'Please check your input.' };
    case 429:
      return { title: 'Too Many Requests', message: 'Please wait a moment before trying again.' };
    case 500:
      return { title: 'Server Error', message: 'Something went wrong on our end. Please try again later.' };
    case 502:
    case 503:
    case 504:
      return { title: 'Service Unavailable', message: 'The service is temporarily unavailable. Please try again later.' };
    default:
      if (status >= 500) {
        return { title: 'Server Error', message: 'Something went wrong on our end. Please try again later.' };
      }
      return { title: 'Error', message: serverMessage || 'An unexpected error occurred. Please try again.' };
  }
}

/**
 * Get network error message
 */
function getNetworkErrorMessage(error: any): { title: string; message: string } {
  const message = error.message?.toLowerCase() || '';

  if (message.includes('timeout') || message.includes('timed out')) {
    return { title: 'Request Timeout', message: 'The request took too long. Please check your connection and try again.' };
  }

  if (message.includes('network') || message.includes('fetch') || message.includes('connection') ||
      message.includes('ECONNREFUSED') || message.includes('ENOTFOUND') || message.includes('unable to resolve')) {
    return { title: 'Connection Error', message: 'Unable to connect. Please check your internet connection and try again.' };
  }

  return { title: 'Network Error', message: 'A network error occurred. Please check your connection and try again.' };
}

/**
 * Store retry callback for network errors
 */
let retryCallback: (() => void) | null = null;

/**
 * Check if an API response indicates a network error
 * Use this to check responses from API calls that use the interceptor
 * @returns true if the response indicates a network error
 */
export function isNetworkErrorResponse(response: any): boolean {
  return response && (response.isNetworkError === true || response.status === 0);
}

/**
 * Show API error alert - always show for critical errors
 */
function showApiErrorAlert(error: any, isNetworkError: boolean = false, onRetry?: () => void, showAlert: boolean = true): void {
  if (!showAlert) {
    // Alert suppressed - caller will handle showing error to user
    return;
  }

  const now = Date.now();

  // Store retry callback for network errors
  if (isNetworkError && onRetry) {
    retryCallback = onRetry;
  }

  // Rate limit alerts - only for non-critical errors (4xx)
  // Always show for network errors (backend offline)
  if (!isNetworkError && now - lastAlertTime < ALERT_COOLDOWN_MS) {
    return;
  }

  lastAlertTime = now;

  let errorInfo: { title: string; message: string; shouldRedirect?: boolean };

  if (isNetworkError || !error.response) {
    errorInfo = getNetworkErrorMessage(error);
  } else {
    errorInfo = getApiErrorMessage(error.response.status, error.response.data);

    // Clear tokens on 401 (unauthorized) errors before redirecting
    if (error.response.status === 401) {
      AsyncStorage.removeItem('authToken');
      AsyncStorage.removeItem('sessionId');
    }
  }

  // Build alert buttons
  const buttons = [];

  // Add retry button for network errors
  if (isNetworkError && onRetry) {
    buttons.push({ text: 'Retry', onPress: onRetry, style: 'default' });
  }

  // Add redirect or OK button
  if (errorInfo.shouldRedirect) {
    buttons.push({ text: 'OK', onPress: () => router.replace('/login'), style: 'cancel' });
  } else {
    buttons.push({ text: 'OK', style: 'cancel' });
  }

  // Show alert using CustomAlert
  CustomAlert.show({
    type: 'error',
    title: errorInfo.title,
    message: errorInfo.message,
    buttons,
    dismissable: !isNetworkError || !onRetry
  });
}

const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 seconds timeout
});

// Retry configuration constants
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// Retry logic for failed requests
api.interceptors.response.use(
  null,
  async (error) => {
    const config = error.config;
    
    // Only retry on network errors or 5xx errors
    const shouldRetry = 
      !error.response || 
      (error.response.status >= 500 && error.response.status <= 599) ||
      error.code === 'ECONNABORTED' ||
      error.message.includes('Network Error');
    
    if (shouldRetry && config && !config.__retryCount) {
      config.__retryCount = config.__retryCount || 0;
      
      if (config.__retryCount < MAX_RETRIES) {
        config.__retryCount += 1;
        
        console.warn(`🔄 Retrying request (attempt ${config.__retryCount})...`);
        
        // Add delay before retry
        const delay = config.__retryCount * RETRY_DELAY_MS;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return api(config);
      }
    }
    
    // Mark endpoint as failed for load balancing
    if (!error.response) {
      markEndpointFailed(config?.baseURL || API_URL);
    }
    
    return Promise.reject(error);
  }
);

// Create a separate instance for file uploads with longer timeout
const uploadAPI: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000, // 30 seconds for file uploads
});

// Add token to requests
api.interceptors.request.use(
  async (config: any) => {
    const token = await AsyncStorage.getItem('authToken');
    if (token) {
      config.headers['x-auth-token'] = token;
    }
    // For JSON requests, keep Content-Type as application/json.
    // FormData should be handled by uploadAPI.
    return config;
  },
  (error: any) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle errors with user-friendly alerts
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isNetworkError = !error.response;
    
    if (isNetworkError) {
      // Log as warning instead of error to prevent Metro from showing as critical error
      console.warn('⚠️ Network Error: Could not reach backend.');
      console.warn(`   Attempted URL: ${error.config?.baseURL}${error.config?.url}`);
      console.warn('   Check your API_URL and ensure the server is running.');
    } else {
      console.log('⚠️ API Error:', error.response.status, error.response.data);
    }
    
    // Show user-friendly error alert
    showApiErrorAlert(error, isNetworkError);
    
    // Don't re-throw the error after showing the alert - this prevents crashes
    // The UI has already shown an error message to the user
    // Returning a dummy response keeps the app running without breaking the flow
    return Promise.resolve({ 
      data: null, 
      status: error.response?.status || 0,
      isNetworkError: isNetworkError 
    });
  }
);

// Add token to file upload requests
uploadAPI.interceptors.request.use(
  async (config: any) => {
    const token = await AsyncStorage.getItem('authToken');
    if (token) {
      config.headers['x-auth-token'] = token;
    }
    // Don't force Content-Type for FormData - let axios handle it
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    return config;
  },
  (error: any) => {
    return Promise.reject(error);
  }
);

// API Endpoints
export const authAPI = {
  register: (data: { username: string; email: string; password: string; birthYear: number }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  supabaseLogin: (accessToken: string) =>
    api.post('/auth/supabase-login', { accessToken }),
  getCurrentUser: () => api.get('/auth/me'),
  checkUsername: (username: string) => api.get(`/auth/check-username/${username}`),
  checkEmail: (email: string) => api.get(`/auth/check-email/${email}`),
  checkGoogleUser: (email: string) => api.get(`/auth/google-user/${email}`),
  checkConnection: () => axios.get(`${BASE_URL}/health`),
  // Password reset
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, newPassword: string) => 
    api.post('/auth/reset-password', { token, newPassword }),
  setPassword: (email: string, newPassword: string) =>
    api.post('/auth/set-password', { email, newPassword }),
  // Complete profile (for Supabase users)
  completeProfile: (data: { supabaseUserId: string; email: string; username: string; birthYear: number; gender: string; location: string }) =>
    api.post('/auth/complete-profile', data),
};

export const userAPI = {
  getProfile: (userId: string) => api.get(`/users/${userId}`),
  updateProfile: (userId: string, data: any) => api.put(`/users/${userId}`, data),
  uploadProfilePhoto: async (userId: string, formData: FormData) => {
    const token = await AsyncStorage.getItem('authToken');
    const response = await fetch(`${API_URL}/users/${userId}/upload-profile-photo`, {
      method: 'POST',
      headers: {
        'x-auth-token': token || '',
        'Accept': 'application/json',
      },
      body: formData,
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return { data };
  },
  uploadProfilePhotoBase64: async (userId: string, data: { imageData: string; filename: string }) => {
    const token = await AsyncStorage.getItem('authToken');
    const response = await fetch(`${API_URL}/users/${userId}/upload-profile-photo-base64`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token || '',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  },
  uploadCoverPhoto: async (userId: string, formData: FormData) => {
    const token = await AsyncStorage.getItem('authToken');
    const response = await fetch(`${API_URL}/users/${userId}/upload-cover-photo`, {
      method: 'POST',
      headers: {
        'x-auth-token': token || '',
        'Accept': 'application/json',
      },
      body: formData,
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return { data };
  },
  uploadCoverPhotoBase64: async (userId: string, data: { imageData: string; filename: string }) => {
    const token = await AsyncStorage.getItem('authToken');
    const response = await fetch(`${API_URL}/users/${userId}/upload-cover-photo-base64`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token || '',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  },
  searchUsers: (query: string) => api.get('/users/search/query', { params: { q: query } }),
  getNearbyUsers: (filters?: any) => api.get('/users/nearby/all', { params: filters }),
  sendFriendRequest: (userId: string, targetUserId: string) =>
    api.post(`/users/${userId}/friend-request/${targetUserId}`),
  acceptFriendRequest: (userId: string, senderId: string) =>
    api.post(`/users/${userId}/accept-request/${senderId}`),
  ignoreFriendRequest: (userId: string, senderId: string) =>
    api.post(`/users/${userId}/ignore-request/${senderId}`),
  cancelFriendRequest: (userId: string, targetUserId: string) =>
    api.post(`/users/${userId}/cancel-request/${targetUserId}`),
  addFriend: (userId: string, friendId: string) =>
    api.post(`/users/${userId}/friends/${friendId}`),
  unfriend: (userId: string, friendId: string) =>
    api.delete(`/users/${userId}/friends/${friendId}`),
  getAlbum: (userId: string) => api.get(`/posts/album/user/${userId}`),
  uploadAlbumPhoto: async (userId: string, data: { imageData: string; filename: string }) => {
    const token = await AsyncStorage.getItem('authToken');
    const response = await fetch(`${API_URL}/posts/album`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token || '',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  },
  deleteAlbumPhoto: (userId: string, photoId: string) =>
    api.delete(`/posts/album/${photoId}`),
  addMatch: (userId: string, matchId: string) =>
    api.post(`/users/${userId}/matches/${matchId}`),
  blockUser: (userId: string, targetUserId: string) =>
    api.post(`/users/${userId}/block/${targetUserId}`),
  unblockUser: (userId: string, targetUserId: string) =>
    api.post(`/users/${userId}/unblock/${targetUserId}`),
  getMutedUsers: () => api.get('/users/muted'),
  muteUser: (userId: string) => api.post(`/users/mute/${userId}`),
  unmuteUser: (userId: string) => api.post(`/users/unmute/${userId}`),
  getLoginActivity: () => api.get('/users/login-activity'),
  clearLoginActivity: () => api.delete('/users/login-activity'),
  getIncomingFriendRequests: () => api.get('/users/friend-requests/incoming'),
  getSentFriendRequests: () => api.get('/users/friend-requests/sent'),
};

export const notificationAPI = {
  getNotifications: () => api.get('/notifications'),
  markAsRead: (notificationId: string) => api.put(`/notifications/${notificationId}/read`),
  markAllAsRead: () => api.put('/notifications/read-all'),
  clearAll: () => api.delete('/notifications'),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  deleteNotification: (notificationId: string) => api.delete(`/notifications/${notificationId}`),
  // Push token registration
  registerPushToken: (token: string, device: string, platform: string) => 
    api.post('/notifications/register-token', { token, device, platform }),
  unregisterPushToken: (token: string) => 
    api.post('/notifications/unregister-token', { token }),
  getPushTokens: () => api.get('/notifications/device-tokens'),
};

export const chatAPI = {
  getUserChats: (userId: string) => api.get(`/chats/user/${userId}`),
  getChat: (chatId: string) => api.get(`/chats/${chatId}`),
  createChat: (data: any) => api.post('/chats', data),
  sendMessage: (chatId: string, data: { content?: string; isAnonymous?: boolean; replyTo?: string; attachment?: any; pollOptions?: { text: string }[] }) =>
    api.post(`/chats/${chatId}/messages`, data),
  deleteMessage: (chatId: string, messageId: string) =>
    api.delete(`/chats/${chatId}/messages/${messageId}`),
  markAsRead: (chatId: string) => api.put(`/chats/${chatId}/read`),
  leave: (chatId: string) => api.post(`/chats/${chatId}/leave`),
  addMember: (chatId: string, userId: string) => api.post(`/chats/${chatId}/members`, { userId }),
  removeMember: (chatId: string, userId: string) => api.delete(`/chats/${chatId}/members/${userId}`),
  cancelPendingInvitation: (chatId: string, userId: string) => api.delete(`/chats/${chatId}/pending/${userId}`),
  clearChat: (chatId: string) => api.post(`/chats/${chatId}/clear`),
  acceptInvitation: (chatId: string) => api.post(`/chats/${chatId}/accept`),
  rejectInvitation: (chatId: string) => api.post(`/chats/${chatId}/reject`),
  updateGroupName: (chatId: string, name: string) => api.put(`/chats/${chatId}/name`, { name }),
  updateGroupPhoto: (chatId: string, groupPhoto: string) => api.put(`/chats/${chatId}/photo`, { groupPhoto }),
  uploadAttachment: async (formData: FormData, options?: any) => {
    const token = await AsyncStorage.getItem('authToken');
    const response = await fetch(`${API_URL}/chats/upload-attachment`, {
      method: 'POST',
      headers: {
        'x-auth-token': token || '',
        'Accept': 'application/json',
      },
      body: formData,
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return { data };
  },
  uploadAttachmentBase64: async (imageData: string, filename: string) => {
    const token = await AsyncStorage.getItem('authToken');
    const response = await fetch(`${API_URL}/chats/upload-attachment-base64`, {
      method: 'POST',
      headers: {
        'x-auth-token': token || '',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageData, filename }),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return { data };
  },
  getTurnCredentials: () => api.get('/chats/turn-credentials'),
  votePoll: (chatId: string, messageId: string, optionIndex: number) => api.post(`/chats/${chatId}/messages/${messageId}/vote`, { optionIndex }),
};

export const postAPI = {
  getPosts: (isAnonymous?: boolean, page?: number, limit?: number) => api.get('/posts', { params: { isAnonymous, page, limit } }),
  getUserPosts: (userId: string, page?: number, limit?: number) => api.get(`/posts/user/${userId}`, { params: { page, limit } }),
  getPost: (postId: string) => api.get(`/posts/${postId}`),
  createPost: (data: { content?: string; image?: string; video?: string; isPublic?: boolean; isAnonymous?: boolean; commentsDisabled?: boolean; tags?: string[]; category?: string }) =>
    api.post('/posts', data),
  updatePost: (postId: string, data: { content?: string; image?: string; video?: string }) =>
    api.put(`/posts/${postId}`, data),
  deletePost: (postId: string) =>
    api.delete(`/posts/${postId}`),
  likePost: (postId: string) =>
    api.post(`/posts/${postId}/like`, {}),
  unlikePost: (postId: string) =>
    api.post(`/posts/${postId}/like`, {}),
  reactPost: (postId: string, data: { reactionType: string }) =>
    api.post(`/posts/${postId}/react`, data),
  addComment: (postId: string, data: { content?: string; parent?: string; isAnonymous?: boolean; tags?: string[] }) =>
    api.post(`/posts/${postId}/comment`, data),
  likeComment: (postId: string, commentId: string) =>
    api.post(`/posts/${postId}/comment/${commentId}/like`, {}),
  reactComment: (postId: string, commentId: string, data: { reactionType: string }) =>
    api.post(`/posts/${postId}/comment/${commentId}/react`, data),
  deleteComment: (postId: string, commentId: string) =>
    api.delete(`/posts/${postId}/comment/${commentId}`),
  getTrendingPosts: () => api.get('/posts/trending/hot'),
  favoritePost: (postId: string) => api.post(`/posts/${postId}/favorite`, {}),
  unfavoritePost: (postId: string) => api.delete(`/posts/${postId}/favorite`),
  getFavoritePosts: () => api.get('/posts/favorites'),
  sharePost: (postId: string) => api.post(`/posts/${postId}/share`, {}),
  uploadPostImage: async (formData: FormData) => {
    const token = await AsyncStorage.getItem('authToken');
    const response = await fetch(`${API_URL}/posts/upload-image`, {
      method: 'POST',
      headers: {
        'x-auth-token': token || '',
      },
      body: formData,
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  },
  uploadPostImageBase64: async (data: { imageData: string; filename: string }) => {
    const token = await AsyncStorage.getItem('authToken');
    const response = await fetch(`${API_URL}/posts/upload-image-base64`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token || '',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  },
  uploadPostVideo: async (formData: FormData) => {
    const token = await AsyncStorage.getItem('authToken');
    const response = await fetch(`${API_URL}/posts/upload-video`, {
      method: 'POST',
      headers: {
        'x-auth-token': token || '',
      },
      body: formData,
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  },
  uploadPostVideoBase64: async (data: { videoData: string; filename: string }) => {
    const token = await AsyncStorage.getItem('authToken');
    const response = await fetch(`${API_URL}/posts/upload-video-base64`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token || '',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  },

  searchPosts: (query: string) => api.get('/posts/search', { params: { q: query } }),
  votePoll: (postId: string, optionIndex: number) => api.post(`/posts/${postId}/vote-poll`, { optionIndex }),
};

export const storyAPI = {
  getStories: () => api.get('/stories'),
  getUserStories: (userId: string) => api.get(`/stories/user/${userId}`),
  getStory: (storyId: string) => api.get(`/stories/${storyId}`),
  createStory: (data: { content?: string; image?: string; video?: string; tags?: string[]; pollOptions?: { text: string }[] }) =>
    api.post('/stories', data),
  viewStory: (storyId: string) =>
    api.post(`/stories/${storyId}/view`, {}),
  deleteStory: (storyId: string) =>
    api.delete(`/stories/${storyId}`),
  reactStory: (storyId: string, data: { reactionType: string }) => api.post(`/stories/${storyId}/react`, data),
  muteUser: (userId: string) =>
    api.post(`/stories/mute/${userId}`, {}),
  unmuteUser: (userId: string) =>
    api.post(`/stories/unmute/${userId}`, {}),
  getMutedUsers: () => api.get('/stories/muted/list'),
  uploadStoryImageBase64: async (data: { imageData: string; filename: string }) => {
    const token = await AsyncStorage.getItem('authToken');
    const response = await fetch(`${API_URL}/stories/upload-image-base64`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token || '',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  },
  votePoll: (storyId: string, optionIndex: number) => api.post(`/stories/${storyId}/vote-poll`, { optionIndex }),
};

export const communityAPI = {
  getAll: () => api.get('/communities'),
  search: (query: string) => api.get('/communities/search', { params: { q: query } }),
  getCommunity: (communityId: string) => api.get(`/communities/${communityId}`),
  create: (data: { name: string; description: string; image?: string; requiresApproval?: boolean; isAnonymous?: boolean }) =>
    api.post('/communities', data),
  join: (communityId: string) => api.post(`/communities/${communityId}/join`),
  leave: (communityId: string) => api.post(`/communities/${communityId}/leave`),
  approveMember: (communityId: string, userId: string) =>
    api.post(`/communities/${communityId}/approve/${userId}`),
  rejectMember: (communityId: string, userId: string) =>
    api.post(`/communities/${communityId}/reject/${userId}`),
  delete: (communityId: string) => api.delete(`/communities/${communityId}`),
  generateInvite: (communityId: string, data?: { maxUses?: number; expiresIn?: number }) =>
    api.post(`/communities/${communityId}/invite`, data || {}),
  getInviteInfo: (inviteToken: string) => api.get(`/communities/invite/${inviteToken}`),
  joinViaInvite: (inviteToken: string) => api.post(`/communities/join/${inviteToken}`),
  uploadImageBase64: async (data: { imageData: string; filename: string }) => {
    const token = await AsyncStorage.getItem('authToken');
    const response = await fetch(`${API_URL}/communities/upload-image-base64`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-auth-token': token || '' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  },
};

// Helper function to get full image URL
export const getImageUrl = (imagePath?: string): string | undefined => {
  if (!imagePath) return undefined;
  
  // Return Supabase URLs as-is - they should work
  if (imagePath.startsWith('http')) {
return imagePath;

  }
  if (imagePath.startsWith('/uploads/')) {
    return `${BASE_URL}${imagePath}`;
  }
  return imagePath;
};

// Get base URL (without /api) for Socket.IO
export const SOCKET_URL = process.env.EXPO_PUBLIC_API_URL 
  ? process.env.EXPO_PUBLIC_API_URL.replace('/api', '') 
  : 'http://10.0.2.2:5001'; // Uses load balancer for WebSocket connections

export { BASE_URL };

// ============================================
// Retry Helper Functions
// ============================================

/**
 * Make an API call with automatic retry on network failure
 * @param apiCall - The API call function that returns a promise
 * @param options - Options for retry behavior
 * @returns The result of the API call
 */
export async function apiCallWithRetry<T>(
  apiCall: () => Promise<T>,
  options: {
    maxRetries?: number;
    retryDelay?: number;
    onRetry?: (attempt: number, maxRetries: number) => void;
    onSuccess?: () => void;
    onError?: (error: any, finalError: any) => void;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    retryDelay = 2000,
    onRetry,
    onSuccess,
    onError
  } = options;

  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await apiCall();
      if (onSuccess) onSuccess();
      return result;
    } catch (error: any) {
      lastError = error;
      const isNetworkError = !error.response;
      
      // Only retry on network errors
      if (isNetworkError && attempt < maxRetries) {
        if (onRetry) onRetry(attempt, maxRetries);
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      } else {
        // Non-network error or max retries reached
        break;
      }
    }
  }

  if (onError) onError(lastError, lastError);
  throw lastError;
}

/**
 * Show a network error alert with retry option
 * This can be used in components to show user-friendly errors
 */
export function showNetworkErrorWithRetry(
  message: string = 'Unable to connect. Please check your internet connection and try again.',
  onRetry: () => void
): void {
  const now = Date.now();

  // Rate limit alerts
  if (now - lastAlertTime < ALERT_COOLDOWN_MS) {
    return;
  }

  lastAlertTime = now;

  CustomAlert.show({
    type: 'error',
    title: 'Connection Error',
    message,
    buttons: [
      { text: 'Retry', onPress: onRetry, style: 'default' },
      { text: 'OK', style: 'cancel' }
    ],
    dismissable: true
  });
}

export default api;
