# Quick FCM Fix - APK Rebuild Guide

This document contains simple copy-paste commands to rebuild your APK with Firebase configuration.

## Step 1: Navigate to project directory

```bash
cd youngie
```

## Step 2: Run Expo prebuild to generate Android native files

```bash
npx expo prebuild --platform android --clean
```

This will clean and regenerate the Android native project with your Firebase configuration.

## Step 3: Build the debug APK

```bash
cd android && ./gradlew assembleDebug
```

## Step 4: Find your APK

The built APK is located at:

```
android/app/build/outputs/apk/debug/app-debug.apk
```

## Notes

- Ensure your `google-services.json` file is in `youngie/android/app/` before running these commands
- The APK will include the Firebase configuration embedded in it
- Transfer this APK to your Android device to test push notifications
