# Video Chat Setup Guide

## WebRTC Development Build Required

The video chat feature requires a development build to work properly. The error "WebRTC not supported. Please use a development build" occurs when running the app in production mode.

## Development Setup

### 1. Install Dependencies

Make sure you have the required dependencies installed:

```bash
npm install react-native-webrtc socket.io-client
```

### 2. Run in Development Mode

To use video chat, you must run the app in development mode:

```bash
# Start the development server
npm start

# Or run directly on device/simulator
npm run android  # For Android
npm run ios      # For iOS
```

### 3. Platform-Specific Setup

#### Android
- Camera and microphone permissions are automatically requested
- The app.json includes all necessary permissions
- Make sure to grant permissions when prompted

#### iOS
- Add the following to your `ios/YourApp/Info.plist`:
```xml
<key>NSCameraUsageDescription</key>
<string>This app needs access to camera for video chat functionality.</string>
<key>NSMicrophoneUsageDescription</key>
<string>This app needs access to microphone for video chat functionality.</string>
<key>NSLocalNetworkUsageDescription</key>
<string>This app needs access to local network for peer-to-peer video chat.</string>
```

### 4. Socket Server

Make sure your socket server is running and accessible. The app connects to the URL specified in `SOCKET_URL` from `@/utils/api`.

### 5. Troubleshooting

#### Common Issues:

1. **"WebRTC not supported" error**: 
   - Ensure you're running in development mode
   - Check that `react-native-webrtc` is properly installed
   - Verify the app is not running in production/experience mode

2. **Permission denied**:
   - Grant camera and microphone permissions
   - Check app settings on device

3. **Connection failed**:
   - Verify socket server is running
   - Check network connectivity
   - Ensure firewall allows WebSocket connections

4. **No video feed**:
   - Check camera is not in use by another app
   - Verify camera permissions are granted
   - Try restarting the app

### 6. TURN Server Configuration

TURN servers are required for production deployments and restrictive network environments:

#### Quick Setup with Twilio (Free for Development):
```bash
# 1. Sign up at https://www.twilio.com/
# 2. Get Account SID and Auth Token from Dashboard
# 3. Run the helper script:
export TWILIO_ACCOUNT_SID=your_account_sid
export TWILIO_AUTH_TOKEN=your_auth_token
node get-turn-credentials.js

# 4. Copy the output to backend/.env
```

#### Alternative Free TURN Providers:
- **Metered.ca**: https://www.metered.ca/ (1,000 minutes free)
- **Xirsys**: https://xirsys.com/ (limited free tier)

#### Manual Configuration:
Add to `backend/.env`:
```bash
TURN_SERVER_URL=turn:your-turn-server.com:3478
TURN_USERNAME=your-username
TURN_CREDENTIAL=your-password
```

### 7. Production Deployment

For production builds, you'll need to:
- Set up TURN servers for better NAT traversal
- Configure proper SSL certificates
- Test on real devices (not simulators)
- Consider using a production-grade WebRTC library

## Development vs Production

- **Development**: Use `expo start` or `expo run:android/ios`
- **Production**: Use `expo build` or `eas build` (but WebRTC may have limitations)

The video chat feature is designed for development and testing purposes. For production use, consider using a dedicated WebRTC service or implementing additional error handling and fallback mechanisms.