'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/services/supabase';

export default function AdminSimpleDashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check if user is authenticated
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          setError(`Session error: ${sessionError.message}`);
          setIsLoading(false);
          return;
        }
        
        if (!session) {
          setError('Not authenticated. Please log in first.');
          setIsLoading(false);
          return;
        }
        
        setUser(session.user);
        setIsLoading(false);
      } catch (err: any) {
        setError(`Error: ${err.message}`);
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, []);
  
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      window.location.href = '/admin-simple';
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };
  
  if (isLoading) {
    return <div className="p-8">Loading...</div>;
  }
  
  if (error) {
    return (
      <div className="p-8">
        <div className="text-red-500 mb-4">{error}</div>
        <button
          onClick={() => window.location.href = '/admin-simple'}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Go to Login
        </button>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Logout
          </button>
        </div>
        
        <div className="mb-6 p-4 bg-blue-50 rounded">
          <h2 className="text-xl font-semibold mb-2">User Information</h2>
          <div className="grid grid-cols-2 gap-2">
            <div className="font-medium">Email:</div>
            <div>{user?.email}</div>
            
            <div className="font-medium">User ID:</div>
            <div>{user?.id}</div>
            
            <div className="font-medium">Last Sign In:</div>
            <div>{new Date(user?.last_sign_in_at).toLocaleString()}</div>
          </div>
        </div>
        
        <div className="mb-6 p-4 bg-green-50 rounded">
          <h2 className="text-xl font-semibold mb-2">Admin Actions</h2>
          <p className="mb-4">This is a simplified admin dashboard. In a real implementation, you would see:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>School management</li>
            <li>Tutor approval controls</li>
            <li>Tutoring opportunity management</li>
            <li>System statistics</li>
          </ul>
        </div>
      </div>
    </div>
  );
}