# Firebase Cloud Messaging (FCM) Credentials Fix

## ⚠️ Important: EAS Build Error Note

If you encounter the error:
```
Experience with id '02522d86-1963-41a3-b08c-cbd55c5722ab' does not exist.
```

**This means the Expo project doesn't exist on Expo servers.** Please see [EAS_BUILD_FIX.md](./EAS_BUILD_FIX.md) for solutions.

**Recommended: Use Local Android Build** (no Expo account needed):
1. Run `npx expo prebuild --platform android --clean`
2. Run `cd android && ./gradlew assembleDebug`

The `google-services.json` is already in place at `android/app/google-services.json`.

---

## Error Description

```
Default FirebaseApp is not initialized in this process com.erhmprah.youngie
```

This error occurs when the Android app attempts to use Firebase services (like push notifications) but the Firebase configuration file (`google-services.json`) is missing or not properly configured.

---

## Root Cause

The error happens because:

1. **Missing `google-services.json`**: This is the configuration file that connects your app to your Firebase project. It contains your API keys, package name, and other Firebase service configurations.

2. **No FCM Server Key configured**: The Firebase Cloud Messaging Server Key is required to send push notifications from your backend server.

3. **Plugin not configured properly**: The `expo-notifications` plugin in `app.json` needs to reference the Firebase configuration.

---

## Solution Steps

Follow these steps in order to fix the Firebase push notification error.

---

### Step 1: Download google-services.json from Firebase Console

1. **Go to Firebase Console**: Visit [https://console.firebase.google.com/](https://console.firebase.google.com/)

2. **Select your project**: If you don't have a project yet, create one with the name "youngie"

3. **Navigate to Project Settings**:
   - Click the **gear icon** (⚙️) in the left sidebar
   - Select **Project settings**

4. **Add your Android app** (if not already added):
   - Click the **Android icon** (or "Add app" button)
   - Enter the **Android package name**: `com.erhmprah.youngie`
   - Enter an **App nickname**: `youngie`
   - Click **Register app**

5. **Download the config file**:
   - Click **Download google-services.json**
   - Save the file to your computer

> **Note**: If you already have a Firebase project set up, you can skip to step 3 and download the existing `google-services.json` file.

---

### Step 2: Add google-services.json to android/app/ Directory

1. **Locate your project directory**: Navigate to `youngie/`

2. **Copy the file**: Move the downloaded `google-services.json` to:
   ```
   youngie/android/app/google-services.json
   ```

3. **Verify the file exists**:
   ```
   youngie/
   └── android/
       └── app/
           └── google-services.json  ← This file should exist
   ```

---

### Step 3: Update app.json to Reference google-services.json

The `expo-notifications` plugin needs to know where to find the Firebase configuration. Update your `app.json`:

```json
{
  "expo": {
    "plugins": [
      "expo-router",
      "expo-dev-client",
      [
        "expo-splash-screen",
        {
          "image": "./assets/images/youngie_icon.png",
          "imageWidth": 200,
          "resizeMode": "contain",
          "backgroundColor": "#ffffff",
          "dark": {
            "backgroundColor": "#000000"
          }
        }
      ],
      [
        "expo-build-properties",
        {
          "android": {
            "usesCleartextTraffic": true,
            "compileSdkVersion": 35,
            "targetSdkVersion": 35,
            "buildToolsVersion": "35.0.0"
          }
        }
      ],
      [
        "expo-notifications",
        {
          "icon": "./assets/images/youngie_icon.png",
          "color": "#E6F4FE",
          "googleServicesFile": "./android/app/google-services.json"
        }
      ],
      "./withCallKeep",
      "expo-web-browser"
    ]
  }
}
```

**Key changes**:
- Changed `"expo-notifications"` to an array with configuration
- Added `"googleServicesFile": "./android/app/google-services.json"` to point to the Firebase config file

---

### Step 4: Run expo prebuild to Regenerate Android Project

Now regenerate the Android project with the Firebase configuration:

```bash
cd youngie
npx expo prebuild --platform android --clean
```

**What this does**:
- Creates/updates the `android/` directory
- Copies `google-services.json` to the correct build location
- Configures the Android project to use Firebase

**Expected output**:
```
✔ Generated native project: android
✔ Cleaned up native project
```

---

### Step 5: Add FCM Server Key in Expo Dashboard

1. **Go to Expo Dashboard**: Visit [https://expo.dev/](https://expo.dev/)

2. **Select your project**: Click on "youngie"

3. **Navigate to Credentials**:
   - Go to **Project** → **Credentials** (or click "Credentials" in the sidebar)

4. **Configure Push Notifications**:
   - Scroll to **Push Notifications** section
   - Click **Add your FCM Server Key** (or edit existing)

5. **Get your FCM Server Key**:
   - Go back to [Firebase Console](https://console.firebase.google.com/)
   - Select your project
   - Go to **Project Settings** → **Cloud Messaging**
   - Copy the **Server key** (starts with something like `AAAA...`)

6. **Paste in Expo Dashboard**:
   - Paste the FCM Server Key in the input field
   - Click **Save**

> **Alternative**: You can also set the FCM key via CLI:
> ```bash
> eas credentials --platform android
> ```

---

### Step 6: Rebuild the Android APK

> ⚠️ **IMPORTANT**: If you get the error "Experience with id '02522d86-1963-41a3-b08c-cbd55c5722ab' does not exist", see [EAS_BUILD_FIX.md](./EAS_BUILD_FIX.md) for the solution. **Use Option A (Local Build) below**.

Choose one of the methods below:

#### Option A: Using Local Android Build (Recommended - No EAS Account Needed)

```bash
cd youngie
npx expo prebuild --platform android --clean
cd android && ./gradlew assembleDebug
```

**What this does**:
- Generates the native Android project
- Builds a debug APK with bundled JavaScript
- Output: `android/app/build/outputs/apk/debug/app-debug.apk`

**Benefits**:
- ✅ No Expo account required
- ✅ Works completely offline
- ✅ Faster for development
- ✅ `google-services.json` is already in place

#### Option B: Using expo run:android (Development Build)

```bash
cd youngie
npx expo run:android
```

This will:
- Build a debug APK with bundled JavaScript
- Install on connected device/emulator
- The APK will work without Metro bundler

#### Option C: Using EAS Build (Production/Testing) - Requires Expo Project

```bash
cd youngie
eas build --platform android --profile development
```

For a production build:
```bash
eas build --platform android --profile production
```

**Note**: EAS Build requires an Expo account and the project must exist on Expo servers. If you get "Experience does not exist" error, use Option A instead.

**Benefits of EAS Build**:
- Creates a standalone APK with bundled JS
- Can be installed without USB connection
- Better for testing on multiple devices

---

### Step 7: Test Push Notifications

After rebuilding, test that push notifications work:

1. **Install the APK** on your Android device
2. **Register for push notifications** in the app:
   ```javascript
   import * as Notifications from 'expo-notifications';
   
   const { status: existingStatus } = await Notifications.getPermissionsAsync();
   let finalStatus = existingStatus;
   
   if (existingStatus !== 'granted') {
     const { status } = await Notifications.requestPermissionsAsync();
     finalStatus = status;
   }
   
   if (finalStatus !== 'granted') {
     console.log('Failed to get push token for push notification!');
     return;
   }
   
   const token = (await Notifications.getExpoPushTokenAsync()).data;
   console.log('Push token:', token);
   ```

3. **Send a test notification** using Expo's push notification tool:
   - Go to [Expo Push Notifications Tool](https://expo.dev/notifications)
   - Enter your push token
   - Send a test message

---

## FCM Server Key for Backend (Sending Push Notifications)

> ⚠️ **Important Distinction**: There are TWO different FCM configurations needed:
> 1. **For the Android App** (receiving push notifications) → Uses `google-services.json` ✅ Already in place
> 2. **For the Backend** (sending push notifications) → Uses FCM Server Key ❌ Needs to be configured

---

### Understanding the Two FCM Configurations

#### 1. google-services.json (For Receiving Push Notifications)

The `google-services.json` file at `android/app/google-services.json` is already in place. This file:
- Contains Firebase project configuration for the Android app
- Enables the app to **RECEIVE** push notifications from FCM
- Is used by the `expo-notifications` plugin to register the device for push notifications
- Contains the **Firebase Cloud Messaging API (Android)** API key and sender ID

**This is configured automatically when you build the app locally.**

#### 2. FCM Server Key (For Sending Push Notifications)

Your backend server needs the **FCM Server Key** to **SEND** push notifications to devices. This is a separate credential from `google-services.json`.

**Current Status**: The backend/.env file does NOT currently have FCM_SERVER_KEY configured.

---

### How to Find Your FCM Server Key

1. **Go to Firebase Console**: Visit [https://console.firebase.google.com/](https://console.firebase.google.com/)

2. **Select your project**: Click on your "youngie" project

3. **Navigate to Project Settings**:
   - Click the **gear icon** (⚙️) in the left sidebar
   - Select **Project settings**

4. **Go to Cloud Messaging**:
   - Click on **Cloud Messaging** tab (in the left menu under "Project settings")
   - Or search for "Cloud Messaging" in the project settings

5. **Find the Server Key**:
   - Look for **"Server key"** in the "Firebase Cloud Messaging API (deprecated)" section
   - The key typically starts with `AAAA...`
   - Click to reveal the full key
   - Click the **copy icon** to copy the key

> **Note**: If you see "Cloud Messaging API (v1)" instead, you may need to enable the legacy API or use the HTTP v1 API. The legacy Server Key (starting with AAAA) is simpler for basic push notification implementation.

---

### How FCM Works with Local Builds

When building locally (using `expo prebuild` + `gradlew assembleDebug`):

| Component | Source | Status |
|-----------|--------|--------|
| **Android App** receives FCM tokens from | `google-services.json` | ✅ Configured |
| **Backend** sends push notifications via | FCM Server Key in `.env` | ❌ Not configured |

**The app doesn't need the Server Key** - it only needs `google-services.json` to receive notifications. However, **your backend needs the Server Key** to send notifications to users' devices.

---

### Adding FCM_SERVER_KEY to Backend

#### Option 1: Add to backend/.env (Recommended for Local Development)

1. Open `youngie/backend/.env`

2. Add the FCM Server Key at the end of the file:

```env
# FCM Server Key for sending push notifications from backend
# Get this from: Firebase Console → Project Settings → Cloud Messaging → Server Key
FCM_SERVER_KEY=your_fcm_server_key_here
```

3. Replace `your_fcm_server_key_here` with the actual Server Key you copied from Firebase Console (it starts with `AAAA...`)

4. **Restart your backend server** for the new environment variable to take effect:
   ```bash
   cd youngie/backend
   # Kill the existing server (Ctrl+C)
   # Then restart:
   node server.js
   # or
   npm start
   ```

#### Option 2: Using Environment Variables in Production

For production deployments, set the environment variable differently:

**Render/Railway/Heroku**:
- Go to your service dashboard
- Add environment variable: `FCM_SERVER_KEY` = your Server Key

**Docker**:
```bash
docker run -e FCM_SERVER_KEY=your_key ...
```

---

### Backend Code: Sending Push Notifications

Once you have the FCM Server Key configured, your backend can send push notifications like this:

```javascript
// Example: Send push notification using Expo's push API
async function sendPushNotification(expoPushToken, title, body) {
  const message = {
    to: expoPushToken,
    sound: 'default',
    title: title,
    body: body,
    data: { someData: 'goes here' },
  };

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });
}

// OR using FCM directly with the Server Key:
async function sendViaFCM(fcmToken, title, body) {
  const response = await fetch('https://fcm.googleapis.com/fcm/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `key=${process.env.FCM_SERVER_KEY}`,
    },
    body: JSON.stringify({
      to: fcmToken,
      notification: {
        title: title,
        body: body,
      },
    }),
  });
}
```

---

### Verification Checklist

- [x] `google-services.json` exists in `android/app/` (for receiving notifications)
- [x] `app.json` has `googleServicesFile` configured in `expo-notifications` plugin
- [ ] **FCM Server Key** is added to `backend/.env` (for sending notifications)
- [x] Android project was regenerated with `expo prebuild`
- [x] APK was rebuilt successfully (use local build if EAS project doesn't exist)
- [ ] Backend server was restarted after adding FCM Server Key

---

## Verification Checklist

- [ ] `google-services.json` exists in `android/app/`
- [ ] `app.json` has `googleServicesFile` configured in `expo-notifications` plugin
- [ ] FCM Server Key is added in Expo Dashboard (for EAS Build only)
- [ ] Android project was regenerated with `expo prebuild`
- [ ] APK was rebuilt successfully (use local build if EAS project doesn't exist)
- [ ] Push notifications are working on the device

## Alternative: Using Local Build (No Expo Account Required)

If the EAS project doesn't exist, use these commands instead:

```bash
# Generate native Android project
cd youngie
npx expo prebuild --platform android --clean

# Build APK locally
cd android && ./gradlew assembleDebug
```

Output APK: `android/app/build/outputs/apk/debug/app-debug.apk`

See [EAS_BUILD_FIX.md](./EAS_BUILD_FIX.md) for more details.

---

## Troubleshooting

### Error: "google-services.json is missing"

Make sure the file is in the correct location:
```
youngie/android/app/google-services.json
```

Also verify it's being copied during build. Check `android/app/build.gradle` for:
```gradle
apply plugin: 'com.google.gms.google-services'
```

### Error: "Default FirebaseApp not initialized"

1. Verify `google-services.json` is valid and has the correct package name
2. Make sure `app.json` package name matches the one in Firebase Console (`com.erhmprah.youngie`)
3. Run `expo prebuild --clean` and rebuild

### Push notifications not arriving

1. Check that the FCM Server Key is correctly added in Expo Dashboard
2. Verify the app has notification permissions
3. Check device token is being saved correctly
4. Verify your backend is using the correct Expo push token format

---

## Additional Resources

- [Firebase Documentation](https://firebase.google.com/docs/android/setup)
- [Expo Notifications Documentation](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)

---

*Document created: February 2026*
*App Package Name: com.erhmprah.youngie*
*Project ID: 02522d86-1963-41a3-b08c-cbd55c5722ab*
