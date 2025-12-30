# 🚀 Youngie Backend Setup Complete

The backend server is now running on **http://localhost:5000**

## ✅ What's Working
- ✓ Express server running
- ✓ CORS enabled
- ✓ Routes configured
- ✓ JWT authentication setup
- ✓ API endpoints ready

## ⚠️ MongoDB Setup Required

To use the database, you need to set up MongoDB:

### Option 1: MongoDB Atlas (Cloud - Recommended)

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free account
3. Create a new cluster
4. In the "Connect" dialog:
   - Click "Drivers"
   - Select "Node.js" version 4.1 or later
   - Copy the connection string
5. Update `.env` file with your URI:
   ```
   MONGODB_URI=mongodb+srv://your_username:your_password@your_cluster.mongodb.net/youngie
   ```
6. Replace `your_username` and `your_password` with your credentials

### Option 2: Local MongoDB (Advanced)

1. Download and install [MongoDB Community Server](https://www.mongodb.com/try/download/community)
2. Run MongoDB server
3. Update `.env`:
   ```
   MONGODB_URI=mongodb://localhost:27017/youngie
   ```

## 🔌 Server Endpoints

The server is ready for the following endpoints:

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

### Health Check
- `GET /health` - Server status

## 📝 Example API Call

```bash
# Register a user
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "johndoe",
    "email": "john@example.com",
    "password": "password123",
    "age": 16
  }'

# Response includes token to use in subsequent requests
```

## 🔑 Authentication

All endpoints except registration and login require:
```
Header: x-auth-token: <your_token>
```

## 🛑 If Server Crashes

The server will keep running even without MongoDB connected. Once you add a valid MongoDB URI to `.env`, restart the server:

```bash
# Press Ctrl+C in the terminal, then:
npm run dev
```

Or trigger a restart by typing `rs` in the nodemon prompt.

## 🎯 Next Steps

1. Set up MongoDB Atlas account and get connection string
2. Update `.env` with your MONGODB_URI
3. Restart the server
4. Start integrating the frontend with the API

Your backend is ready! 🎉
