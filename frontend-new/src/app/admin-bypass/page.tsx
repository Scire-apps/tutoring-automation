'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/services/supabase';

export default function AdminBypassPage() {
  const [user, setUser] = useState<any>(null);
  const [admin, setAdmin] = useState<any>(null);
  const [schools, setSchools] = useState<any[]>([]);
  const [tutors, setTutors] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  
  const addDebugInfo = (info: string) => {
    setDebugInfo(prev => [...prev, info]);
    console.log(info);
  };
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        addDebugInfo('Starting data fetch...');
        
        // Get current session
        addDebugInfo('Checking authentication...');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          addDebugInfo(`Session error: ${sessionError.message}`);
          setError(`Session error: ${sessionError.message}`);
          setIsLoading(false);
          return;
        }
        
        if (!session) {
          addDebugInfo('Not authenticated');
          setError('Not authenticated. Please log in first.');
          setIsLoading(false);
          return;
        }
        
        addDebugInfo(`Authenticated as: ${session.user.email?.replace(/(^[^@\s]+)(\+(?:tutor|tutee))@([Hh][Dd][Ss][Bb]\.ca)$/,'$1@$3')}`);
        setUser(session.user);
        
        // Hardcode admin data for testing
        addDebugInfo('Setting hardcoded admin data for testing');
        setAdmin({
          id: 'test-admin-id',
          auth_id: session.user.id,
          email: session.user.email?.replace(/(^[^@\s]+)(\+(?:tutor|tutee))@([Hh][Dd][Ss][Bb]\.ca)$/,'$1@$3'),
          first_name: 'Test',
          last_name: 'Admin',
          role: 'admin',
          school: null
        });
        
        // Set dummy data for testing
        setSchools([
          { id: '1', name: 'Test School 1', domain: 'test1.edu' },
          { id: '2', name: 'Test School 2', domain: 'test2.edu' }
        ]);
        
        setTutors([
          { 
            id: '1', 
            first_name: 'Test', 
            last_name: 'Tutor', 
            email: 'test@example.com',
            status: 'active',
            volunteer_hours: 10,
            school: { name: 'Test School 1' }
          }
        ]);
        
        addDebugInfo('Data fetch complete');
      } catch (err: any) {
        addDebugInfo(`Unexpected error: ${err.message}`);
        setError(`Unexpected error: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      window.location.href = '/test-login';
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-xl mb-4">Error</div>
          <p className="mb-4">{error}</p>
          <button
            onClick={() => window.location.href = '/test-login'}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Go to Test Login
          </button>
        </div>
      </div>
    );
  }
  
  if (!admin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-yellow-500 text-xl mb-4">Not an Admin</div>
          <p className="mb-4">Your account does not have admin privileges.</p>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard (Bypass)</h1>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">
              {admin.first_name} {admin.last_name}
            </span>
            <button
              onClick={handleSignOut}
              className="text-sm text-blue-600 hover:text-blue-500"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      
      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Admin Info */}
        <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-8">
          <div className="px-4 py-5 sm:px-6">
            <h2 className="text-lg leading-6 font-medium text-gray-900">
              Admin Information
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Your account details and permissions.
            </p>
          </div>
          <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
            <dl className="sm:divide-y sm:divide-gray-200">
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Full name</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {admin.first_name} {admin.last_name}
                </dd>
              </div>
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Email address</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {admin.email?.replace(/(^[^@\s]+)(\+(?:tutor|tutee))@([Hh][Dd][Ss][Bb]\.ca)$/,'$1@$3')}
                </dd>
              </div>
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Role</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">Admin</dd>
              </div>
              {admin.role === 'admin' && admin.school && (
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">School</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {admin.school.name || 'Not assigned'}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
        
        {/* Admin Actions Section */}
        {admin.role === 'admin' && (
          <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-8">
            <div className="px-4 py-5 sm:px-6">
              <h2 className="text-lg leading-6 font-medium text-gray-900">
                Admin Actions
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                Manage administrators and system settings.
              </p>
            </div>
            <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
              <div className="flex space-x-4">
                {/* Invitations feature removed */}
              </div>
            </div>
          </div>
        )}

        {/* Schools Section */}
        {admin.role === 'admin' && (
          <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-8">
            <div className="px-4 py-5 sm:px-6">
              <h2 className="text-lg leading-6 font-medium text-gray-900">
                Schools
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                Manage all schools in the system.
              </p>
            </div>
            <div className="border-t border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Domain
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tutors
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {schools.map((school) => (
                    <tr key={school.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {school.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {school.domain}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {tutors.filter(t => t.school_id === school.id).length}
                      </td>
                    </tr>
                  ))}
                  {schools.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                        No schools found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {/* Tutors Section */}
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h2 className="text-lg leading-6 font-medium text-gray-900">
              Tutors
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Tutors at {admin.school?.name || 'your school'}.
            </p>
          </div>
          <div className="border-t border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      School
                    </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Hours
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tutors.map((tutor) => (
                  <tr key={tutor.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {tutor.first_name} {tutor.last_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {tutor.email?.replace(/(^[^@\s]+)(\+(?:tutor|tutee))@([Hh][Dd][Ss][Bb]\.ca)$/,'$1@$3')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {tutor.school?.name || 'Not assigned'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        tutor.status === 'active' ? 'bg-green-100 text-green-800' :
                        tutor.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {tutor.status === 'active' ? 'Active' :
                         tutor.status === 'pending' ? 'Pending' :
                         'Suspended'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {tutor.volunteer_hours || 0}
                    </td>
                  </tr>
                ))}
                {tutors.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                      No tutors found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}