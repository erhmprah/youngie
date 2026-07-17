import React, { createContext, useState, useCallback, useEffect } from 'react';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { BASE_URL, isNetworkErrorResponse } from '@/utils/api';
import { disconnectSocket } from '@/utils/socket';
import { supabase } from '@/utils/supabase';

interface User {
   _id: string;
   id: string;
   username: string;
   email: string;
   birthYear?: number;
   gender?: string;
   suspended?: boolean;
   bio?: string;
   location?: string;
   interests?: string[];
   avatar?: string;
   profilePhoto?: string;
   coverPhoto?: string;
   friends?: any[];
   followers?: any[];
   following?: any[];
   posts?: any[];
}

interface AuthContextType {
   user: User | null;
   isLoading: boolean;
   isOffline: boolean;
   register: (username: string, email: string, password: string, birthYear: number, gender: string, location?: string) => Promise<void>;
   login: (email: string, password: string) => Promise<void>;
   logout: () => Promise<void>;
   updateUser: (updatedUser: Partial<User>) => void;
   isSignedIn: boolean;
   sessionId: string | null;
   logoutFromOtherDevices: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
   console.log('AuthProvider mounted');
   const [user, setUser] = useState<User | null>(null);
   const [isLoading, setIsLoading] = useState(true);
   const [isOffline, setIsOffline] = useState(false);
   const [sessionId, setSessionId] = useState<string | null>(null);

    // Restore token and user data on app start
    useEffect(() => {
       const restoreAuth = async () => {
          try {
             const token = await AsyncStorage.getItem('authToken');
             if (token) {
                try {
                   const controller = new AbortController();
                   const timeoutId = setTimeout(() => controller.abort(), 3000);
                   
                   const response = await fetch(`${BASE_URL}/api/auth/me`, {
                      method: 'GET',
                      headers: {
                         'x-auth-token': token,
                         'Content-Type': 'application/json'
                      },
                      signal: controller.signal,
                   });
                   
                   clearTimeout(timeoutId);

                   if (!response.ok) {
                      throw new Error(`HTTP ${response.status}`);
                   }

                   const userData = await response.json();
                   setUser(userData);
                } catch (error: any) {
                   console.warn('Failed to restore auth:', error);
                   await AsyncStorage.removeItem('authToken');
                   await AsyncStorage.removeItem('sessionId');
                   await AsyncStorage.removeItem('profileCompleted');
                   await AsyncStorage.removeItem('pendingProfileCompletion');
                   await AsyncStorage.removeItem('supabaseUserId');
                   await AsyncStorage.removeItem('userEmail');
                   setUser(null);
                   return;
                }
                
                const storedSessionId = await AsyncStorage.getItem('sessionId');
                if (storedSessionId) setSessionId(storedSessionId);
             }
          } catch (error: any) {
             console.warn('Failed to restore auth:', error);
             await AsyncStorage.removeItem('authToken');
             await AsyncStorage.removeItem('sessionId');
             await AsyncStorage.removeItem('profileCompleted');
             await AsyncStorage.removeItem('pendingProfileCompletion');
             await AsyncStorage.removeItem('supabaseUserId');
             await AsyncStorage.removeItem('userEmail');
             setUser(null);
          } finally {
             setIsLoading(false);
          }
       };

       restoreAuth();
    }, []);

   const register = useCallback(
      async (username: string, email: string, password: string, birthYear: number, gender: string, location?: string) => {
         setIsLoading(true);
         try {
            const response = await api.post('/auth/register', {
               username,
               email,
               password,
               birthYear,
               gender,
               location,
            });

            const { token, user: userData, sessionId: newSessionId } = response.data;

            // Store token
            await AsyncStorage.setItem('authToken', token);
            if (newSessionId) {
               await AsyncStorage.setItem('sessionId', newSessionId);
               setSessionId(newSessionId);
            }

            // Set user data
            setUser(userData);

            alert('Registration successful! You are now logged in.');
         } catch (error: any) {
            throw error.response?.data?.msg || error.message || 'Registration failed';
         } finally {
            setIsLoading(false);
         }
      },
      []
   );

   const login = useCallback(async (email: string, password: string) => {
      setIsLoading(true);
      try {
         // Get device info
         const deviceName = Platform.OS === 'web' 
            ? 'Web Browser' 
            : `${Platform.OS.charAt(0).toUpperCase() + Platform.OS.slice(1)} Device`;
            
         // Get approximate location from timezone
         const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
         const clientLocation = timeZone ? timeZone.split('/').pop()?.replace(/_/g, ' ') : undefined;

         const response = await api.post('/auth/login', {
            email,
            password,
            deviceName,
            clientLocation,
         });

         const { token, user: userData, sessionId: newSessionId } = response.data;

         // Store token
         await AsyncStorage.setItem('authToken', token);
         if (newSessionId) {
            await AsyncStorage.setItem('sessionId', newSessionId);
            setSessionId(newSessionId);
         }

         // Set user data
         setUser(userData);
      } catch (error: any) {
         throw error.response?.data?.msg || error.message || 'Login failed';
      } finally {
         setIsLoading(false);
      }
   }, []);

   const logout = useCallback(async () => {
      setIsLoading(true);
      try {
         disconnectSocket(); // Disconnect socket first
         // Clear token from storage
         await AsyncStorage.removeItem('authToken');
         await AsyncStorage.removeItem('sessionId');
         
         // Sign out from Supabase and wait for it to complete
         await supabase.auth.signOut();
         
         setUser(null);
         setSessionId(null);
         
         // Force a small delay to ensure state updates
         await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error: any) {
         console.error('Logout error:', error);
         disconnectSocket(); // Ensure socket is disconnected
         // Even if logout fails, clear the local user state
         setUser(null);
      } finally {
         setIsLoading(false);
      }
   }, []);

   const logoutFromOtherDevices = useCallback(async () => {
      if (!sessionId) return;
      try {
         const token = await AsyncStorage.getItem('authToken');
         await api.post('/users/login-activity/logout-others', 
            { currentSessionId: sessionId },
            { headers: { 'x-auth-token': token } }
         );
      } catch (error: any) {
         throw error.response?.data?.msg || error.message || 'Failed to logout other devices';
      }
   }, [sessionId]);

   const updateUser = useCallback((updatedUser: Partial<User>) => {
      setUser((prevUser) => prevUser ? { ...prevUser, ...updatedUser } : (updatedUser as User));
   }, []);

   const value: AuthContextType = {
      user,
      isLoading,
      isOffline,
      register,
      login,
      logout,
      updateUser,
      isSignedIn: !!user,
      sessionId,
      logoutFromOtherDevices,
   };

   return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    console.error('useAuth called without AuthProvider. Stack trace:', new Error().stack);
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
