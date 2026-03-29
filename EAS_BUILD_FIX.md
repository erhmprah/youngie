# EAS Build Fix: Experience Does Not Exist

## Error Description

```
Experience with id '02522d86-1963-41a3-b08c-cbd55c5722ab' does not exist.
```

This error occurs when trying to run EAS Build or EAS Update commands.

---

## Why This Error Occurs

The error `Experience with id '02522d86-1963-41a3-b08c-cbd55c5722ab' does not exist` happens because:

1. **Project ID doesn't exist on Expo servers**: The Expo project ID in your `app.json` (`02522d86-1963-41a3-b08c-cbd55c5722ab`) was never created on Expo's servers, or the project was deleted.

2. **No EAS project linked**: The project hasn't been properly linked to an Expo/EAS project.

3. **Local-only project**: This is a local-only Expo project that was never registered with Expo's cloud services.

---

## Solutions

### Option A: Use Local Android Build (Recommended - No EAS Account Needed)

This is the simplest solution that doesn't require an Expo account or EAS subscription.

#### Step 1: Run expo prebuild to Generate Native Android Project

```bash
cd youngie
npx expo prebuild --platform android --clean
```

This command:
- Generates the native Android project in the `android/` directory
- Copies `google-services.json` to the correct build location
- Configures the Android project with Firebase and all plugins

#### Step 2: Build the APK Locally

**Option 1: Using expo run:android**
```bash
npx expo run:android
```

This will:
- Build a debug APK with bundled JavaScript
- Launch Metro bundler if needed
- Install on connected device/emulator

**Option 2: Using Gradle directly (Faster)**
```bash
cd android && ./gradlew assembleDebug
```

This builds the APK directly using Gradle:
- Output: `android/app/build/outputs/apk/debug/app-debug.apk`
- No Metro bundler required
- Faster build times

#### Key Points for Option A:
- ✅ No Expo account required
- ✅ No EAS subscription needed
- ✅ Works completely offline
- ✅ `google-services.json` is already in place at `android/app/google-services.json`
- ✅ Works for development and testing

---

### Option B: Create a New Expo Project

If you want to use EAS Build in the future, you'll need to create a new Expo project.

#### Method 1: Using CLI

```bash
cd youngie
npx expo register
```

This will guide you through creating a new Expo account and project.

#### Method 2: Using Expo Dashboard

1. Go to [Expo Dashboard](https://expo.dev/)
2. Click **"New Project"**
3. Follow the prompts to create a new project
4. Update your `app.json` with the new project slug

#### After Creating the Project:

1. **Update app.json** with the new project information:
```json
{
  "expo": {
    "projectId": "your-new-project-id"
  }
}
```

2. **Log in to Expo**:
```bash
npx expo login
```

3. **Link the project**:
```bash
npx expo link
```

4. **Try EAS Build again**:
```bash
eas build --platform android --profile development
```

---

## Recommended Approach

For local development and testing, **Option A (Local Build)** is recommended:

1. It doesn't require an Expo account
2. It's faster for iterative development
3. It works completely offline
4. You have full control over the build process

The APK built locally (`android/app/build/outputs/apk/debug/app-debug.apk`) can be:
- Installed directly on any Android device
- Shared with testers
- Used for QA testing

---

## Troubleshooting

### If expo prebuild fails

1. Make sure you're in the `youngie` directory
2. Delete the `android/` folder and try again:
   ```bash
   rm -rf android
   npx expo prebuild --platform android --clean
   ```

### If gradle build fails

1. Clean the Gradle cache:
   ```bash
   cd android
   ./gradlew clean
   ```

2. Make sure Android SDK is properly configured

### If you still want EAS Build

After creating an Expo project (Option B), you can run:
```bash
eas build --platform android --profile development
```

---

## Summary

| Approach | Requires Expo Account | Build Time | Best For |
|----------|----------------------|------------|----------|
| Local Build (Option A) | ❌ No | Faster | Development, Testing |
| EAS Build (Option B) | ✅ Yes | Slower | CI/CD, Distribution |

For most development needs, **Option A** is the best choice. The `google-services.json` is already in place at `android/app/google-services.json`, so you're ready to build!

---

*Document created: February 2026*
*App Package Name: com.erhmprah.youngie*
