import React, { createContext, useState, useCallback, useEffect } from 'react';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNetwork } from '@/contexts/NetworkContext';
import api, { BASE_URL, isNetworkErrorResponse } from '@/utils/api';
import { disconnectSocket } from '@/utils/socket';
import { supabase } from '@/utils/supabase';
import { getClientLocation, getDeviceName } from '@/utils/deviceInfo';

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
   const [sessionId, setSessionId] = useState<string | null>(null);
   const { isOffline } = useNetwork();

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
                       if (response.status === 403) {
                          try {
                             const data = await response.json();
                             await handleSuspension(data.msg || 'You are not authorized to use this app.');
                          } catch {
                             await handleSuspension('You are not authorized to use this app.');
                          }
                          return;
                       }
                       throw new Error(`HTTP ${response.status}`);
                    }

                    const userData = await response.json();
                    if (userData.suspended) {
                       await handleSuspension('You are not authorized to use this app.');
                       return;
                    }

                    setUser(userData);
                } catch (error: any) {
                   console.warn('Failed to restore auth with MongoDB token:', error);
                   // MongoDB token is invalid/expired — attempt to recover using
                   // the persisted Supabase session so the user stays signed in.
                   await AsyncStorage.removeItem('authToken');
                   await AsyncStorage.removeItem('sessionId');
                   await trySupabaseRestore();
                   return;
                }
                
                const storedSessionId = await AsyncStorage.getItem('sessionId');
                if (storedSessionId) setSessionId(storedSessionId);
             } else {
                // No MongoDB token — attempt to restore from Supabase session
                await trySupabaseRestore();
             }
          } catch (error: any) {
             console.warn('Failed to restore auth:', error);
             await AsyncStorage.removeItem('authToken');
             await AsyncStorage.removeItem('sessionId');
             await trySupabaseRestore();
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

    const handleSuspension = useCallback(async (message?: string) => {
       try {
          await supabase.auth.signOut();
       } catch (e) {
          console.log('Supabase signOut error:', e);
       }
       await AsyncStorage.removeItem('authToken');
       await AsyncStorage.removeItem('sessionId');
       await AsyncStorage.removeItem('profileCompleted');
       await AsyncStorage.removeItem('pendingProfileCompletion');
       await AsyncStorage.removeItem('supabaseUserId');
       await AsyncStorage.removeItem('userEmail');
       setUser(null);
       setSessionId(null);
       if (message) {
          Alert.alert('Not Authorized', message);
       }
     }, []);

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
