# Firebase Authentication Setup Guide

This guide will help you set up Firebase Authentication for your project.

## Step 1: Create a Firebase Project

✅ **Already Done!**

Your Firebase project "youngie-91ab7" is already created with Project ID: `917869943882`.

## Step 2: Register Your App

✅ **Already Done!**

Your app is already registered in Firebase with the following details:
- **Project Name**: youngie-91ab7
- **Web App ID**: 1:917869943882:web:767aedc380e0d8d55bdab3
- **Android Package Name**: com.erhmprah.youngie

## Step 3: Add Firebase Configuration

✅ **Already Configured!**

The Firebase configuration has already been set up with your project details:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyAulrl-uCE40bdLpR1Xro6kCkL6xiFdEak",
  authDomain: "youngie-91ab7.firebaseapp.com",
  projectId: "youngie-91ab7",
  storageBucket: "youngie-91ab7.appspot.com",
  messagingSenderId: "917869943882",
  appId: "1:917869943882:web:767aedc380e0d8d55bdab3"
};
```

This configuration is already in place in [`youngie/utils/firebase.ts`](youngie/utils/firebase.ts:1).

## Step 4: Enable Email/Password Authentication

✅ **Already Enabled!**

Email/Password authentication is already enabled for your Firebase project.

## Step 5: Configure Google OAuth Consent Screen

⚠️ **Required for Google Sign-In to work!**

To resolve the "sign in access blocked" error, you need to configure the OAuth consent screen in Google Cloud Console:

### Steps to Configure OAuth Consent Screen:

1. **Go to Google Cloud Console**:
   - Visit: https://console.cloud.google.com/
   - Select your project "youngie-91ab7"

2. **Navigate to APIs & Services**:
   - Click on "APIs & Services" in the left sidebar
   - Select "OAuth consent screen"

3. **Configure Consent Screen**:
   - **User Type**: Select "External" (for testing) or "Internal" (if you have a Google Workspace)
   - **App Information**:
     - App name: "Youngie"
     - User support email: Your email address
     - Developer contact email: Your email address
   - **Scopes**: Add the following scopes:
     - `.../auth/userinfo.email`
     - `.../auth/userinfo.profile`
     - `openid`
   - **Test Users**: Add your Google account as a test user

4. **Add Authorized Domains**:
   - Go to "Authorized domains" section
   - Add: `youngie-91ab7.firebaseapp.com`
   - Add: Your local development domain if testing locally

5. **Publish Your App**:
   - For testing: Keep in "Testing" mode and add test users
   - For production: Submit for verification and publish

6. **Enable Google Sign-In in Firebase**:
   - Go to Firebase Console: https://console.firebase.google.com/
   - Navigate to "Authentication" → "Sign-in method"
   - Enable "Google" provider if not already enabled
   - Save the configuration

## Next Steps: Test the Implementation

⚠️ **Complete OAuth Consent Screen configuration first!**

### Testing the Authentication Flow

1. **Run your app**: Start your app using `expo start`
2. **Test signup**: Create a new account using the signup screen
3. **Test login**: Sign in with the newly created account
4. **Test logout**: Sign out and verify the session is cleared

### Verifying in Firebase Console

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Navigate to your project "youngie-91ab7"
3. Click on "Authentication" in the left sidebar
4. You should see registered users in the "Users" tab

### Additional Features

Your Firebase setup includes:
- **Email/Password Authentication**: Fully implemented and ready to use
- **Google Sign-In**: Fully implemented with OAuth integration
- **Firebase Realtime Database**: Available for future use (storageBucket configured)
- **Android App Support**: Configured with package name `com.erhmprah.youngie`

### Google Sign-In Configuration

✅ **Already Configured!**

Google Sign-In is fully implemented with the following OAuth clients:
- **Web Client ID**: `917869943882-5epfdf4toethe55poi2386d0k43lgp4f.apps.googleusercontent.com`
- **Android Client ID**: `917869943882-97rfmkhvt3s5m54c70849gfpif8m70kb.apps.googleusercontent.com`
- **iOS Client ID**: `917869943882-5epfdf4toethe55poi2386d0k43lgp4f.apps.googleusercontent.com`

The Google Sign-In button is available on both login and signup screens.

### Troubleshooting

#### "Sign in access blocked" Error (Google Sign-In)

This error occurs when the Google OAuth consent screen is not properly configured. Here's how to fix it:

**Solution:**

1. **Configure OAuth Consent Screen** (see Step 5 above)
2. **Add Test Users**:
   - In Google Cloud Console → APIs & Services → OAuth consent screen
   - Add your Google account as a test user
3. **Check Publishing Status**:
   - Ensure your app is in "Testing" mode for development
   - For production, submit for verification
4. **Verify Client IDs**:
   - Ensure the client IDs in your code match those in Google Cloud Console

**Common Causes:**
- OAuth consent screen not configured
- App not in testing mode with test users added
- Mismatched client IDs
- Unverified app trying to access production data

#### General Issues

If you encounter other issues:
- Ensure your device/emulator has internet access
- Check the Firebase Console for any error logs
- Verify that the Email/Password sign-in method is enabled in Firebase Authentication settings
- Check that your Firebase configuration matches your project settings

## Troubleshooting

- **Network Errors**: Ensure your device/emulator has internet access and can reach Firebase servers
- **Authentication Errors**: Check the error codes in the console and refer to Firebase's documentation
- **Configuration Issues**: Double-check your Firebase configuration in [`firebase.ts`](youngie/utils/firebase.ts:1)

## Additional Resources

- [Firebase Authentication Documentation](https://firebase.google.com/docs/auth)
- [Firebase JavaScript SDK Reference](https://firebase.google.com/docs/reference/js)
- [Firebase Console](https://console.firebase.google.com/)
