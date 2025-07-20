'use client';

import { useEffect } from 'react';
import { supabase } from '@/services/supabase';

export default function ForceLogoutPage() {
  useEffect(() => {
    const forceLogout = async () => {
      console.log('Force logout: Starting...');
      
      try {
        // Sign out from Supabase
        await supabase.auth.signOut();
        console.log('Force logout: Supabase signOut complete');
        
        // Clear all local storage
        localStorage.clear();
        sessionStorage.clear();
        console.log('Force logout: Storage cleared');
        
        // Force redirect to login
        window.location.href = '/auth/login';
      } catch (error) {
        console.error('Force logout: Error during logout:', error);
        // Force redirect anyway
        window.location.href = '/auth/login';
      }
    };
    
    forceLogout();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-gray-600">Forcing logout and clearing session...</p>
      </div>
    </div>
  );
}