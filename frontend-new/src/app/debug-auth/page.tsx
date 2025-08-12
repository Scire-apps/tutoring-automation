'use client';

import { useAuth } from '@/app/providers';
import { supabase } from '@/services/supabase';
import { useState, useEffect } from 'react';

export default function DebugAuthPage() {
  const { user, session, userRole, isAdmin, isSuperAdmin, isLoading } = useAuth();
  const [rawSession, setRawSession] = useState<any>(null);
  const [adminData, setAdminData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Get session directly from Supabase
        const { data: { session }, error } = await supabase.auth.getSession();
        setRawSession(session);
        
        if (session?.user) {
          // Try to fetch admin data
          const { data: adminData, error: adminError } = await supabase
            .from('admins')
            .select('*')
            .eq('auth_id', session.user.id)
            .single();
          
          setAdminData(adminData);
          if (adminError) {
            setError(`Admin query error: ${adminError.message}`);
          }
        }
      } catch (err: any) {
        setError(`Error: ${err.message}`);
      }
    };
    
    checkAuth();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Authentication Debug</h1>
        
        <div className="space-y-6">
          {/* Auth Context Status */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Auth Context Status</h2>
            <div className="space-y-2">
              <p><strong>Loading:</strong> {isLoading ? 'Yes' : 'No'}</p>
              <p><strong>User exists:</strong> {user ? 'Yes' : 'No'}</p>
              <p><strong>Session exists:</strong> {session ? 'Yes' : 'No'}</p>
              <p><strong>User Role:</strong> {userRole || 'None'}</p>
              <p><strong>Is Admin:</strong> {isAdmin() ? 'Yes' : 'No'}</p>
              <p><strong>Is Super Admin:</strong> {isSuperAdmin() ? 'Yes' : 'No'}</p>
            </div>
          </div>

          {/* User Details */}
          {user && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">User Details</h2>
              <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                {JSON.stringify(user, null, 2)}
              </pre>
            </div>
          )}

          {/* Raw Session */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Raw Session</h2>
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
              {JSON.stringify(rawSession, null, 2)}
            </pre>
          </div>

          {/* Admin Data */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Admin Data</h2>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded p-4 mb-4">
                <p className="text-red-800">{error}</p>
              </div>
            )}
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
              {JSON.stringify(adminData, null, 2)}
            </pre>
          </div>

          {/* Test Links */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Test Links</h2>
            <div className="space-y-2">
              <a href="/admin/dashboard" className="block text-blue-600 hover:text-blue-500">
                /admin/dashboard
              </a>
              {/* /admin/invitations removed */}
              <a href="/admin-bypass" className="block text-blue-600 hover:text-blue-500">
                /admin-bypass (working version)
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}