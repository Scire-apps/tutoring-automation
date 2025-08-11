import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const siteUrl = typeof window !== 'undefined' 
  ? window.location.origin 
  : process.env.NEXT_PUBLIC_SITE_URL || 'https://app.tutoringapp.ca';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    // Set the site URL for all auth redirects
    site: siteUrl,
    // Set redirect URLs for auth operations
    redirectTo: `${siteUrl}/auth/callback`,
  }
});

// Defensive: sanitize broken auth storage on first import (handles base64-* tokens)
try {
  if (typeof window !== 'undefined') {
    const refMatch = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/i);
    const projectRef = refMatch ? refMatch[1] : undefined;
    const keys = [
      'supabase.auth.token',
      projectRef ? `sb-${projectRef}-auth-token` : undefined,
    ].filter(Boolean) as string[];
    for (const key of keys) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const looksJson = raw.trim().startsWith('{');
      const looksBase64 = raw.startsWith('base64-');
      if (!looksJson || looksBase64) {
        window.localStorage.removeItem(key);
      } else {
        try { JSON.parse(raw); } catch { window.localStorage.removeItem(key); }
      }
    }
  }
} catch {}

// Auth helper functions
export const signUp = async (email: string, password: string) => {
  const siteUrl = typeof window !== 'undefined' 
    ? window.location.origin 
    : process.env.NEXT_PUBLIC_SITE_URL || 'https://app.tutoringapp.ca';
    
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback`,
    }
  });
  
  return { data, error };
};

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  return { data, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const resetPassword = async (email: string, redirectTo?: string) => {
  const siteUrl = typeof window !== 'undefined' 
    ? window.location.origin 
    : process.env.NEXT_PUBLIC_SITE_URL || 'https://app.tutoringapp.ca';
    
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectTo || `${siteUrl}/auth/reset-password`,
  });
  
  return { data, error };
};

export const updatePassword = async (password: string) => {
  const { data, error } = await supabase.auth.updateUser({
    password,
  });
  
  return { data, error };
};

export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  return { user, error };
};

export const getSession = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  return { session, error };
};

export const onAuthStateChange = (callback: (event: string, session: any) => void) => {
  return supabase.auth.onAuthStateChange(callback);
};