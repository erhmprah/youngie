# Physical Device Network Fix

## Problem
When testing the Expo/React Native app on a physical Android device, the app cannot connect to the backend server running on the development machine.

## Root Cause
The app is configured to use `http://10.0.2.2:5001/api` which is the special IP address for Android Emulator that maps to the host machine's localhost. This does NOT work on physical devices.

## Solution

### Step 1: Update .env file

Change the `EXPO_PUBLIC_API_URL` in your `.env` file to use your machine's local IP address:

```
# Android Emulator (doesn't work on physical device)
EXPO_PUBLIC_API_URL=http://10.0.2.2:5001/api

# Physical Device - use your local IP address
EXPO_PUBLIC_API_URL=http://192.168.1.99:5001/api
```

### Step 2: Find Your Local IP Address

Run this command in terminal/command prompt:
```
ipconfig
```

Look for "Wireless LAN adapter Wi-Fi" section and find "IPv4 Address" (e.g., `192.168.1.99`).

### Step 3: Update network_security_config.xml (if needed)

The file at `android/app/src/main/res/xml/network_security_config.xml` already includes common local network ranges. If your IP is in a different range, add it:

```xml
<domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="true">192.168.1.0</domain>
    <!-- Add your specific subnet if different -->
</domain-config>
```

### Step 4: Rebuild the App

Since environment variables are embedded at build time, you need to rebuild:

```bash
# Clear Metro cache
npx expo start --clear

# Or rebuild Android APK
cd android && ./gradlew assembleDebug
```

### Step 5: Ensure Same Network

- Your physical device must be connected to the same WiFi network as your development machine
- The backend server must be running and accessible on port 5001

### Step 6: Verify Backend is Listening on All Interfaces

In `backend/server.js`, ensure the server is configured to listen on all network interfaces:

```javascript
const HOST = process.env.HOST || '0.0.0.0';
httpServer.listen(PORT, HOST, () => {
  console.log(`👉 Local Network URL: http://${localIp}:${PORT}`);
});
```

## Quick Reference

| Device Type | API URL |
|-------------|---------|
| Android Emulator | `http://10.0.2.2:5001/api` |
| iOS Simulator | `http://localhost:5001/api` |
| Physical Device | `http://192.168.X.X:5001/api` |
| Production | Your deployed backend URL |

## Troubleshooting

### "Connection Refused" Error
- Make sure the backend server is running
- Check if port 5001 is open on your firewall
- Verify the IP address is correct

### "Network Timeout" Error
- Ensure device and computer are on the same WiFi
- Check if antivirus is blocking the connection

### "Cleartext Not Permitted" Error
- Ensure `android:usesCleartextTraffic="true"` is in AndroidManifest.xml
- Verify network_security_config.xml allows your IP range
