# Youngie API Documentation

## Base URL
`http://localhost:5001/api`

## Authentication
All endpoints (except `/auth/register` and `/auth/login`) require:
```
Header: x-auth-token: <jwt_token>
```

---

## Authentication Endpoints

### Register User
- **POST** `/auth/register`
- **Body:**
  ```json
  {
    "username": "string",
    "email": "string",
    "password": "string",
    "age": number (13-18)
  }
  ```
- **Response:** `{ token, user: { id, username, email, age } }`

### Login User
- **POST** `/auth/login`
- **Body:**
  ```json
  {
    "email": "string",
    "password": "string"
  }
  ```
- **Response:** `{ token, user: { id, username, email, age } }`

### Get Current User
- **GET** `/auth/me`
- **Response:** User object with all details

---

## User Endpoints

### Get User Profile
- **GET** `/users/:userId`
- **Response:** Full user profile with populated friends, matches, followers

### Update User Profile
- **PUT** `/users/:userId`
- **Body:**
  ```json
  {
    "bio": "string",
    "interests": ["string"],
    "avatar": "url",
    "location": "string",
    "username": "string"
  }
  ```

### Search Users
- **GET** `/users/search/query?q=search_term`
- **Query:** `q` - search term (searches username, bio, interests)
- **Response:** Array of matching users (max 10)

### Get Nearby Users (For Swipe)
- **GET** `/users/nearby/all`
- **Response:** Array of users not yet friended or matched

### Add Friend
- **POST** `/users/:userId/friends/:friendId`
- **Response:** `{ msg: "Friend added successfully" }`

### Remove Friend
- **DELETE** `/users/:userId/friends/:friendId`
- **Response:** `{ msg: "Friend removed" }`

### Add Match
- **POST** `/users/:userId/matches/:matchId`
- **Response:** `{ msg: "Match added successfully" }`

### Get User Stats
- **GET** `/users/:userId/stats`
- **Response:**
  ```json
  {
    "userId": "string",
    "username": "string",
    "posts": number,
    "friends": number,
    "matches": number,
    "followers": number,
    "following": number
  }
  ```

---

## Post Endpoints

### Get Feed (All Public Posts)
- **GET** `/posts/`
- **Response:** Array of posts sorted by newest first (limit 50)

### Get User Posts
- **GET** `/posts/user/:userId`
- **Response:** Array of user's posts

### Create Post
- **POST** `/posts/`
- **Body:**
  ```json
  {
    "content": "string",
    "image": "url (optional)"
  }
  ```
- **Response:** Created post object

### Get Single Post
- **GET** `/posts/:postId`
- **Response:** Post object with all populated fields

### Like/Unlike Post
- **POST** `/posts/:postId/like`
- **Response:** Updated post object (like is toggled)

### Add Comment
- **POST** `/posts/:postId/comment`
- **Body:**
  ```json
  {
    "content": "string"
  }
  ```
- **Response:** Updated post object with new comment

### Delete Post
- **DELETE** `/posts/:postId`
- **Note:** Only post author can delete
- **Response:** `{ msg: "Post deleted" }`

### Delete Comment
- **DELETE** `/posts/:postId/comment/:commentId`
- **Note:** Only comment author can delete
- **Response:** Updated post object

### Get Trending Posts
- **GET** `/posts/trending/hot`
- **Response:** Array of posts sorted by likes (limit 20)

---

## Chat Endpoints

### Get User Chats
- **GET** `/chats/user/:userId`
- **Response:** Array of chats for user, sorted by latest message

### Get Single Chat
- **GET** `/chats/:chatId`
- **Response:** Chat object with all messages populated

### Create Chat
- **POST** `/chats/`
- **Body:**
  ```json
  {
    "participants": ["userId1", "userId2"],
    "isGroupChat": boolean,
    "chatName": "string (required if group)"
  }
  ```
- **Response:** Created chat object

### Send Message
- **POST** `/chats/:chatId/messages`
- **Body:**
  ```json
  {
    "content": "string"
  }
  ```
- **Response:** Updated chat with new message

### Mark Messages as Read
- **POST** `/chats/:chatId/read`
- **Response:** `{ msg: "Messages marked as read" }`

### Get Unread Count
- **GET** `/chats/:chatId/unread`
- **Response:** `{ unreadCount: number }`

### Delete Message
- **DELETE** `/chats/:chatId/messages/:messageId`
- **Note:** Only message sender can delete
- **Response:** `{ msg: "Message deleted" }`

### Search Chats
- **GET** `/chats/search/by-user?q=search_term`
- **Response:** Array of matching chats

---

## Health Check

### Server Status
- **GET** `/health`
- **Response:** `{ status: "Server is running", timestamp: "ISO string" }`

---

## Error Responses

All errors follow this format:
```json
{
  "error": "Error message",
  "msg": "User-friendly message"
}
```

### Common Status Codes
- `200` - Success
- `400` - Bad request
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (not authorized for action)
- `404` - Not found
- `500` - Server error

---

## Example Usage

### Register and Login
```bash
# Register
curl -X POST http://localhost:5001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "johndoe",
    "email": "john@example.com",
    "password": "password123",
    "age": 16
  }'

# Response: { token: "...", user: {...} }

# Login
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

### Create Post
```bash
curl -X POST http://localhost:5001/api/posts \
  -H "Content-Type: application/json" \
  -H "x-auth-token: <token>" \
  -d '{
    "content": "Hello world!",
    "image": "https://example.com/image.jpg"
  }'
```

### Send Message
```bash
curl -X POST http://localhost:5001/api/chats/<chatId>/messages \
  -H "Content-Type: application/json" \
  -H "x-auth-token: <token>" \
  -d '{
    "content": "Hi there!"
  }'
```

---

## Rate Limiting
Currently no rate limiting implemented. Consider adding for production.

## WebSocket Support
For real-time messaging, WebSocket support should be added in production.
