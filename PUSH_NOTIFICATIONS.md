# Push Notifications Documentation

## Table of Contents
1. [Overview](#overview)
2. [Backend Setup](#backend-setup)
3. [Frontend Setup](#frontend-setup)
4. [Required Configuration](#required-configuration)
5. [Testing](#testing)
6. [Troubleshooting](#troubleshooting)
7. [API Reference](#api-reference)

---

## Overview

The push notification system uses a hybrid approach supporting both **Expo Push Notifications** and **Firebase Cloud Messaging (FCM)** for Android devices. This allows notifications to be delivered to iOS, Android, and web platforms.

### Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Mobile App    │────▶│   Backend API   │────▶│  Expo Push API  │
│  (Expo Client)  │     │  (Express.js)   │     │   (Expo FCM)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │
        │                       │
        ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│  User Device    │     │   MongoDB       │
│  (Push Token)   │     │   (Token Store) │
└─────────────────┘     └─────────────────┘
```

### Key Components

- **[`backend/services/push-notification.js`](backend/services/push-notification.js)** - Core service for sending notifications
- **[`hooks/usePushNotifications.ts`](hooks/usePushNotifications.ts)** - Frontend hook for token registration
- **[`backend/routes/notifications.js`](backend/routes/notifications.js)** - API endpoints for token management

---

## Backend Setup

### Dependencies

The backend uses `firebase-admin` for FCM support. It's already added to [`backend/package.json`](backend/package.json:19):

```json
{
  "dependencies": {
    "firebase-admin": "^12.0.0"
  }
}
```

**To install the dependencies:**

```bash
cd backend
npm install
```

### Push Notification Service

The service is located at [`backend/services/push-notification.js`](backend/services/push-notification.js) and provides:

- `sendPushNotification()` - Send notification to a user
- `registerPushToken()` - Register a device token
- `unregisterPushToken()` - Remove a device token
- `getUserPushTokens()` - Get all tokens for a user
- Helper functions for specific notification types:
  - `sendLikeNotification()` - Like on a post
  - `sendCommentNotification()` - Comment on a post
  - `sendFollowNotification()` - New follower
  - `sendMessageNotification()` - New message
  - `sendMatchNotification()` - New match (dating feature)
  - `sendCommentLikeNotification()` - Like on a comment
  - `sendCommentReplyNotification()` - Reply to a comment

### Notification Trigger Points

Push notifications are triggered from various places in the backend:

| Event | File | Function |
|-------|------|----------|
| Post liked | `routes/posts.js` | `sendLikeNotification()` |
| Comment added | `routes/posts.js` | `sendCommentNotification()` |
| User followed | `routes/users.js` | `sendFollowNotification()` |
| Message sent | `routes/chats.js` | `sendMessageNotification()` |
| New match | `routes/users.js` | `sendMatchNotification()` |

---

## Frontend Setup

### Dependencies

`expo-notifications` is already installed in the frontend:

```json
{
  "dependencies": {
    "expo-notifications": "~0.32.16"
  }
}
```

### Push Notification Hook

The [`hooks/usePushNotifications.ts`](hooks/usePushNotifications.ts) hook provides:

```typescript
const { 
  hasPermission,  // Whether notification permission is granted
  token,          // The Expo push token
  error,          // Any error that occurred
  isLoading,      // Whether registration is in progress
  registerPushToken,     // Call to register for push notifications
  unregisterPushToken,   // Call to unregister (for logout)
  reRegisterOnLogin      // Call to re-register after login
} = usePushNotifications();
```

### Token Registration Flow

1. **App Start/Login**: Call `registerPushToken()` to request permissions and get a push token
2. **Token Received**: The hook automatically registers the token with the backend
3. **On Logout**: Call `unregisterPushToken()` to remove the token

### Integration Example

```typescript
import { usePushNotifications } from '../hooks/usePushNotifications';

function App() {
  const { registerPushToken, hasPermission } = usePushNotifications();
  
  useEffect(() => {
    // Register on app start
    registerPushToken();
  }, []);
  
  // ...
}
```

### Notification Types Handled

The app handles the following notification types in [`app/_layout.tsx`](app/_layout.tsx:72):

| Type | Action |
|------|--------|
| `incoming-call` | Navigate to voice call screen |
| `message` / `new-message` | Navigate to chat screen |
| `like` / `post-like` | Navigate to post |
| `comment` / `post-comment` | Navigate to post (comments focused) |
| `follow` | Navigate to user profile |
| `match` | Navigate to user profile |
| `mention` | Navigate to post or chat |
| `friend-request` | Navigate to user profile |
| Default | Navigate to notifications screen |

---

## Required Configuration

### iOS Setup (APNs)

1. **Create APNs Certificate**:
   - Go to [Apple Developer Portal](https://developer.apple.com)
   - Create an App ID with Push Notifications capability
   - Create a APNs SSL certificate
   - Download and export as `.p12` file

2. **Configure in Expo**:
   ```bash
   expo push:cert
   ```

3. **Upload to Expo**:
   ```bash
   expo push:upload:ios --push-cert path/to/certificate.p12
   ```

### Android Setup (Firebase)

1. **Create Firebase Project**:
   - Go to [Firebase Console](https://console.firebase.google.com)
   - Create a new project
   - Add Android app with package name: `com.erhmprah.youngie`

2. **Download Configuration**:
   - Download `google-services.json`
   - Place in `android/app/google-services.json`

3. **Configure in app.json**:
   ```json
   {
     "expo": {
       "android": {
         "googleServicesFile": "./android/app/google-services.json"
       }
     }
   }
   ```

### FCM Server Key for Expo

To enable push notifications on Android devices:

1. **Get FCM Server Key**:
   - In Firebase Console, go to Project Settings → Cloud Messaging
   - Copy the Server Key

2. **Add to Expo**:
   - Go to [Expo Dashboard](https://expo.dev)
   - Select your project
   - Go to Credentials → Push Notifications
   - Add the FCM Server Key

---

## Testing

### Using Expo Push Notification Tool

1. **Get your push token**:
   ```javascript
   // Add this to your app to log the token
   const token = await Notifications.getExpoPushTokenAsync({
     projectId: require('expo-constants').expoConfig?.extra?.eas?.projectId
   });
   console.log(token.data);
   ```

2. **Send test notification**:
   - Go to [Expo Push Notifications Tool](https://expo.dev/notifications)
   - Enter your push token
   - Fill in the message details
   - Click "Send"

### Backend Testing

Test the notification API directly:

```bash
# Register a token
curl -X POST http://localhost:5001/api/notifications/register-token \
  -H "Content-Type: application/json" \
  -H "x-auth-token: YOUR_AUTH_TOKEN" \
  -d '{"token": "ExponentPushToken[xxx]", "device": "iPhone", "platform": "expo"}'

# Get registered tokens
curl http://localhost:5001/api/notifications/device-tokens \
  -H "x-auth-token: YOUR_AUTH_TOKEN"
```

---

## Troubleshooting

### Common Issues

#### 1. Notifications Not Received

**Symptoms**: Push token is registered but notifications don't arrive.

**Solutions**:
- Check if the device has notification permissions enabled
- Verify the push token is correctly registered in the backend
- Check Expo push status in [Expo Dashboard](https://expo.dev)
- Ensure the device has network connectivity

#### 2. "No push tokens found"

**Symptoms**: Backend returns "No push tokens found" error.

**Solutions**:
- Ensure user is logged in when registering token
- Check that `registerPushToken()` is called after authentication
- Verify the token is being saved to the User model in MongoDB

#### 3. iOS Push Notifications Not Working

**Symptoms**: Notifications work on Android but not iOS.

**Solutions**:
- Verify APNs certificate is valid and not expired
- Check that the certificate matches the bundle ID
- Ensure Push Notifications capability is enabled in Xcode
- Rebuild the iOS project after adding capabilities

#### 4. Android Notifications Not Working

**Symptoms**: Notifications work on iOS but not Android.

**Solutions**:
- Verify `google-services.json` is in the correct location
- Check that the package name matches in Firebase and app.json
- Ensure FCM Server Key is added to Expo dashboard
- Run `expo prebuild` to regenerate Android project

#### 5. Token Registration Fails

**Symptoms**: `registerTokenWithBackend()` returns false.

**Solutions**:
- Check network connectivity
- Verify backend is running
- Ensure authentication token is valid
- Check MongoDB connection

### Debug Mode

Enable verbose logging:

```typescript
// In your app
console.log('📱 Push Token:', token);
console.log('✅ Backend Registration:', result);
```

Check backend logs:

```bash
# In backend terminal
npm run dev
# Look for push notification related logs
```

---

## API Reference

### Endpoints

All endpoints require authentication via `x-auth-token` header.

#### POST /notifications/register-token

Register a push token for the authenticated user.

**Request:**
```json
{
  "token": "ExponentPushToken[xxxxx]",
  "device": "iPhone 15",
  "platform": "expo"
}
```

**Parameters:**
- `token` (required) - The push token from Expo/FCM
- `device` (optional) - Device identifier (default: "unknown")
- `platform` - Platform type: "expo" or "fcm" (default: "expo")

**Response:**
```json
{
  "success": true,
  "message": "Push token registered successfully",
  "tokenCount": 2
}
```

#### DELETE /notifications/unregister-token

Remove a push token from the authenticated user.

**Request:**
```json
{
  "token": "ExponentPushToken[xxxxx]"
}
```

**Parameters:**
- `token` (required) - The push token to remove

**Response:**
```json
{
  "success": true,
  "message": "Push token removed successfully",
  "tokenCount": 1
}
```

#### GET /notifications/device-tokens

Get all registered push tokens for the authenticated user.

**Response:**
```json
{
  "success": true,
  "tokens": [
    {
      "token": "ExponentPushToken[xxxxx]",
      "device": "iPhone 15",
      "platform": "expo",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

---

## Related Documentation

- [MongoDB Setup](MONGODB_SETUP.md) - Database configuration
- [Backend API Documentation](backend/API_DOCS.md) - Full API reference Chat README
- [Video](README_VIDEOCHAT.md) - Voice/video call setup
- [Expo Notifications Docs](https://docs.expo.dev/push-notifications/overview/) - Official Expo documentation
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging) - FCM documentation
