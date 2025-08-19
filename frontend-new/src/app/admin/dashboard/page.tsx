// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/app/providers';
import { Admin, School, Tutor } from '@/types/models';

export default function AdminDashboardPage() {
  const { user, session, isAdmin, signOut, userRole, isLoading: authLoading } = useAuth();
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [awaitingJobs, setAwaitingJobs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = (href: string) => { if (typeof window !== 'undefined') window.location.href = href; };
  
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
        navigate('/auth/login');
        return;
      }
      
      // Check if user is actually an admin
      if (!isAdmin()) {
        console.log('Admin dashboard: User is not an admin, redirecting to tutor dashboard');
        navigate('/tutor/dashboard');
        return;
      }
      
      console.log('Admin dashboard: Admin user authenticated, proceeding...');
      
      try {
        // Fetch via backend using service role (avoids RLS recursion)
        const token = session?.access_token;
        if (!token) {
          console.error('Admin dashboard: no access token found');
          navigate('/auth/login');
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

        // Opportunities list (scoped by school if admin has one)
        const oppResp = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/opportunities`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (oppResp.ok) {
          const oppJson = await oppResp.json();
          setOpportunities((oppJson.opportunities || []).slice(0, 10));
        }

        // Awaiting verification jobs list
        const awResp = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/awaiting-verification`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (awResp.ok) {
          const awJson = await awResp.json();
          setAwaitingJobs(awJson.jobs || []);
        }
      } catch (err) {
        console.error('Error fetching admin data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchAdminData();
  }, [user, isAdmin]);
  
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
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
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
        {/* Quick Actions removed (single admin role) */}

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
        
        {/* Pending Verification Section */}
        <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-8">
          <div className="px-4 py-5 sm:px-6">
            <h2 className="text-lg leading-6 font-medium text-gray-900">Jobs Pending Verification</h2>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">Verify completed sessions and award volunteer hours.</p>
          </div>
          <ul className="divide-y divide-gray-200">
            {awaitingJobs.length === 0 ? (
              <li className="px-4 py-4 text-gray-500 text-center">No jobs awaiting verification</li>
            ) : (
              awaitingJobs.map((job: any) => (
                <AwaitingJobRow key={job.id} job={job} />
              ))
            )}
          </ul>
        </div>

        {/* School/Opportunities Section (shows if admin has a school or we have opps) */}
        <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-8">
          <div className="px-4 py-5 sm:px-6">
            <h2 className="text-lg leading-6 font-medium text-gray-900">
              {admin?.school?.name ? `Recent Tutoring Opportunities at ${admin.school.name}` : 'Recent Tutoring Opportunities'}
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Latest tutoring requests
            </p>
          </div>
          <ul className="divide-y divide-gray-200">
            {opportunities.length === 0 ? (
              <li className="px-4 py-4 text-gray-500 text-center">No tutoring opportunities found</li>
            ) : (
              opportunities.map((opportunity: any) => {
                const tFirst = opportunity?.tutee?.first_name ?? opportunity?.tutee_first_name ?? '';
                const tLast = opportunity?.tutee?.last_name ?? opportunity?.tutee_last_name ?? '';
                const subj = opportunity?.subject_name ? `${opportunity.subject_name} • ${opportunity.subject_type} • Grade ${opportunity.subject_grade}` : (opportunity?.subject ?? '');
                const firstInitial = tFirst && typeof tFirst === 'string' ? tFirst.charAt(0) : '?';
                const lastInitial = tLast && typeof tLast === 'string' ? tLast.charAt(0) : '';
                return (
                  <li key={opportunity.id} className="px-4 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                            <span className="text-sm font-medium text-gray-700">
                              {firstInitial}{lastInitial}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {tFirst} {tLast}
                          </div>
                          <div className="text-sm text-gray-500">
                            {subj}{opportunity.grade_level ? ` - Grade ${opportunity.grade_level}` : ''}
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
                );
              })
            )}
          </ul>
        </div>

        {/* Tutors Section */}
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h2 className="text-lg leading-6 font-medium text-gray-900">
              Tutors
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">All tutors in the system.</p>
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
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <a href={`/admin/tutors/${tutor.id}`} className="text-blue-600 hover:text-blue-900 mr-4">
                        View history
                      </a>
                      <a href={`/admin/tutors/${tutor.id}/edit`} className="text-blue-600 hover:text-blue-900">
                        Edit certifications
                      </a>
                    </td>
                  </tr>
                ))}
                {tutors.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
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

function AwaitingJobRow({ job }: { job: any }) {
  const [expanded, setExpanded] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [awarding, setAwarding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { supabase } = await import('@/services/supabase');
        const { data: { session } } = await supabase.auth.getSession();
        const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/awaiting-verification/${job.id}/recording`, {
          headers: { Authorization: `Bearer ${session?.access_token ?? ''}` }
        });
        if (resp.ok) {
          const j = await resp.json();
          setRecordingUrl(j.recording_url || null);
        }
      } catch (e) {
        // ignore
      }
    })();
  }, [job.id]);

  const handleVerify = async () => {
    try {
      setAwarding(true);
      const hoursStr = prompt('Enter volunteer hours to award to the tutor:');
      if (hoursStr == null) return;
      const hours = Number(hoursStr);
      if (Number.isNaN(hours) || hours < 0) { setError('Invalid hours'); return; }
      const { supabase } = await import('@/services/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/awaiting-verification/${job.id}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ awarded_hours: hours })
      });
      if (!resp.ok) {
        const j = await resp.json().catch(()=>({}));
        throw new Error(j.error || 'Failed to verify job');
      }
      window.location.reload();
    } catch (e: any) {
      setError(e?.message || 'Failed to verify job');
    } finally {
      setAwarding(false);
    }
  };

  return (
    <li className="px-4 py-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-gray-900">
            {job.subject_name} • {job.subject_type} • Grade {job.subject_grade}
          </div>
          <div className="text-xs text-gray-500">Scheduled: {job.scheduled_time ? new Date(job.scheduled_time).toLocaleString() : 'N/A'}</div>
        </div>
        <button className="text-gray-500" onClick={()=> setExpanded(v=>!v)}>
          {expanded ? 'Hide' : 'View'}
        </button>
      </div>
      {expanded && (
        <div className="mt-3 border-t pt-3">
          {error && <div className="mb-2 text-red-600 text-sm">{error}</div>}
          <div className="text-sm text-gray-700 space-y-1">
            <div><span className="font-medium">Recording:</span> {recordingUrl ? <a href={recordingUrl} target="_blank" className="text-blue-600 underline">View recording link</a> : 'No link found'}</div>
            <div><span className="font-medium">Tutor ID:</span> {job.tutor_id}</div>
            <div><span className="font-medium">Tutee ID:</span> {job.tutee_id}</div>
          </div>
          <div className="mt-3">
            <button disabled={awarding} onClick={handleVerify} className="px-3 py-1.5 bg-green-600 text-white rounded">{awarding ? 'Verifying...' : 'Verify Session'}</button>
          </div>
        </div>
      )}
    </li>
  );
}