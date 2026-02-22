import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Get Supabase URL and ANON_KEY from environment variables
// For Expo, we need EXPO_PUBLIC_ prefix; for backend, it's without prefix
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://srcpkwkdvslsdjegqjff.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyY3Brd2tkdnNsc2RqZWdxamZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwODU1MjksImV4cCI6MjA4NjY2MTUyOX0.HVHjRkpb59IVdI8aIxxi8fvGrYJ_oOlJu9WauJb5Sok';

// Create Supabase client using createClient for Expo/React Native
// Note: For Expo/React Native, we use @supabase/supabase-js (not @supabase/ssr)
// @supabase/ssr is designed for server-side rendering with Next.js
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Important for mobile apps
  },
});

// Store the current session
let currentSession: Session | null = null;

// Listen for auth changes and store the session
supabase.auth.onAuthStateChange((event, session) => {
  console.log('Supabase auth event:', event);
  currentSession = session;
  
  if (session) {
    console.log('Session available:', session.access_token.substring(0, 20) + '...');
  }
});

// Export the supabase client
export { supabase };

// Function to sign in with Google
export const signInWithGoogle = async (): Promise<{ data: { url: string } | null; error: Error | null }> => {
  try {
    // First, get the session to check if we already have one
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
      console.log('Already have a session');
      return { data: null, error: null };
    }

    // Use the app's custom callback URL scheme for proper mobile handling
    const redirectTo = 'youngie://auth/callback';
    
    const result = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Use app's URL scheme for the redirect (works with expo-web-browser)
        redirectTo: redirectTo,
        scopes: 'email profile',
        skipBrowserRedirect: true, // Important for mobile apps
      },
    });

    return result as { data: { url: string } | null; error: Error | null };
  } catch (error: any) {
    console.error('Google Sign-In Error:', error);
    throw error;
  }
};

// Function to get current session (safer than getUser when no session exists)
export const getSession = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Get Session Error:', error);
      return null;
    }

    return session;
  } catch (error: any) {
    console.error('Get Session Error:', error);
    return null;
  }
};

// Function to get current user from Supabase (only call after session is confirmed)
export const getCurrentUser = async () => {
  try {
    // First check if we have a session
    const session = await getSession();
    
    if (!session) {
      console.log('No session available');
      return null;
    }

    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error('Get Current User Error:', error);
      throw error;
    }

    return user;
  } catch (error: any) {
    console.error('Get Current User Error:', error);
    throw error;
  }
};

// Function to handle the OAuth callback URL and exchange code for session
export const handleOAuthCallback = async (url: string) => {
  try {
    console.log('Handling OAuth callback:', url);
    
    // Handle different URL formats
    let urlToParse = url;
    
    // If the URL is a custom scheme URL (youngie://...), extract the params
    if (url.startsWith('youngie://')) {
      // The URL might have the auth code in the query string or as the full path
      // For youngie://auth/callback?code=xxx, we need to parse it
      const urlObj = new URL(url);
      const code = urlObj.searchParams.get('code');
      const errorDescription = urlObj.searchParams.get('error_description');
      const accessToken = urlObj.searchParams.get('access_token');
      const refreshToken = urlObj.searchParams.get('refresh_token');
      
      if (errorDescription) {
        throw new Error(errorDescription);
      }
      
      if (code) {
        console.log('Found code in URL params');
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.error('Exchange code error:', error);
          throw error;
        }
        console.log('Session established via code exchange');
        return data.session;
      }
      
      if (accessToken && refreshToken) {
        console.log('Found tokens in URL params');
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) throw error;
        return data.session;
      }
      
      // For hash-based auth (some OAuth flows use # instead of ?)
      const hashParams = new URLSearchParams(urlObj.hash.substring(1));
      const hashAccessToken = hashParams.get('access_token');
      const hashRefreshToken = hashParams.get('refresh_token');
      
      if (hashAccessToken && hashRefreshToken) {
        console.log('Found tokens in URL hash');
        const { data, error } = await supabase.auth.setSession({
          access_token: hashAccessToken,
          refresh_token: hashRefreshToken,
        });
        if (error) throw error;
        return data.session;
      }
      
      throw new Error('No code or tokens found in youngie:// callback URL');
    }
    
    // Parse the URL and extract the code parameter (for https URLs)
    const urlObj = new URL(url);
    const code = urlObj.searchParams.get('code');
    const errorDescription = urlObj.searchParams.get('error_description');
    
    if (errorDescription) {
      throw new Error(errorDescription);
    }
    
    if (!code) {
      // Check if we have access_token and refresh_token in hash (another auth flow)
      const hashParams = new URLSearchParams(urlObj.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      
      if (accessToken && refreshToken) {
        // Set the session from hash parameters
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        
        if (error) throw error;
        return data.session;
      }
      
      throw new Error('No code or tokens found in callback URL');
    }
    
    // Exchange the code for a session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (error) {
      console.error('Exchange code error:', error);
      throw error;
    }
    
    console.log('Session established successfully');
    return data.session;
  } catch (error: any) {
    console.error('OAuth Callback Error:', error);
    throw error;
  }
};

// Function to sign out from Supabase
export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('Sign Out Error:', error);
      throw error;
    }
    
    currentSession = null;
  } catch (error: any) {
    console.error('Sign Out Error:', error);
    throw error;
  }
};

// ============================================
// EMAIL/PASSWORD AUTHENTICATION
// ============================================

// Sign up with email and password
export const signUpWithEmail = async (
  email: string,
  password: string,
  options?: {
    emailRedirectTo?: string;
    data?: Record<string, any>;
  }
): Promise<{ data: { session: Session | null; user: any }; error: Error | null }> => {
  try {
    const redirectTo = options?.emailRedirectTo || 'youngie://auth/callback';
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: options?.data,
      },
    });

    if (error) throw error;
    
    return { data: { session: data.session, user: data.user }, error: null };
  } catch (error: any) {
    console.error('Sign Up Error:', error);
    return { data: { session: null, user: null }, error };
  }
};

// Sign in with email and password
export const signInWithEmail = async (
  email: string,
  password: string
): Promise<{ data: { session: Session | null; user: any }; error: Error | null }> => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    
    return { data: { session: data.session, user: data.user }, error: null };
  } catch (error: any) {
    console.error('Sign In Error:', error);
    return { data: { session: null, user: null }, error };
  }
};

// Reset password (send reset email)
export const resetPassword = async (email: string): Promise<{ error: Error | null }> => {
  try {
    const redirectTo = 'youngie://reset-password';
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) throw error;
    
    return { error: null };
  } catch (error: any) {
    console.error('Reset Password Error:', error);
    return { error };
  }
};

// Update password (when user has a valid session)
export const updatePassword = async (newPassword: string): Promise<{ error: Error | null }> => {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) throw error;
    
    return { error: null };
  } catch (error: any) {
    console.error('Update Password Error:', error);
    return { error };
  }
};
