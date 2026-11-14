import React, { createContext, useState, useCallback, useEffect } from 'react';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNetwork } from '@/contexts/NetworkContext';
import api, { BASE_URL } from '@/utils/api';
import { disconnectSocket } from '@/utils/socket';
import { supabase } from '@/utils/supabase';
import { getClientLocation, getDeviceName } from '@/utils/deviceInfo';
import { toUserCopy, toUserError } from '@/utils/error-messages';

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
    school?: string;
    educationLevel?: string;
    interests?: string[];
   avatar?: string;
   profilePhoto?: string;
   coverPhoto?: string;
   isPrivate?: boolean;
   friends?: any[];
   followers?: any[];
   following?: any[];
   posts?: any[];
}

const CACHED_USER_KEY = 'cachedUser';

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
   const [sessionId, setSessionId] = useState<string | null>(null);
   const { isOffline } = useNetwork();

   const handleSuspension = useCallback(async (message?: string) => {
      try {
         await supabase.auth.signOut();
      } catch (error) {
         console.warn('Supabase sign out failed during suspension handling:', error);
      }
      await AsyncStorage.multiRemove([
         'authToken',
         'sessionId',
         CACHED_USER_KEY,
         'profileCompleted',
         'pendingProfileCompletion',
         'supabaseUserId',
         'userEmail',
      ]);
      setUser(null);
      setSessionId(null);
      if (message) {
         Alert.alert('Not Authorized', toUserCopy(message, 'This account is not available right now.'));
      }
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

            if (response.status === 403) {
               await handleSuspension();
               return;
            }

            if (!response.data) {
               throw new Error('Registration failed');
            }

            const { token, user: userData, sessionId: newSessionId } = response.data;

            if (userData?.suspended) {
               await handleSuspension();
               return;
            }

            // Store token
            await AsyncStorage.setItem('authToken', token);
            await AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(userData));
            if (newSessionId) {
               await AsyncStorage.setItem('sessionId', newSessionId);
               setSessionId(newSessionId);
            }

            // Set user data
            setUser(userData);

            alert('Registration successful! You are now logged in.');
      } catch (error: any) {
         throw new Error(toUserError(error, { fallback: 'Registration failed' }).message);
      } finally {
            setIsLoading(false);
         }
      },
      [handleSuspension]
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

          if (response.status === 403) {
             await handleSuspension();
             return;
          }

          if (!response.data) {
             throw new Error('Login failed');
          }

          const { token, user: userData, sessionId: newSessionId } = response.data;

         // Store token
         await AsyncStorage.setItem('authToken', token);
         await AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(userData));
         if (newSessionId) {
            await AsyncStorage.setItem('sessionId', newSessionId);
            setSessionId(newSessionId);
         }

         // Set user data
         setUser(userData);
      } catch (error: any) {
         throw new Error(toUserError(error, { fallback: 'Login failed' }).message);
      } finally {
         setIsLoading(false);
      }
   }, [handleSuspension]);

   const logout = useCallback(async () => {
      setIsLoading(true);
      try {
         try {
            await api.post('/auth/logout');
         } catch (error) {
            console.warn('Could not revoke the server session during logout:', error);
         }
         disconnectSocket(); // Disconnect socket first
         await AsyncStorage.multiRemove([
            'authToken',
            'sessionId',
            CACHED_USER_KEY,
            'profileCompleted',
            'pendingProfileCompletion',
            'supabaseUserId',
            'userEmail',
         ]);
         try {
            await supabase.auth.signOut();
         } catch (error) {
            console.warn('Supabase sign out failed:', error);
         }
         setUser(null);
         setSessionId(null);
      } catch (error: any) {
         console.error('Logout error:', error);
         disconnectSocket(); // Ensure socket is disconnected
         await AsyncStorage.multiRemove(['authToken', 'sessionId', CACHED_USER_KEY]);
         // Even if logout fails, clear the local user state
         setUser(null);
         setSessionId(null);
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
          throw new Error(toUserError(error, { fallback: 'Failed to log out other devices' }).message);
       }
    }, [sessionId]);

     const trySupabaseRestore = useCallback(async (): Promise<boolean> => {
        try {
           const sessionPromise = supabase.auth.getSession();
           const timeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Session check timeout')), 5000)
           );

           const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]);

           if (!session) {
              return false;
           }

           const supabaseToken = session.access_token;
           const [deviceName, clientLocation] = await Promise.all([
              getDeviceName(),
              getClientLocation(),
           ]);

           const controller = new AbortController();
           const timeoutId = setTimeout(() => controller.abort(), 10000);

           const response = await fetch(`${BASE_URL}/api/auth/supabase-login`, {
              method: 'POST',
              headers: {
                 'Content-Type': 'application/json',
              },
              body: JSON.stringify({ accessToken: supabaseToken, deviceName, clientLocation }),
              signal: controller.signal,
           });

           clearTimeout(timeoutId);

           if (!response.ok) {
              if (response.status === 403) {
                 await handleSuspension();
                 return false;
              }
              console.warn('Supabase restore: supabase-login failed with status', response.status);
              return false;
           }

           const data = await response.json();

           if (data?.needsProfileCompletion === false && data?.token) {
              await AsyncStorage.setItem('authToken', data.token);
              await AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(data.user));
              if (data.sessionId) {
                 await AsyncStorage.setItem('sessionId', data.sessionId);
                 setSessionId(data.sessionId);
              }
              await AsyncStorage.setItem('profileCompleted', 'true');
              setUser(data.user);
              return true;
           } else if (data?.needsProfileCompletion === true) {
              await AsyncStorage.setItem('supabaseUserId', data.supabaseUserId);
              await AsyncStorage.setItem('userEmail', data.email);
              await AsyncStorage.setItem('pendingProfileCompletion', 'true');
              return false;
           }

           return false;
        } catch (error: any) {
           console.warn('Supabase restore error:', error);
           return false;
        }
     }, [handleSuspension]);

     useEffect(() => {
        const restoreAuth = async () => {
           try {
              const token = await AsyncStorage.getItem('authToken');
              if (!token) {
                 await trySupabaseRestore();
                 return;
              }

              let timeoutId: ReturnType<typeof setTimeout> | undefined;
              try {
                 const controller = new AbortController();
                 timeoutId = setTimeout(() => controller.abort(), 10000);

                 const response = await fetch(`${BASE_URL}/api/auth/me`, {
                    method: 'GET',
                    headers: {
                       'x-auth-token': token,
                       'Content-Type': 'application/json',
                    },
                    signal: controller.signal,
                 });

                 if (!response.ok) {
                    if (response.status === 403) {
                       const data = await response.json().catch(() => null);
                       await handleSuspension(data?.msg || 'You are not authorized to use this app.');
                       return;
                    }
                    if (response.status === 401 || response.status === 404) {
                       await AsyncStorage.multiRemove(['authToken', 'sessionId', CACHED_USER_KEY]);
                       await trySupabaseRestore();
                       return;
                    }
                    throw new Error(`HTTP ${response.status}`);
                 }

                 const { token: refreshedToken, ...userData } = await response.json();
                 if (userData.suspended) {
                    await handleSuspension('You are not authorized to use this app.');
                    return;
                 }
                 if (refreshedToken) {
                    await AsyncStorage.setItem('authToken', refreshedToken);
                 }
                 await AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(userData));
                 setUser(userData);
                 const storedSessionId = await AsyncStorage.getItem('sessionId');
                 if (storedSessionId) setSessionId(storedSessionId);
              } catch (error: unknown) {
                 console.warn('Failed to restore auth with MongoDB token:', error);
                 const cachedUser = await AsyncStorage.getItem(CACHED_USER_KEY);
                 if (cachedUser) {
                    try {
                       setUser(JSON.parse(cachedUser) as User);
                       const storedSessionId = await AsyncStorage.getItem('sessionId');
                       if (storedSessionId) setSessionId(storedSessionId);
                    } catch (cacheError) {
                       console.warn('Failed to restore cached user:', cacheError);
                    }
                 }
              } finally {
                 if (timeoutId) clearTimeout(timeoutId);
              }
           } catch (error: unknown) {
              console.warn('Failed to restore auth:', error);
           } finally {
              setIsLoading(false);
           }
        };

        void restoreAuth();
     }, [handleSuspension, trySupabaseRestore]);

     useEffect(() => {
        if (!user?._id) return;
        AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(user)).catch(error => {
           console.warn('Failed to cache user data:', error);
        });
     }, [user]);

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
