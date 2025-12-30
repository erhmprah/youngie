# Youngie App - Quick Start Guide

## 🎯 What's Been Completed

### ✅ Full Authentication System
- **Login Screen** - Email/password login with password visibility toggle
- **Signup Screen** - Register with username, email, password, age (13-18)
- **Token Management** - Automatic storage and restoration from AsyncStorage
- **Protected Routes** - Conditional navigation based on login status

### ✅ Backend Ready
- **Server**: Running on `http://localhost:5001`
- **Database**: MongoDB Atlas connected (youngie_db)
- **All API Routes**: Auth, Users, Posts, Chats fully implemented
- **Authentication**: JWT-based with token validation

### ✅ Screens with API Integration
1. **Chat Screen** - Fetches real chats from backend
2. **Feed/Home Screen** - Displays real posts, like functionality
3. **Profile Screen** - Shows user data (ready for API integration)
4. **Explore & Swipe** - UI complete, ready for API integration

## 🚀 How to Run

### Prerequisites
- Node.js installed
- Backend dependencies installed
- Frontend dependencies installed
- MongoDB connection active

### Start the Backend
```bash
cd backend
npm run dev
# Expected output:
# 🚀 Server running on port 5001
# ✓ MongoDB Connected
```

### Start the Frontend
```bash
# In a new terminal, from the root project directory
npm start
# Or for specific platform:
npm run ios    # iOS simulator
npm run android # Android emulator
npm run web    # Web browser
```

## 📱 Test the App

### Flow 1: Register & Login
1. Open the app - you'll see the **Login** screen
2. Click "Sign Up"
3. Enter:
   - Username: `testuser`
   - Email: `test@example.com`
   - Age: `16`
   - Password: `password123`
4. Click "Create Account"
5. App automatically logs in and shows tabs

### Flow 2: Test Features
- **Chat Tab**: See real chats from database
- **Home Tab**: See real posts from database, swipe to like
- **Explore Tab**: Ready for search implementation
- **Swipe Tab**: Ready for match implementation
- **Profile Tab**: Shows your user data

### Flow 3: Logout
- Go to Profile tab
- Click "⚙️ Edit Profile" → "🚪 Logout" (or scroll down to settings)
- Returns to login screen

## 🔌 API Integration Status

### Fully Integrated ✅
- Authentication (register/login/logout)
- Chat list fetching
- Post feed fetching
- Post likes
- User profile

### Ready to Integrate 🔄
- Search users on Explore screen
- Swipe/match on Swipe screen
- User edit profile
- Create posts
- Add comments

## 📂 Key Files

```
youngie/
├── app/
│   ├── _layout.tsx          # Root navigation, AuthProvider wrapper
│   ├── login.tsx            # Login screen with API integration
│   ├── signup.tsx           # Signup screen with API integration
│   └── (tabs)/
│       ├── index.tsx        # Feed screen (API integrated)
│       ├── chat.tsx         # Chat screen (API integrated)
│       ├── explore.tsx      # Explore screen (UI ready)
│       ├── swipe.tsx        # Swipe screen (UI ready)
│       └── profile.tsx      # Profile screen (API ready)
├── contexts/
│   └── AuthContext.tsx      # Auth state management
├── utils/
│   └── api.ts               # API client with interceptors
└── backend/
    ├── server.js            # Express server
    ├── models/              # MongoDB schemas
    └── routes/              # API endpoints
```

## 🐛 Troubleshooting

### Backend not starting?
```bash
# Make sure you're in the backend directory
cd backend
npm run dev
```

### API not found errors?
- Ensure backend is running on port 5001
- Check `.env.local` has `EXPO_PUBLIC_API_URL=http://localhost:5001/api`
- Check network connectivity (on mobile, may need IP instead of localhost)

### Login not working?
- Ensure MongoDB is connected
- Check backend console for errors
- Verify email/password combination

### Token issues?
- Clear AsyncStorage: Delete app data
- Check browser DevTools for token in localStorage (web)
- Verify JWT_SECRET matches in backend .env

## 📚 Next Implementation Tasks

1. **Implement Search**
   - Update explore.tsx to call `userAPI.searchUsers(query)`
   
2. **Implement Swipe/Match**
   - Update swipe.tsx to call `userAPI.getNearbyUsers()` (needs backend update)
   - Handle match with `userAPI.addMatch(userId)`

3. **Comments System**
   - Create comment modal
   - Call `postAPI.addComment(postId, data)`

4. **Chat Details**
   - Create new chat detail screen
   - Show messages for specific chat
   - Implement `chatAPI.sendMessage()`

5. **Profile Edit**
   - Create edit profile modal
   - Call `userAPI.updateProfile()`

## 💡 Tips

- Use React DevTools to inspect component state
- Check network tab to see all API calls
- Backend console shows request logs
- AsyncStorage persists data between app restarts
- Token automatically added to all requests via axios interceptor

## 📞 Support

If you encounter issues:
1. Check console logs in both frontend and backend
2. Verify backend is running
3. Check MongoDB connection status
4. Ensure all dependencies are installed
5. Check network connectivity (if on device)

Enjoy building with Youngie! 🎉
