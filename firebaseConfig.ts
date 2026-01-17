import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyAulrl-uCE40bdLpR1Xro6kCkL6xiFdEak",
  authDomain: "youngie-91ab7.firebaseapp.com",
  projectId: "youngie-91ab7",
  storageBucket: "youngie-91ab7.firebasestorage.app",
  messagingSenderId: "917869943882",
  appId: "1:917869943882:android:767aedc380e0d8d55bdab3"
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});