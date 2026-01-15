import axios, { AxiosInstance } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Use machine IP for iOS simulator or physical devices.
// For Android emulator, '10.0.2.2' maps to the host machine's localhost.
// For iOS simulator, 'localhost' (or your machine's IP) often works.
// For physical devices, you MUST use your machine's actual local IP address (e.g., '192.168.1.X').
// Ensure your backend server is running and accessible on the specified port.
// If you encounter a 'Network Error', verify this URL is correct for your device/emulator and network.
// Default to 10.0.2.2 for Android emulator (backend runs on port 5001)
// For physical devices, use machine's IP (e.g., '192.168.1.61:5001')
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:5001/api';

console.log('🌐 API Configured:', API_URL);
const BASE_URL = API_URL.replace('/api', '');

const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 seconds timeout
});

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

// Add response interceptor to debug connection issues
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      console.error('❌ Network Error: Could not reach backend.');
      console.error(`   Attempted URL: ${error.config?.baseURL}${error.config?.url}`);
      console.error('   Check your API_URL and ensure the server is running.');
    } else {
      console.log('⚠️ API Error:', error.response.status, error.response.data);
    }
    return Promise.reject(error);
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
  getCurrentUser: () => api.get('/auth/me'),
  checkUsername: (username: string) => api.get(`/auth/check-username/${username}`),
  checkEmail: (email: string) => api.get(`/auth/check-email/${email}`),
  checkConnection: () => axios.get(`${BASE_URL}/health`),
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
};

export const notificationAPI = {
  getNotifications: () => api.get('/notifications'),
  markAsRead: (notificationId: string) => api.put(`/notifications/${notificationId}/read`),
  markAllAsRead: () => api.put('/notifications/read-all'),
  clearAll: () => api.delete('/notifications'),
  getUnreadCount: () => api.get('/notifications/unread-count'),
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
  votePoll: (chatId: string, messageId: string, optionIndex: number) => api.post(`/chats/${chatId}/messages/${messageId}/vote`, { optionIndex }),
};

export const postAPI = {
  getPosts: (isAnonymous?: boolean) => api.get('/posts', { params: { isAnonymous } }),
  getUserPosts: (userId: string) => api.get(`/posts/user/${userId}`),
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
  create: (data: { name: string; description: string; image?: string; requiresApproval?: boolean }) =>
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
  if (imagePath.startsWith('http')) return imagePath; // Already a full URL
  return `${BASE_URL}${imagePath}`;
};

export const SOCKET_URL = BASE_URL; // Or a specific port if your sockets are on a different one

export { BASE_URL };

export default api;
