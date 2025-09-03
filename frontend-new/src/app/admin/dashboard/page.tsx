// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/app/providers';
import api from '@/services/api';
import { Admin, School, Tutor } from '@/types/models';

export default function AdminDashboardPage() {
  const { user, session, isAdmin, signOut, userRole, isLoading: authLoading } = useAuth();
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [awaitingJobs, setAwaitingJobs] = useState<any[]>([]);
  const [certificationRequests, setCertificationRequests] = useState<any[]>([]);
  const [selectedCertRequest, setSelectedCertRequest] = useState<any | null>(null);
  const [acting, setActing] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [helpRequests, setHelpRequests] = useState<any[]>([]);
  const [expandedHelpIds, setExpandedHelpIds] = useState<Record<string, boolean>>({});
  const [helpError, setHelpError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
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

        // Single aggregated fetch for dashboard
        const overview = await api.getAdminOverview();
        setAdmin(overview.admin as Admin);
        setSchools((overview.schools || []) as School[]);
        setTutors((overview.tutors || []) as Tutor[]);
        setOpportunities((overview.opportunities || []).slice(0, 10));
        setAwaitingJobs(overview.awaiting_jobs || []);
        setCertificationRequests(overview.certification_requests || []);
        setHelpRequests(overview.help_requests || []);
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
                  {admin?.email?.replace(/(^[^@\s]+)(\+(?:tutor|tutee))@([Hh][Dd][Ss][Bb]\.ca)$/,'$1@$3')}
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

        {/* Certification Requests */}
        <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-8">
          <div className="px-4 py-5 sm:px-6">
            <h2 className="text-lg leading-6 font-medium text-gray-900">Certification Requests</h2>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">Tutor certification requests for your school.</p>
          </div>
          <ul className="divide-y divide-gray-200">
            {certificationRequests.length === 0 ? (
              <li className="px-4 py-4 text-gray-500 text-center">No certification requests</li>
            ) : (
              certificationRequests.map((req: any) => (
                <li key={req.id} className="px-4 py-4 cursor-pointer hover:bg-gray-50" onClick={() => { setSelectedCertRequest(req); setActionError(null); }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {req.tutor_name || 'Tutor'} — {req.subject_name} • {req.subject_type} • Grade {req.subject_grade}
                      </div>
                      <div className="text-xs text-gray-500">
                        Requested {req.created_at ? new Date(req.created_at).toLocaleString() : ''}
                        {req.tutor_mark ? ` • Mark: ${req.tutor_mark}` : ''}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">Click to review</div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>

        {/* Help Requests */}
        <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-8">
          <div className="px-4 py-5 sm:px-6">
            <h2 className="text-lg leading-6 font-medium text-gray-900">Help Requests</h2>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">Questions submitted by tutors and tutees in your school.</p>
          </div>
          {helpError && (
            <div className="px-4 text-sm text-red-600">{helpError}</div>
          )}
          <ul className="divide-y divide-gray-200">
            {helpRequests.length === 0 ? (
              <li className="px-4 py-4 text-gray-500 text-center">No help requests</li>
            ) : (
              helpRequests.map((h: any) => {
                const isExpanded = !!expandedHelpIds[h.id];
                const schoolName = schools.find((s) => s.id === h.school_id)?.name;
                const initials = `${(h.user_first_name || '?').charAt(0)}${(h.user_last_name || '').charAt(0)}`;
                const urgencyBadge = h.urgency === 'high' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800';
                return (
                  <li key={h.id} className="px-4 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                            <span className="text-sm font-medium text-gray-700">{initials}</span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {h.user_first_name} {h.user_last_name} <span className="text-gray-500">({h.role})</span>
                          </div>
                          <div className="text-xs text-gray-500">
                            {h.user_email} • {schoolName || 'Unknown school'} {h.submitted_at ? `• ${new Date(h.submitted_at).toLocaleString()}` : ''}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${urgencyBadge}`}>
                          {h.urgency === 'high' ? 'Urgent' : 'Non-urgent'}
                        </span>
                        <button
                          className="text-gray-500"
                          onClick={() => setExpandedHelpIds((prev) => ({ ...prev, [h.id]: !isExpanded }))}
                        >
                          {isExpanded ? 'Hide' : 'View'}
                        </button>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="mt-3 border-t pt-3 text-sm text-gray-800">
                        {h.user_grade && (
                          <div className="mb-1"><span className="font-medium">Grade:</span> {h.user_grade}</div>
                        )}
                        <div className="mb-2">
                          <div className="font-medium">Description</div>
                          <div className="whitespace-pre-wrap text-gray-700">{h.description}</div>
                        </div>
                        <div className="flex justify-end">
                          <button
                            className={`px-3 py-1.5 bg-green-600 text-white rounded disabled:opacity-50`}
                            disabled={resolvingId === h.id}
                            onClick={async () => {
                              try {
                                setHelpError(null);
                                setResolvingId(h.id);
                                const { supabase } = await import('@/services/supabase');
                                const { data: { session } } = await supabase.auth.getSession();
                                const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/help-requests/${h.id}`, {
                                  method: 'DELETE',
                                  headers: { Authorization: `Bearer ${session?.access_token ?? ''}` }
                                });
                                if (!resp.ok) {
                                  const j = await resp.json().catch(()=>({}));
                                  throw new Error(j.error || 'Failed to resolve help request');
                                }
                                setHelpRequests((prev) => prev.filter((x) => x.id !== h.id));
                              } catch (e: any) {
                                setHelpError(e?.message || 'Failed to resolve help request');
                              } finally {
                                setResolvingId(null);
                              }
                            }}
                          >
                            {resolvingId === h.id ? 'Resolving...' : 'Mark as resolved'}
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>

        {selectedCertRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={() => setSelectedCertRequest(null)}></div>
            <div className="relative bg-white rounded-lg shadow-lg w-full max-w-lg p-6">
              <h3 className="text-lg font-semibold mb-2">Review Certification Request</h3>
              {actionError && <div className="mb-2 text-sm text-red-600">{actionError}</div>}
              <div className="text-sm text-gray-800 space-y-1 mb-4">
                <div><span className="font-medium">Tutor:</span> {selectedCertRequest.tutor_name || selectedCertRequest.tutor_id}</div>
                <div><span className="font-medium">Subject:</span> {selectedCertRequest.subject_name} • {selectedCertRequest.subject_type} • Grade {selectedCertRequest.subject_grade}</div>
                {selectedCertRequest.tutor_mark && (
                  <div><span className="font-medium">Tutor Mark:</span> {selectedCertRequest.tutor_mark}</div>
                )}
                {selectedCertRequest.created_at && (
                  <div className="text-xs text-gray-500">Requested {new Date(selectedCertRequest.created_at).toLocaleString()}</div>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  className="px-3 py-1.5 border rounded"
                  onClick={() => setSelectedCertRequest(null)}
                  disabled={acting}
                >
                  Close
                </button>
                <button
                  className="px-3 py-1.5 bg-red-600 text-white rounded disabled:opacity-50"
                  disabled={acting}
                  onClick={async () => {
                    try {
                      setActing(true);
                      setActionError(null);
                      const { supabase } = await import('@/services/supabase');
                      const { data: { session } } = await supabase.auth.getSession();
                      const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/certification-requests/${selectedCertRequest.id}`, {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` }
                      });
                      if (!resp.ok) {
                        const j = await resp.json().catch(()=>({}));
                        throw new Error(j.error || 'Failed to delete request');
                      }
                      setCertificationRequests(prev => prev.filter(r => r.id !== selectedCertRequest.id));
                      setSelectedCertRequest(null);
                    } catch (e: any) {
                      setActionError(e?.message || 'Failed to reject request');
                    } finally {
                      setActing(false);
                    }
                  }}
                >
                  Reject
                </button>
                <button
                  className="px-3 py-1.5 bg-green-600 text-white rounded disabled:opacity-50"
                  disabled={acting}
                  onClick={async () => {
                    try {
                      setActing(true);
                      setActionError(null);
                      const { supabase } = await import('@/services/supabase');
                      const { data: { session } } = await supabase.auth.getSession();
                      // Approve via backend (writes to subject_approvals and deletes request)
                      const approveResp = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/certification-requests/${selectedCertRequest.id}/approve`, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` }
                      });
                      if (!approveResp.ok) {
                        const j = await approveResp.json().catch(()=>({}));
                        throw new Error(j.error || 'Failed to approve request');
                      }
                      setCertificationRequests(prev => prev.filter(r => r.id !== selectedCertRequest.id));
                      setSelectedCertRequest(null);
                    } catch (e: any) {
                      setActionError(e?.message || 'Failed to certify request');
                    } finally {
                      setActing(false);
                    }
                  }}
                >
                  Certify
                </button>
              </div>
            </div>
          </div>
        )}

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