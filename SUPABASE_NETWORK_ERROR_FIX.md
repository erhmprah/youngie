# Supabase Network Error Fix

## Problem

The React Native/Expo app was experiencing network errors when attempting to authenticate with Supabase:

```
ERROR  [TypeType: Network request failed] 
ERROR  Sign In Error: [AuthRetryableFetchError: Network request failed]
```

If you see logs like:
```
LOG  Network error, retrying... (3 attempts left)
 LOG  Network error, retrying... (2 attempts left)
 LOG  Network error, retrying... (1 attempts left)
```
This means the network is completely blocked and you need to rebuild the app.

## Root Causes

1. **Missing Network Security Config**: Android 9+ blocks cleartext (HTTP) traffic by default. The app was missing a proper `network_security_config.xml` to allow necessary network traffic.

2. **No Retry Logic**: The Supabase client was failing immediately on network errors without retry attempts.

3. **Missing Android Manifest Configuration**: The AndroidManifest.xml wasn't configured to use the network security config.

4. **Supabase Project Paused**: Free tier projects pause after 7 days of inactivity.

## Fixes Applied

### 1. Created Network Security Config
**File**: `android/app/src/main/res/xml/network_security_config.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <!-- Allow cleartext traffic for local development -->
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
    
    <!-- Allow cleartext to local development servers -->
    <domain-config cleartextTrafficPermitted="true">
        <!-- Android Emulator -->
        <domain includeSubdomains="true">10.0.2.2</domain>
        <domain includeSubdomains="true">10.0.0.0</domain>
        <!-- Localhost -->
        <domain includeSubdomains="true">localhost</domain>
        <domain includeSubdomains="true">127.0.0.1</domain>
        <!-- Common local network ranges -->
        <domain includeSubdomains="true">192.168.0.0</domain>
        <domain includeSubdomains="true">192.168.1.0</domain>
        <domain includeSubdomains="true">192.168.2.0</domain>
        <domain includeSubdomains="true">192.168.10.0</domain>
        <domain includeSubdomains="true">172.20.10.0</domain>
        <!-- Metro bundler -->
        <domain includeSubdomains="true">localhost:8081</domain>
        <domain includeSubdomains="true">10.0.2.2:8081</domain>
    </domain-config>
    
    <!-- Supabase domains (must use HTTPS) -->
    <domain-config cleartextTrafficPermitted="false">
        <domain includeSubdomains="true">supabase.co</domain>
        <domain includeSubdomains="true">supabase.in</domain>
    </domain-config>
</network-security-config>
```

### 2. Updated AndroidManifest.xml
Added `android:networkSecurityConfig="@xml/network_security_config"` to the `<application>` tag.

### 3. Enhanced Supabase Client with Retry Logic
**File**: `utils/supabase.ts`

Added a custom fetch function with automatic retry:
- Retries up to 3 times on network errors
- Uses exponential backoff (1000ms, 2000ms, 4000ms)
- Catches both TypeError and "Network request failed" errors

## CRITICAL: You Must Rebuild the App

The network security config changes require rebuilding the Android app. Run these commands:

```bash
cd youngie

# Step 1: Stop any running Expo server
# (Press Ctrl+C in the terminal running expo)

# Step 2: Clean previous build
rm -rf android/app/build

# Step 3: Generate native Android project
npx expo prebuild --platform android

# Step 4: Build and run
npx expo run:android
```

### Alternative: Using EAS Build (for production)
```bash
eas build -p android --profile development
```

## Troubleshooting

If the network error persists after rebuilding:

### 1. Check Supabase Project Status
- Go to https://supabase.com/dashboard
- Select your project
- If you see "Paused" status, click "Restore project"
- Free tier projects pause after 7 days of inactivity

### 2. Verify API Keys
Check that the Supabase URL and ANON_KEY in `utils/supabase.ts` are correct:
```typescript
const supabaseUrl = 'https://srcpkwkdvslsdjegqjff.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

### 3. Test Connectivity
Try accessing Supabase from your browser:
- Open https://srcpkwkdvslsdjegqjff.supabase.co in a browser
- You should see a JSON response

### 4. Check Device Date/Time
- Ensure your device's date and time are correct
- Incorrect date/time can cause SSL/TLS certificate validation to fail

### 5. Check Network
- Ensure the device has an active internet connection
- Try disabling VPN or corporate firewall
- Test with mobile data instead of WiFi

### 6. Check Android Permissions
Ensure INTERNET permission is in AndroidManifest.xml:
```xml
<uses-permission android:name="android.permission.INTERNET"/>
```

### 7. For Emulator Issues
- Try using a physical device instead of emulator
- If using emulator, ensure it's not in offline mode
- Check that "Allow network requests" is enabled in emulator settings

