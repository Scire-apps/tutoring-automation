'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { supabase as sharedSupabase } from '@/services/supabase';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers';

interface SchoolAdmin {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  school_id: string;
  school: {
    name: string;
    domain: string;
  };
}

interface TutoringOpportunity {
  id: string;
  tutee_first_name: string;
  tutee_last_name: string;
  subject: string;
  grade_level: string;
  status: string;
  created_at: string;
}

interface Tutor {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  school_id: string;
  status: string;
}

export default function SchoolAdminDashboard() {
  const [admin, setAdmin] = useState<SchoolAdmin | null>(null);
  const [opportunities, setOpportunities] = useState<TutoringOpportunity[]>([]);
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { user, isLoading: authLoading } = useAuth();
  const supabase = sharedSupabase; // reuse configured client that now sanitizes storage
  const router = useRouter();

  useEffect(() => {
    // Wait for auth to finish loading before trying to load data
    if (!authLoading) {
      loadDashboardData();
    }
  }, [authLoading]);

  const loadDashboardData = async () => {
    try {
      console.log('🔍 SCHOOL ADMIN DEBUG: Starting loadDashboardData...');
      console.log('🔍 SCHOOL ADMIN DEBUG: Auth loading:', authLoading);
      console.log('🔍 SCHOOL ADMIN DEBUG: User exists:', !!user);
      console.log('🔍 SCHOOL ADMIN DEBUG: User ID:', user?.id || 'unknown');
      
      setLoading(true);
      
      // Wait for auth to finish loading
      if (authLoading) {
        console.log('🔍 SCHOOL ADMIN DEBUG: Auth still loading, waiting...');
        return;
      }
      
      if (!user) {
        console.log('🔍 SCHOOL ADMIN DEBUG: No user, redirecting to login');
        router.push('/auth/login');
        return;
      }

      // Use backend endpoints to avoid RLS recursion
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) {
        setError('Not authenticated');
        router.push('/auth/login');
        return;
      }

      const adminResp = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!adminResp.ok) {
        console.log('🔍 SCHOOL ADMIN DEBUG: Failed to load admin data via backend');
        setError('Failed to load admin data');
        return;
      }
      const adminJson = await adminResp.json();
      const adminData = adminJson.admin as SchoolAdmin;
      setAdmin(adminData);

      // Load tutoring opportunities for this school
      const oppResp = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/opportunities`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (oppResp.ok) {
        const oppJson = await oppResp.json();
        setOpportunities((oppJson.opportunities || []).slice(0, 10));
      }

      // Debug: Log admin school info
      console.log('🔍 SCHOOL ADMIN DEBUG: Admin school_id:', adminData.school_id);
      console.log('🔍 SCHOOL ADMIN DEBUG: Admin school name:', adminData.school?.name);

      // Load tutors for this school
      const tutorsResp = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/tutors`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (tutorsResp.ok) {
        const tutorsJson = await tutorsResp.json();
        setTutors(tutorsJson.tutors || []);
      }

      // Avoid broad debug queries that can trigger RLS recursion

    } catch (err) {
      console.error('🔍 SCHOOL ADMIN DEBUG: Error loading dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/auth/login')}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                School Admin Dashboard
              </h1>
              <p className="text-gray-600">
                {admin?.school?.name} - {admin?.first_name} {admin?.last_name}
              </p>
            </div>
            <button
              onClick={handleSignOut}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold">T</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Total Tutors
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {tutors.length}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold">A</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Active Tutors
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {tutors.filter(t => t.status === 'active').length}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold">O</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Open Opportunities
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {opportunities.filter(o => o.status === 'open').length}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Opportunities */}
          <div className="bg-white shadow overflow-hidden sm:rounded-md mb-8">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Recent Tutoring Opportunities
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                Latest tutoring requests for {admin?.school?.name}
              </p>
            </div>
            <ul className="divide-y divide-gray-200">
              {opportunities.length === 0 ? (
                <li className="px-4 py-4 text-gray-500 text-center">
                  No tutoring opportunities found
                </li>
              ) : (
                opportunities.map((opportunity) => (
                  <li key={opportunity.id} className="px-4 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                            <span className="text-sm font-medium text-gray-700">
                              {opportunity.tutee_first_name[0]}{opportunity.tutee_last_name[0]}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {opportunity.tutee_first_name} {opportunity.tutee_last_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {opportunity.subject} - Grade {opportunity.grade_level}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          opportunity.status === 'open' 
                            ? 'bg-green-100 text-green-800'
                            : opportunity.status === 'assigned'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {opportunity.status}
                        </span>
                        <div className="ml-4 text-sm text-gray-500">
                          {new Date(opportunity.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>

          {/* Tutors List */}
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                School Tutors
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                Tutors registered for {admin?.school?.name}
              </p>
            </div>
            <ul className="divide-y divide-gray-200">
              {tutors.length === 0 ? (
                <li className="px-4 py-4 text-gray-500 text-center">
                  No tutors found for this school
                </li>
              ) : (
                tutors.map((tutor) => (
                  <li key={tutor.id} className="px-4 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <span className="text-sm font-medium text-blue-700">
                              {tutor.first_name[0]}{tutor.last_name[0]}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {tutor.first_name} {tutor.last_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {tutor.email}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          tutor.status === 'active' 
                            ? 'bg-green-100 text-green-800'
                            : tutor.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {tutor.status}
                        </span>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => router.push(`/admin/tutors/${tutor.id}`)}
                            className="text-blue-600 hover:text-blue-900 text-sm"
                          >
                            View
                          </button>
                          <button
                            onClick={() => router.push(`/admin/tutors/${tutor.id}/edit`)}
                            className="text-blue-600 hover:text-blue-900 text-sm"
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>

        </div>
      </main>
    </div>
  );
}