import React, { createContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '@/utils/api';

interface User {
  _id: string;
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
  friends?: any[];
  followers?: any[];
  following?: any[];
  posts?: any[];
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  register: (username: string, email: string, password: string, birthYear: number, gender: string, location?: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  restoreToken: () => Promise<void>;
  updateUser: (updatedUser: Partial<User>) => void;
  isSignedIn: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const register = useCallback(
    async (username: string, email: string, password: string, birthYear: number, gender: string, location?: string) => {
      setIsLoading(true);
      try {
        const response = await authAPI.register({ username, email, password, birthYear, gender, location } as any);
        // Auto-login after successful registration
        const { token, user } = response.data;
        await AsyncStorage.setItem('authToken', token);
        setToken(token);
        setUser(user);
      } catch (error: any) {
        throw error.response?.data?.msg || 'Registration failed';
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      // Call backend to get token and user data
      const response = await authAPI.login({ email, password });
      const { token, user } = response.data;

      if (user.suspended) {
        alert('Your account has been suspended.');
        throw new Error('Account suspended');
      }

      await AsyncStorage.setItem('authToken', token);
      setToken(token);
      setUser(user);
    } catch (error: any) {
      throw error.response?.data?.msg || 'Login failed';
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await AsyncStorage.removeItem('authToken');
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const restoreToken = useCallback(async () => {
    try {
      const storedToken = await AsyncStorage.getItem('authToken');
      if (storedToken) {
        setToken(storedToken);
        // Optionally fetch user data to validate token
        try {
          const response = await authAPI.getCurrentUser();
          // Backend returns user object directly, not wrapped
          const userData = response.data.user || response.data;
          if (userData.suspended) {
            // Account suspended, clear token and logout
            await AsyncStorage.removeItem('authToken');
            setToken(null);
            setUser(null);
            alert('Your account has been suspended.');
          } else {
            setUser(userData);
          }
        } catch (error) {
          // Token is invalid, clear it
          await AsyncStorage.removeItem('authToken');
          setToken(null);
          setUser(null);
        }
      }
    } catch (error) {
      console.error('Failed to restore token:', error);
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      await restoreToken();
      setIsLoading(false);
    };
    initAuth();
  }, [restoreToken]);

  const updateUser = useCallback((updatedUser: Partial<User>) => {
    setUser((prevUser) => prevUser ? { ...prevUser, ...updatedUser } : null);
  }, []);

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    register,
    login,
    logout,
    restoreToken,
    updateUser,
    isSignedIn: !!token,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
