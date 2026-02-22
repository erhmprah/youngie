import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { Alert } from 'react-native';

// Initialize Google Sign-In
GoogleSignin.configure({
  webClientId: 'YOUR_WEB_CLIENT_ID', // Replace with your web client ID
  iosClientId: 'YOUR_IOS_CLIENT_ID', // Replace with your iOS client ID
  offlineAccess: true,
  forceCodeForRefreshToken: true,
});

export const signInWithGoogle = async () => {
  try {
    // Check if device supports Google Play
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    
    // Sign in with Google
    const userInfo = await GoogleSignin.signIn();
    
    if (userInfo.data) {
      return {
        email: userInfo.data.user.email,
        name: userInfo.data.user.name,
        photo: userInfo.data.user.photo,
      };
    }
    
    return null;
  } catch (error: any) {
    console.error('Google Sign-In Error:', error);
    
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      Alert.alert('Sign-in cancelled', 'You cancelled the sign-in process.');
    } else if (error.code === statusCodes.IN_PROGRESS) {
      Alert.alert('Sign-in in progress', 'Sign-in is already in progress.');
    } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      Alert.alert('Play Services not available', 'Please install Google Play Services.');
    } else {
      Alert.alert('Sign-in failed', 'An error occurred while signing in.');
    }
    
    return null;
  }
};
