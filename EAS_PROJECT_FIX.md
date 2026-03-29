# EAS Project Fix - EXPERIENCE_NOT_FOUND Error

## Problem

The app is failing to register push notifications with this error:

```
ERROR: Experience with id '02522d86-1963-41a3-b08c-cbd55c5722ab' does not exist.
```

This error occurs because the EAS (Expo Application Services) project ID configured in `app.json` doesn't exist in Expo's servers. The project was either:
- Never created
- Deleted
- Copied from another project without proper initialization

## Solution

The invalid project ID has been removed from `app.json`. Now you need to create a new EAS project.

### Steps to Fix

1. **Run the following command** in the `youngie` directory:
   ```bash
   npx eas project:init
   ```

2. **Follow the prompts**:
   - Select "Create a new project"
   - Enter a name for your project (e.g., "youngie")
   - This will create a new project in your Expo account

3. **After creation**, verify `app.json` has been updated with a valid project ID:
   ```json
   {
     "expo": {
       "extra": {
         "eas": {
           "projectId": "<new-valid-uuid>"
         }
       }
     }
   }
   ```

4. **Restart the development server**:
   ```bash
   npx expo start --clear
   ```

5. **Log in again** - the push notification registration should now work

### Alternative: Manual Setup via Expo Dashboard

If the CLI doesn't work, you can manually create a project:

1. **Go to [Expo Dashboard](https://expo.dev/projects)**

2. **Create a new project** manually through the website

3. **Copy the Project ID** from the project settings (it will be a UUID)

4. **Update `app.json`** manually:
   ```json
   {
     "expo": {
       "extra": {
         "eas": {
           "projectId": "<your-actual-project-id>"
         }
       }
     }
   }
   ```

## What Was Changed

1. **`app.json`**: Removed the invalid project ID that was pointing to a non-existent Expo project

2. **`hooks/usePushNotifications.ts`**: 
   - Now dynamically reads the project ID from Expo constants instead of hardcoding
   - Added proper error handling with clear messages when project ID is missing

3. **`PUSH_NOTIFICATIONS.md`**:
   - Updated documentation to use dynamic project ID retrieval

4. **`package.json`**:
   - Added `eas-cli` to devDependencies

## Notes

- The EAS project ID is required for Expo Push Notifications to work
- Each Expo project needs its own unique EAS project
- The project ID links your local app to the Expo infrastructure for push notifications, builds, and updates
