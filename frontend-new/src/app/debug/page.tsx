'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/app/providers';
import { supabase } from '@/services/supabase';

export default function DebugPage() {
  const { user, session, userRole, isAdmin, isSuperAdmin, isLoading } = useAuth();
  const [adminData, setAdminData] = useState<any>(null);
  const [tutorData, setTutorData] = useState<any>(null);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [tutorError, setTutorError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    const checkUserData = async () => {
      if (!user) return;
      
      setIsChecking(true);
      
      // Check admin data
      try {
        const { data, error } = await supabase
          .from('admins')
          .select('*')
          .eq('auth_id', user.id)
          .single();
        
        if (error) {
          setAdminError(error.message);
        } else {
          setAdminData(data);
        }
      } catch (err: any) {
        setAdminError(err.message);
      }
      
      // Check tutor data
      try {
        const { data, error } = await supabase
          .from('tutors')
          .select('*')
          .eq('auth_id', user.id)
          .single();
        
        if (error) {
          setTutorError(error.message);
        } else {
          setTutorData(data);
        }
      } catch (err: any) {
        setTutorError(err.message);
      }
      
      setIsChecking(false);
    };
    
    checkUserData();
  }, [user]);

  const handleManualRoleCheck = async () => {
    if (!user) return;
    
    setIsChecking(true);
    
    // Direct database query to check admin role
    try {
      const { data, error } = await supabase
        .from('admins')
        .select('role')
        .eq('auth_id', user.id)
        .single();
      
      alert(`Admin check result: ${JSON.stringify({ data, error })}`);
    } catch (err) {
      alert(`Admin check error: ${err}`);
    }
    
    setIsChecking(false);
  };

  const handleDirectAdminRedirect = () => {
    window.location.href = '/admin/dashboard';
  };

  if (isLoading) {
    return <div className="p-8">Loading authentication data...</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Authentication Debug Page</h1>
      
      <div className="mb-8 p-4 bg-gray-100 rounded">
        <h2 className="text-xl font-semibold mb-4">Auth Context Data</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="font-medium">User Authenticated:</div>
          <div>{user ? 'Yes' : 'No'}</div>
          
          <div className="font-medium">User ID:</div>
          <div>{user?.id || 'None'}</div>
          
          <div className="font-medium">User Email:</div>
          <div>{user?.email || 'None'}</div>
          
          <div className="font-medium">User Role:</div>
          <div>{userRole || 'None'}</div>
          
          <div className="font-medium">Is Admin:</div>
          <div>{isAdmin() ? 'Yes' : 'No'}</div>
          
          <div className="font-medium">Is Super Admin:</div>
          <div>{isSuperAdmin() ? 'Yes' : 'No'}</div>
          
          <div className="font-medium">Session Active:</div>
          <div>{session ? 'Yes' : 'No'}</div>
        </div>
      </div>
      
      <div className="mb-8 p-4 bg-gray-100 rounded">
        <h2 className="text-xl font-semibold mb-4">Database Checks</h2>
        
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-2">Admin Record</h3>
          {isChecking ? (
            <div>Checking...</div>
          ) : adminError ? (
            <div className="text-red-500">{adminError}</div>
          ) : adminData ? (
            <pre className="bg-gray-200 p-2 rounded overflow-auto max-h-40">
              {JSON.stringify(adminData, null, 2)}
            </pre>
          ) : (
            <div>No admin record found</div>
          )}
        </div>
        
        <div>
          <h3 className="text-lg font-medium mb-2">Tutor Record</h3>
          {isChecking ? (
            <div>Checking...</div>
          ) : tutorError ? (
            <div className="text-red-500">{tutorError}</div>
          ) : tutorData ? (
            <pre className="bg-gray-200 p-2 rounded overflow-auto max-h-40">
              {JSON.stringify(tutorData, null, 2)}
            </pre>
          ) : (
            <div>No tutor record found</div>
          )}
        </div>
      </div>
      
      <div className="flex space-x-4">
        <button 
          onClick={handleManualRoleCheck}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          disabled={isChecking || !user}
        >
          Manual Role Check
        </button>
        
        <button 
          onClick={handleDirectAdminRedirect}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          Direct Admin Redirect
        </button>
      </div>
    </div>
  );
}