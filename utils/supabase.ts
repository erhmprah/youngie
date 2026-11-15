import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { toUserCopy } from './error-messages';

const defaultSupabaseUrl = 'https://srcpkwkdvslsdjegqjff.supabase.co';
const rawSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || defaultSupabaseUrl;

function resolveSupabaseUrl(raw: string): string {
  for (const candidate of [raw, `https://${raw}`]) {
    try {
      const u = new URL(candidate);
      if ((u.protocol === 'https:' || u.protocol === 'http:') && u.hostname && !u.hostname.startsWith('.')) {
        return candidate;
      }
    } catch {}
  }
  return defaultSupabaseUrl;
}

const supabaseUrl = resolveSupabaseUrl(rawSupabaseUrl);
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyY3Brd2tkdnNsc2RqZWdxamZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwODU1MjksImV4cCI6MjA4NjY2MTUyOX0.HVHjRkpb59IVdI8aIxxi8fvGrYJ_oOlJu9WauJb5Sok';

// Wraps a Supabase error so callers only ever see plain copy. `name` is
// deliberately not copied: React Native can crash when reading it.
const safeSupabaseError = (error: any, fallback: string): Error => {
  const safe = new Error(toUserCopy(error, fallback));
  if (error?.status) (safe as any).status = error.status;
  if (error?.code) (safe as any).code = error.code;
  if (error?.isNetworkError) (safe as any).isNetworkError = true;
  return safe;
};

// Custom fetch function with retry logic for network errors
const fetchWithRetry = async (input: RequestInfo | URL, init?: RequestInit, retries = 3, backoff = 1000): Promise<Response> => {
  const url = typeof input === 'string' ? input : input.toString();
  const options = init || {};
  
  try {
    const response = await fetch(url, options);
    return response;
  } catch (error: any) {
    // Check if it's a network error
    const isNetworkError = 
      error.message === 'Network request failed' ||
      error.message.includes('Network') ||
      error.name === 'TypeError';
    
    if (retries > 0 && isNetworkError) {
      console.log(`Network error, retrying... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, backoff));
      return fetchWithRetry(url, options, retries - 1, backoff * 2);
    }
    throw error;
  }
};

// Create Supabase client using createClient for Expo/React Native
// Note: For Expo/React Native, we use @supabase/supabase-js (not @supabase/ssr)
// @supabase/ssr is designed for server-side rendering with Next.js
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true, // Enable for magic link to work
  },
  // Global fetch options with retry logic
  global: {
    fetch: (input, init) => fetchWithRetry(input, init),
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
      console.log('Already have a session, signing out first to allow new sign-in');
      await supabase.auth.signOut();
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
    const urlObj = new URL(url);
    const hashParams = new URLSearchParams(urlObj.hash.replace(/^#/, ''));
    const params = urlObj.searchParams;
    const code = params.get('code') || hashParams.get('code');
    const errorDescription =
      params.get('error_description') || hashParams.get('error_description');

    if (errorDescription) {
      throw new Error(errorDescription);
    }

    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
      return data.session;
    }

    const accessToken = params.get('access_token') || hashParams.get('access_token');
    const refreshToken = params.get('refresh_token') || hashParams.get('refresh_token');
    if (accessToken && refreshToken) {
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) throw error;
      return data.session;
    }

    throw new Error('No authorization code or token pair found in callback URL');
  } catch (error: any) {
    console.error('OAuth callback could not establish a session:', error?.message || error);
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
    // First, try a simple connectivity check to Supabase
    try {
      const healthCheck = await fetch('https://srcpkwkdvslsdjegqjff.supabase.co/rest/v1/', {
        method: 'HEAD',
        headers: {
          'apikey': supabaseAnonKey
        }
      });
      console.log('Supabase connectivity check:', healthCheck.status);
    } catch (connectivityError) {
      console.warn('Supabase connectivity issue:', connectivityError);
      // Continue anyway - the actual request will fail with a better error
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Check if it's a network error
      const errorMessage = error.message?.toLowerCase() || '';
      const isNetworkError = 
        errorMessage.includes('network') || 
        errorMessage.includes('fetch') ||
        error.name === 'AuthRetryableFetchError' ||
        (error as any).constructor?.name === 'AuthRetryableFetchError';
      
      if (isNetworkError) {
        // Return a more helpful error
        const networkError = new Error('Unable to connect to authentication server. Please check your internet connection and try again.');
        (networkError as any).isNetworkError = true;
        (networkError as any).originalError = error;
        return { data: { session: null, user: null }, error: networkError };
      }
      
      throw safeSupabaseError(error, 'We could not sign you in. Please try again.');
    }
    
    return { data: { session: data.session, user: data.user }, error: null };
  } catch (error: any) {
    console.error('Sign In Error:', error);
    
    // Check if it's already a processed network error
    if (error.isNetworkError) {
      return { data: { session: null, user: null }, error };
    }
    
    // Check if it's a network error that wasn't caught above
    const errorMessage = error.message?.toLowerCase() || '';
    const isNetworkError = 
      errorMessage === 'network request failed' ||
      errorMessage.includes('network') ||
      errorMessage.includes('fetch') ||
      error.name === 'TypeError';
    
    if (isNetworkError) {
      const networkError = new Error('Unable to connect to authentication server. Please check your internet connection and try again.');
      (networkError as any).isNetworkError = true;
      (networkError as any).originalError = error;
      return { data: { session: null, user: null }, error: networkError };
    }
    
    return {
      data: { session: null, user: null },
      error: safeSupabaseError(error, 'We could not sign you in. Please try again.'),
    };
  }
};

// Reset password (send reset email)
export const resetPassword = async (email: string): Promise<{ error: Error | null }> => {
  try {
    // Use direct reset-password path (file is at app/reset-password.tsx)
    const redirectTo = 'youngie://reset-password';
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      // Create a safe Error object - do NOT use error.name to avoid React Native crash
      const safeError = new Error(
        toUserCopy(error, 'We could not send the reset email. Please try again.')
      );
      // Store original properties but don't use them as the error name
      (safeError as any).status = error.status;
      (safeError as any).code = error.code;
      (safeError as any).rateLimit = error.message?.toLowerCase().includes('rate limit') ||
                                   error.code?.toLowerCase().includes('rate limit');
      // Only log a brief message, not the full Supabase error object
      console.log('Password reset failed with Supabase error');
      return { error: safeError };
    }

    return { error: null };
  } catch (error: any) {
    // Return a safe error without throwing
    const safeError = new Error(
      toUserCopy(error, 'We could not send the reset email. Please try again.')
    );
    (safeError as any).isError = true;
    console.log('Password reset failed');
    return { error: safeError };
  }
};

// Update password (when user has a valid session)
export const updatePassword = async (newPassword: string): Promise<{ error: Error | null }> => {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) throw safeSupabaseError(error, 'We could not update your password. Please try again.');
    
    return { error: null };
  } catch (error: any) {
    console.error('Update Password Error:', error);
    return {
      error: safeSupabaseError(error, 'We could not update your password. Please try again.'),
    };
  }
};

// ============================================
// MAGIC LINK AUTHENTICATION
// ============================================

// Sign in with magic link (email link)
export const signInWithMagicLink = async (
  email: string
): Promise<{ data: { user: any }; error: Error | null }> => {
  try {
    // Use exp+youngie scheme for development client compatibility
    const redirectTo = 'youngie://auth/callback';
    
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    if (error) throw error;
    
    return { data: { user: data.user }, error: null };
  } catch (error: any) {
    console.error('Magic Link Sign In Error:', error);
    
    // Check if it's a network error
    const errorMessage = error.message?.toLowerCase() || '';
    const isNetworkError = 
      errorMessage === 'network request failed' ||
      errorMessage.includes('network') ||
      errorMessage.includes('fetch') ||
      error.name === 'TypeError';
    
    if (isNetworkError) {
      const networkError = new Error('Unable to connect. Please check your internet connection and try again.');
      (networkError as any).isNetworkError = true;
      (networkError as any).originalError = error;
      return { data: { user: null }, error: networkError };
    }
    
    return { data: { user: null }, error };
  }
};

// Sign up with magic link (auto-confirm email)
export const signUpWithMagicLink = async (
  email: string
): Promise<{ data: { user: any }; error: Error | null }> => {
  try {
    // Use exp+youngie scheme for development client compatibility
    const redirectTo = 'exp+youngie://auth/callback';
    
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
        shouldCreateUser: true,
      },
    });

    if (error) throw error;
    
    return { data: { user: data.user }, error: null };
  } catch (error: any) {
    console.error('Magic Link Sign Up Error:', error);
    return {
      data: { user: null },
      error: new Error(
        toUserCopy(error, 'We could not send the sign-in link. Please try again.')
      ),
    };
  }
};
