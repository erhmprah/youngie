# Network Error Fix for Android Emulator

## Problem
The React Native app running on Android Emulator cannot reach the backend server at `http://10.0.2.2:5001`. This results in:
```
ERROR ❌ Network Error: Could not reach backend.
ERROR Attempted URL: http://10.0.2.2:5001/api/chats/user/...
```

## WebSocket Connection Error (Metro HMR)
If you're seeing:
```
Socket connection error: websocket error
```
This is a different issue related to Metro bundler Hot Module Replacement (HMR) WebSocket connections. The fix below addresses both issues.

## Root Cause
Android 9 (API level 28) and above block cleartext (HTTP) traffic by default. Even though the app has `android:usesCleartextTraffic="true"`, a more granular network security configuration is needed for WebSocket (ws://) connections used by Metro.

## Solution Applied

### 1. Created Network Security Config
File: `android/app/src/main/res/xml/network_security_config.xml`
```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <domain-config cleartextTrafficPermitted="true">
        <!-- Android Emulator - maps to host machine's localhost -->
        <domain includeSubdomains="true">10.0.2.2</domain>
        <!-- Localhost -->
        <domain includeSubdomains="true">localhost</domain>
        <!-- Local machine IP addresses for physical device testing -->
        <domain includeSubdomains="true">192.168.0.0</domain>
        <domain includeSubdomains="true">192.168.1.0</domain>
        <domain includeSubdomains="true">192.168.2.0</domain>
        <domain includeSubdomains="true">172.20.10.0</domain>
        <domain includeSubdomains="true">10.0.0.0</domain>
        <!-- Metro bundler default ports -->
        <domain includeSubdomains="true">localhost:8081</domain>
        <domain includeSubdomains="true">10.0.2.2:8081</domain>
    </domain-config>
</network-security-config>
```

### 2. Updated AndroidManifest.xml
Added `android:networkSecurityConfig="@xml/network_security_config"` to the `<application>` tag.

### 3. Created Metro Config (metro.config.js)
Created to ensure Metro binds to `0.0.0.0` making it accessible from the Android Emulator.

## Required Steps to Fix

### Option 1: Rebuild with Expo (Recommended)
```bash
# Stop the current expo server if running
# Then run:
npx expo prebuild --platform android
npx expo run:android
```

### Option 2: Manual Build
```bash
# Clean and rebuild the Android app
cd android
./gradlew clean
cd ..
npx expo run:android
```

### Option 3: If using Expo Go
If you're using Expo Go, you'll need to use a physical device or build a standalone APK since Expo Go has limited native configuration support.

## Verification Steps

1. Ensure backend is running:
   ```bash
   cd backend
   node server.js
   ```
   
2. Verify server is accessible:
   ```bash
   # From your machine (should work)
   curl http://localhost:5001/health
   
   # From another machine on network (should work)
   curl http://YOUR_IP_ADDRESS:5001/health
   ```

3. After rebuilding, test from the Android Emulator

## Alternative Quick Fix
If you need a quick fix without rebuilding, you can also try:
- Using ngrok to expose your local server to the internet
- Using your machine's actual IP address instead of 10.0.2.2 in development
