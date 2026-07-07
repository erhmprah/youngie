import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { Alert } from 'react-native';
import { supabase } from './supabase';

GoogleSignin.configure({
  webClientId: '274460413616-cqu0cvkqhajj72hleui5l2raovj59ssd.apps.googleusercontent.com',
  offlineAccess: true,
});

export const signInWithGoogle = async () => {
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const userInfo = await GoogleSignin.signIn();
    
    const idToken = userInfo.data?.idToken;
    const accessToken = userInfo.data?.accessToken;
    
    if (!idToken) {
      throw new Error('No ID token received from Google');
    }
    
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
      access_token: accessToken || undefined,
    });
    
    if (error) {
      console.error('Supabase ID token sign-in error:', error);
      throw error;
    }
    
    return { data: { session: data.session }, error: null };
  } catch (error: any) {
    console.error('Google Sign-In Error:', error);
    
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      Alert.alert('Sign-in cancelled', 'You cancelled the sign-in process.');
    } else if (error.code === statusCodes.IN_PROGRESS) {
      Alert.alert('Sign-in in progress', 'Sign-in is already in progress.');
    } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      Alert.alert('Play Services not available', 'Please install Google Play Services.');
    } else {
      Alert.alert('Sign-in failed', error.message || 'An error occurred while signing in.');
    }
    
    return { data: null, error };
  }
};
