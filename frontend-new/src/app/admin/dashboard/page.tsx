'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/app/providers';
import { supabase } from '@/services/supabase';
import apiService from '@/services/api';
import { Admin, School, Tutor } from '@/types/models';

export default function AdminDashboardPage() {
  const { user, session, isAdmin, isSuperAdmin, signOut, userRole, isLoading: authLoading } = useAuth();
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  
  useEffect(() => {
    const fetchAdminData = async () => {
      console.log('Admin dashboard: Checking auth state...');
      console.log('Admin dashboard: Auth loading:', authLoading);
      console.log('Admin dashboard: User exists:', !!user);
      console.log('Admin dashboard: User role:', userRole || 'unknown');
      console.log('Admin dashboard: Is admin:', isAdmin());
      
      // Wait for auth to finish loading
      if (authLoading) {
        console.log('Admin dashboard: Auth still loading, waiting...');
        return;
      }
      
      if (!user) {
        console.log('Admin dashboard: No user, redirecting to login');
        router.push('/auth/login');
        return;
      }
      
      // Check if user is actually an admin
      if (!isAdmin()) {
        console.log('Admin dashboard: User is not an admin, redirecting to dashboard');
        router.push('/dashboard');
        return;
      }
      
      console.log('Admin dashboard: Admin user authenticated, proceeding...');
      
      try {
        // Fetch via backend using service role (avoids RLS recursion)
        const token = session?.access_token;
        if (!token) {
          console.error('Admin dashboard: no access token found');
          router.push('/auth/login');
          return;
        }

        // Admin profile
        const adminResp = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!adminResp.ok) throw new Error('Failed to load admin profile');
        const adminJson = await adminResp.json();
        setAdmin(adminJson.admin as Admin);

        // Schools (for admin view; backend returns all)
        const schoolsResp = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/schools`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (schoolsResp.ok) {
          const schoolsJson = await schoolsResp.json();
          setSchools((schoolsJson.schools || []) as School[]);
        }

        // Tutors list (scoped by school if admin has one)
        const tutorsResp = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/tutors`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (tutorsResp.ok) {
          const tutorsJson = await tutorsResp.json();
          setTutors((tutorsJson.tutors || []) as Tutor[]);
        }
      } catch (err) {
        console.error('Error fetching admin data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchAdminData();
  }, [user, router, isAdmin, isSuperAdmin]);
  
  const handleSignOut = async () => {
    console.log('Admin dashboard: Starting sign out...');
    await signOut();
    // SupabaseListener will move us to /auth/login
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
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">
            {isSuperAdmin() ? 'Super Admin Dashboard' : 'School Admin Dashboard'}
          </h1>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">
              {admin?.first_name} {admin?.last_name}
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
        {/* Quick Actions */}
        {isSuperAdmin() && (
          <div className="mb-8">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Link
                href="/admin/invitations"
                className="relative block w-full rounded-lg border-2 border-dashed border-gray-300 p-6 text-center hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <svg className="mx-auto h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                <span className="mt-2 block text-sm font-medium text-gray-900">
                  Manage Admin Invitations
                </span>
                <span className="mt-1 block text-xs text-gray-500">
                  Create and manage invitations for new administrators
                </span>
              </Link>
            </div>
          </div>
        )}

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
                  {admin?.first_name} {admin?.last_name}
                </dd>
              </div>
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Email address</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {admin?.email}
                </dd>
              </div>
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Role</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  Admin
                </dd>
              </div>
              {admin?.role === 'admin' && (
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">School</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {admin?.school?.name || 'Not assigned'}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
        
        {/* Schools Section (Super Admin Only) */}
        {isSuperAdmin() && (
          <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-8">
            <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
              <div>
                <h2 className="text-lg leading-6 font-medium text-gray-900">
                  Schools
                </h2>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">
                  Manage all schools in the system.
                </p>
              </div>
              <Link
                href="/admin/schools/add"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Add School
              </Link>
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
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
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
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link href={`/admin/schools/${school.id}`} className="text-blue-600 hover:text-blue-900 mr-4">
                          View
                        </Link>
                        <Link href={`/admin/schools/${school.id}/edit`} className="text-blue-600 hover:text-blue-900">
                          Edit
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {schools.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
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
              {isSuperAdmin() 
                ? 'All tutors in the system.' 
                : `Tutors at ${admin?.school?.name}.`}
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
                  {isSuperAdmin() && (
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      School
                    </th>
                  )}
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Hours
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
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
                      {tutor.email}
                    </td>
                    {isSuperAdmin() && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {tutor.school?.name || 'Not assigned'}
                      </td>
                    )}
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
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link href={`/admin/tutors/${tutor.id}`} className="text-blue-600 hover:text-blue-900 mr-4">
                        View
                      </Link>
                      <Link href={`/admin/tutors/${tutor.id}/edit`} className="text-blue-600 hover:text-blue-900">
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
                {tutors.length === 0 && (
                  <tr>
                    <td colSpan={isSuperAdmin() ? 6 : 5} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
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