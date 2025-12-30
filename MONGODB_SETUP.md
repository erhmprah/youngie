# MongoDB & Backend Integration Guide

## 📋 Setup Instructions

### Backend Setup

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create `.env` file from `.env.example`:**
   ```bash
   cp .env.example .env
   ```

4. **Update `.env` with your MongoDB credentials:**
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/youngie
   JWT_SECRET=your_strong_secret_key_here
   PORT=5000
   NODE_ENV=development
   ```

5. **Get your MongoDB URI:**
   - Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
   - Create a free account
   - Create a new cluster
   - Click "Connect" and copy your connection string
   - Replace `<username>` and `<password>` with your credentials

6. **Start the backend server:**
   ```bash
   npm run dev
   ```
   Server should run on `http://localhost:5000`

### Frontend Setup

1. **Install frontend dependencies:**
   ```bash
   npm install
   ```

2. **Update environment variables:**
   - Create or update `.env.local` in the root:
   ```
   EXPO_PUBLIC_API_URL=http://localhost:5000/api
   ```

3. **Start the Expo app:**
   ```bash
   npm start
   ```

## 🗄️ Database Models

### User
- `username` - Unique username
- `email` - Unique email
- `password` - Hashed password
- `bio` - User biography
- `age` - Age (13-18 only)
- `interests` - Array of interests
- `avatar` - Avatar URL
- `friends` - Array of friend user IDs
- `matches` - Array of matched user IDs
- `followers` - Array of follower user IDs
- `following` - Array of following user IDs

### Chat
- `participants` - Array of user IDs in chat
- `messages` - Array of message objects
- `lastMessage` - Last message text
- `isGroupChat` - Boolean for group chat
- `chatName` - Optional group chat name

### Post
- `author` - Author user ID
- `content` - Post content text
- `image` - Optional image URL
- `likes` - Array of user IDs who liked
- `comments` - Array of comment objects
- `shares` - Number of shares
- `isPublic` - Public visibility flag

## 🔗 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Users
- `GET /api/users/:userId` - Get user profile
- `PUT /api/users/:userId` - Update profile
- `GET /api/users/search` - Search users
- `POST /api/users/:userId/friends/:friendId` - Add friend

### Chats
- `GET /api/chats/user/:userId` - Get user chats
- `GET /api/chats/:chatId` - Get specific chat
- `POST /api/chats` - Create new chat
- `POST /api/chats/:chatId/messages` - Send message

### Posts
- `GET /api/posts` - Get all posts
- `GET /api/posts/user/:userId` - Get user posts
- `POST /api/posts` - Create post
- `POST /api/posts/:postId/like` - Like/unlike post
- `POST /api/posts/:postId/comment` - Add comment

## 🔑 Authentication

All requests (except `/auth/register` and `/auth/login`) require:
```
Header: x-auth-token: <token>
```

The token is automatically added by the axios interceptor when stored in AsyncStorage.

## 📱 Using the API in Your App

Import and use the API functions:

```typescript
import { authAPI, userAPI, chatAPI, postAPI } from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';

// In your component:
const { login, register, logout, user, token } = useAuth();

// Login
await login('user@example.com', 'password');

// Get user profile
const profile = await userAPI.getProfile(userId);

// Create post
await postAPI.createPost({
  author: userId,
  content: 'Hello world!',
});
```

## 🐛 Troubleshooting

### "Cannot connect to MongoDB"
- Check your MongoDB connection string
- Ensure cluster is active
- Verify network access whitelist includes your IP

### "Unauthorized" errors
- Make sure token is stored in AsyncStorage
- Check token hasn't expired (7 days)
- Verify `x-auth-token` header is being sent

### "Port 5000 already in use"
- Change PORT in `.env`
- Or kill process: `lsof -ti:5000 | xargs kill -9`

## 🚀 Deployment

For production, update:
1. `EXPO_PUBLIC_API_URL` to your deployed backend URL
2. `MONGODB_URI` to production database
3. `JWT_SECRET` to a strong random key
4. Set `NODE_ENV=production`

Recommended deployment platforms:
- Backend: Heroku, Railway, Render
- Database: MongoDB Atlas
- Frontend: Expo (EAS Build & Submit)
