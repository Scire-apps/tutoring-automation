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
      if (authLoading) return;
      if (!user) { navigate('/auth/login'); return; }
      if (!isAdmin()) { navigate('/tutor/dashboard'); return; }
      try {
        const token = session?.access_token; if (!token) { navigate('/auth/login'); return; }
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
  
  const handleSignOut = async () => { await signOut(); };

  const closeCertModal = () => { setSelectedCertRequest(null); setActionError(null); };

  const approveOrReject = async (action: 'approve'|'reject') => {
    if (!selectedCertRequest) return;
    try {
      setActing(true);
      setActionError(null);
      const payload: any = {
        action,
        subject_name: selectedCertRequest.subject_name,
        subject_type: selectedCertRequest.subject_type,
        subject_grade: String(selectedCertRequest.subject_grade || selectedCertRequest.grade || ''),
        request_id: selectedCertRequest.id,
      };
      await api.updateTutorSubjectApprovalAdmin(String(selectedCertRequest.tutor_id || selectedCertRequest.tutorId), payload);
      // Ensure deletion of the certification request regardless of approval/rejection result
      try { await api.deleteCertificationRequestAdmin(String(selectedCertRequest.id)); } catch (_) {}
      // Optimistically remove the request and close
      setCertificationRequests(prev => prev.filter(r => r.id !== selectedCertRequest.id));
      closeCertModal();
    } catch (e: any) {
      setActionError(e?.message || 'Failed to process request');
    } finally {
      setActing(false);
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
  
  return (
    <div className="relative min-h-screen bg-white overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 -left-32 w-[40rem] h-[40rem] rounded-full bg-gradient-to-tr from-blue-200 via-indigo-200 to-purple-200 blur-3xl opacity-70 animate-pulse" />
        <div className="absolute -bottom-32 -right-32 w-[40rem] h-[40rem] rounded-full bg-gradient-to-tr from-indigo-200 via-purple-200 to-pink-200 blur-3xl opacity-70 animate-pulse" />
      </div>
      {/* Header */}
      <header className="bg-white/80 backdrop-blur shadow-sm ring-1 ring-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Admin Dashboard</h1>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">
              {admin?.first_name} {admin?.last_name}
            </span>
            <button onClick={handleSignOut} className="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-sm shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500">Sign out</button>
          </div>
        </div>
      </header>
      
      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview banner */}
        <div className="relative overflow-hidden rounded-3xl mb-8 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xl">
          <div className="px-6 py-6">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div>
                <div className="text-sm/6 opacity-90">Welcome back</div>
                <div className="mt-1 text-2xl font-semibold tracking-tight">{admin?.first_name} {admin?.last_name}</div>
                <div className="opacity-80 text-sm">{admin?.school?.name || 'Admin'}</div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                <div className="rounded-xl bg-white/10 backdrop-blur px-3 py-2 shadow-inner"><div className="text-xs opacity-85">Tutors</div><div className="text-lg font-bold">{tutors.length}</div></div>
                <div className="rounded-xl bg-white/10 backdrop-blur px-3 py-2 shadow-inner"><div className="text-xs opacity-85">Opportunities</div><div className="text-lg font-bold">{opportunities.length}</div></div>
                <div className="rounded-xl bg-white/10 backdrop-blur px-3 py-2 shadow-inner"><div className="text-xs opacity-85">Awaiting Jobs</div><div className="text-lg font-bold">{awaitingJobs.length}</div></div>
                <div className="rounded-xl bg-white/10 backdrop-blur px-3 py-2 shadow-inner"><div className="text-xs opacity-85">Cert Requests</div><div className="text-lg font-bold">{certificationRequests.length}</div></div>
                <div className="rounded-xl bg-white/10 backdrop-blur px-3 py-2 shadow-inner"><div className="text-xs opacity-85">Help</div><div className="text-lg font-bold">{helpRequests.length}</div></div>
              </div>
            </div>
          </div>
        </div>

        {/* Grid Layout for Admin Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
          {/* Pending Verification Section */}
          <div className="bg-white shadow-xl ring-1 ring-gray-200 overflow-hidden rounded-2xl">
            <div className="px-4 py-5 sm:px-6"><h2 className="text-lg leading-6 font-semibold text-gray-900">Jobs Pending Verification</h2><p className="mt-1 max-w-2xl text-sm text-gray-500">Verify completed sessions and award volunteer hours.</p></div>
            <div className="max-h-96 overflow-y-auto">
              <ul className="divide-y divide-gray-100">{awaitingJobs.length === 0 ? (<li className="px-4 py-4 text-gray-500 text-center">No jobs awaiting verification</li>) : (awaitingJobs.map((job: any) => (<AwaitingJobRow key={job.id} job={job} />)))}</ul>
            </div>
          </div>

          {/* Certification Requests */}
          <div className="bg-white shadow-xl ring-1 ring-gray-200 overflow-hidden rounded-2xl">
            <div className="px-4 py-5 sm:px-6"><h2 className="text-lg leading-6 font-semibold text-gray-900">Certification Requests</h2><p className="mt-1 max-w-2xl text-sm text-gray-500">Tutor certification requests for your school.</p></div>
            <div className="max-h-96 overflow-y-auto">
              <ul className="divide-y divide-gray-100">{certificationRequests.length === 0 ? (<li className="px-4 py-4 text-gray-500 text-center">No certification requests</li>) : (certificationRequests.map((req: any) => (<li key={req.id} className="px-4 py-4 cursor-pointer hover:bg-gray-50" onClick={() => { setSelectedCertRequest(req); setActionError(null); }}><div className="flex items-center justify-between"><div><div className="text-sm font-medium text-gray-900">{req.tutor_name || 'Tutor'} — {req.subject_name} • {req.subject_type} • Grade {req.subject_grade}</div><div className="text-xs text-gray-500">Requested {req.created_at ? new Date(req.created_at).toLocaleString() : ''}{req.tutor_mark ? ` • Mark: ${req.tutor_mark}` : ''}</div></div><div className="text-xs text-gray-500">Click to review</div></div></li>)))}</ul>
            </div>
          </div>

          {/* Help Requests */}
          <div className="bg-white shadow-xl ring-1 ring-gray-200 overflow-hidden rounded-2xl">
            <div className="px-4 py-5 sm:px-6"><h2 className="text-lg leading-6 font-semibold text-gray-900">Help Requests</h2><p className="mt-1 max-w-2xl text-sm text-gray-500">Questions submitted by tutors and tutees in your school.</p></div>
            {helpError && (<div className="px-4 text-sm text-red-600">{helpError}</div>)}
            <div className="max-h-96 overflow-y-auto">
              <ul className="divide-y divide-gray-100">{helpRequests.length === 0 ? (<li className="px-4 py-4 text-gray-500 text-center">No help requests</li>) : (helpRequests.map((h: any) => { const isExpanded = !!expandedHelpIds[h.id]; const schoolName = schools.find((s) => s.id === h.school_id)?.name; const initials = `${(h.user_first_name || '?').charAt(0)}${(h.user_last_name || '').charAt(0)}`; const urgencyBadge = h.urgency === 'high' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'; return (<li key={h.id} className="px-4 py-4"><div className="flex items-center justify-between"><div className="flex items-center"><div className="flex-shrink-0 h-10 w-10"><div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center"><span className="text-sm font-medium text-gray-700">{initials}</span></div></div><div className="ml-4"><div className="text-sm font-medium text-gray-900">{h.user_first_name} {h.user_last_name} <span className="text-gray-500">({h.role})</span></div><div className="text-xs text-gray-500">{h.user_email?.replace(/(^[^@\s]+)(\+(?:tutor|tutee))@([Hh][Dd][Ss][Bb]\.ca)$/,'$1@$3')} • {schoolName || 'Unknown school'} {h.submitted_at ? `• ${new Date(h.submitted_at).toLocaleString()}` : ''}</div></div></div><div className="flex items-center gap-3"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${urgencyBadge}`}>{h.urgency === 'high' ? 'Urgent' : 'Non-urgent'}</span><button className="text-gray-500 hover:text-gray-700" onClick={() => setExpandedHelpIds((prev) => ({ ...prev, [h.id]: !isExpanded }))}>{isExpanded ? 'Hide' : 'View'}</button></div></div>{isExpanded && (<div className="mt-3 border-t pt-3 text-sm text-gray-800"><div className="mb-2"><div className="font-medium">Description</div><div className="whitespace-pre-wrap text-gray-700">{h.description}</div></div><div className="flex justify-end"><button className={`px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm disabled:opacity-50`} disabled={resolvingId === h.id} onClick={async () => { try { setHelpError(null); setResolvingId(h.id); const { supabase } = await import('@/services/supabase'); const { data: { session } } = await supabase.auth.getSession(); const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/help-requests/${h.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session?.access_token ?? ''}` } }); if (!resp.ok) { const j = await resp.json().catch(()=>({})); throw new Error(j.error || 'Failed to resolve help request'); } setHelpRequests((prev) => prev.filter((x) => x.id !== h.id)); } catch (e: any) { setHelpError(e?.message || 'Failed to resolve help request'); } finally { setResolvingId(null); } }}> {resolvingId === h.id ? 'Resolving...' : 'Mark as resolved'} </button></div></div>)}</li>); }))}</ul>
            </div>
          </div>

          {/* School/Opportunities Section */}
          <div className="bg-white shadow-xl ring-1 ring-gray-200 overflow-hidden rounded-2xl">
            <div className="px-4 py-5 sm:px-6"><h2 className="text-lg leading-6 font-medium text-gray-900">{admin?.school?.name ? `Recent Tutoring Opportunities at ${admin.school.name}` : 'Recent Tutoring Opportunities'}</h2><p className="mt-1 max-w-2xl text-sm text-gray-500">Latest tutoring requests</p></div>
            <div className="max-h-96 overflow-y-auto">
              <ul className="divide-y divide-gray-200">{opportunities.length === 0 ? (<li className="px-4 py-4 text-gray-500 text-center">No tutoring opportunities found</li>) : (opportunities.map((opportunity: any) => { const tFirst = opportunity?.tutee?.first_name ?? opportunity?.tutee_first_name ?? ''; const tLast = opportunity?.tutee?.last_name ?? opportunity?.tutee_last_name ?? ''; const subj = opportunity?.subject_name ? `${opportunity.subject_name} • ${opportunity.subject_type} • Grade ${opportunity.subject_grade}` : (opportunity?.subject ?? ''); const firstInitial = tFirst && typeof tFirst === 'string' ? tFirst.charAt(0) : '?'; const lastInitial = tLast && typeof tLast === 'string' ? tLast.charAt(0) : ''; return (<li key={opportunity.id} className="px-4 py-4"><div className="flex items-center justify-between"><div className="flex items-center"><div className="flex-shrink-0 h-10 w-10"><div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center"><span className="text-sm font-medium text_gray-700">{firstInitial}{lastInitial}</span></div></div><div className="ml-4"><div className="text-sm font-medium text-gray-900">{tFirst} {tLast}</div><div className="text-sm text-gray-500">{subj}{opportunity.grade_level ? ` - Grade ${opportunity.grade_level}` : ''}</div></div></div><div className="flex items-center"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${opportunity.status === 'open' ? 'bg-green-100 text-green-800' : opportunity.status === 'assigned' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>{opportunity.status}</span><div className="ml-4 text-sm text-gray-500">{new Date(opportunity.created_at).toLocaleDateString()}</div></div></div></li>); }))}</ul>
            </div>
          </div>
        </div>

        {/* Tutors Section - Full Width */}
        <div className="bg-white shadow-xl ring-1 ring-gray-200 overflow-hidden rounded-2xl">
          <div className="px-4 py-5 sm:px-6"><h2 className="text-lg leading-6 font-medium text-gray-900">Tutors</h2><p className="mt-1 max-w-2xl text-sm text-gray-500">All tutors in the system.</p></div>
          <div className="border-t border-gray-200">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50/70">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">School</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Hours</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {tutors.map((tutor) => (
                  <tr key={tutor.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-semibold">{(tutor.first_name || 'T').charAt(0)}{(tutor.last_name || '').charAt(0)}</div>
                        <span>{tutor.first_name} {tutor.last_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{tutor.email?.replace(/(^[^@\s]+)(\+(?:tutor|tutee))@([Hh][Dd][Ss][Bb]\.ca)$/,'$1@$3')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{tutor.school?.name || 'Not assigned'}</td>
                    <td className="px-6 py-4 whitespace-nowrap"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${tutor.status === 'active' ? 'bg-green-100 text-green-800' : tutor.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>{tutor.status === 'active' ? 'Active' : tutor.status === 'pending' ? 'Pending' : 'Suspended'}</span></td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{tutor.volunteer_hours || 0}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"><a href={`/admin/tutors/${tutor.id}/edit`} className="text-blue-600 hover:text-blue-800 hover:underline">Manage</a></td>
                  </tr>
                ))}
                {tutors.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">No tutors found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Certification Request Modal */}
      {selectedCertRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={closeCertModal} />
          <div className="relative z-10 w-full max-w-lg mx-auto bg-white rounded-2xl shadow-xl ring-1 ring-gray-200 p-6">
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Review Certification Request</h3>
              <button onClick={closeCertModal} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            {actionError && <div className="mt-3 text-sm text-red-600">{actionError}</div>}
            <div className="mt-4 text-sm text-gray-700 space-y-2">
              <div><span className="font-medium">Tutor:</span> {selectedCertRequest.tutor_name || selectedCertRequest.tutor_full_name || 'Tutor'}</div>
              <div><span className="font-medium">Subject:</span> {selectedCertRequest.subject_name} • {selectedCertRequest.subject_type} • Grade {selectedCertRequest.subject_grade}</div>
              {selectedCertRequest.tutor_mark && (<div><span className="font-medium">Mark:</span> {selectedCertRequest.tutor_mark}</div>)}
              {selectedCertRequest.created_at && (<div><span className="font-medium">Requested:</span> {new Date(selectedCertRequest.created_at).toLocaleString()}</div>)}
            </div>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button disabled={acting} onClick={() => approveOrReject('reject')} className="px-4 py-2 rounded-xl border border-gray-300 hover:bg-gray-50 disabled:opacity-50">{acting ? 'Working...' : 'Reject'}</button>
              <button disabled={acting} onClick={() => approveOrReject('approve')} className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow disabled:opacity-50">{acting ? 'Working...' : 'Approve'}</button>
            </div>
          </div>
        </div>
      )}
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
        const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/awaiting-verification/${job.id}/recording`, { headers: { Authorization: `Bearer ${session?.access_token ?? ''}` } });
        if (resp.ok) { const j = await resp.json(); setRecordingUrl(j.recording_url || null); }
      } catch (e) { }
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
      const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/awaiting-verification/${job.id}/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` }, body: JSON.stringify({ awarded_hours: hours }) });
      if (!resp.ok) { const j = await resp.json().catch(()=>({})); throw new Error(j.error || 'Failed to verify job'); }
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
          <div className="text-sm font-medium text-gray-900">{job.subject_name} • {job.subject_type} • Grade {job.subject_grade}</div>
          <div className="text-xs text-gray-500">Scheduled: {job.scheduled_time ? new Date(job.scheduled_time).toLocaleString() : 'N/A'}</div>
        </div>
        <button className="text-gray-500" onClick={()=> setExpanded(v=>!v)}>{expanded ? 'Hide' : 'View'}</button>
      </div>
      {expanded && (
        <div className="mt-3 border-t pt-3">
          {error && <div className="mb-2 text-red-600 text-sm">{error}</div>}
          <div className="text-sm text-gray-700 space-y-1">
            <div><span className="font-medium">Recording:</span> {recordingUrl ? <a href={recordingUrl} target="_blank" className="text-blue-600 underline">View recording link</a> : 'No link found'}</div>
            <div><span className="font-medium">Tutor:</span> {job.tutor_name || (job.opportunity_snapshot?.tutor_name) || 'Tutor'}</div>
            <div><span className="font-medium">Tutee:</span> {job.tutee_name || (job.opportunity_snapshot?.tutee_name) || 'Tutee'}</div>
          </div>
          <div className="mt-3">
            <button disabled={awarding} onClick={handleVerify} className="px-3 py-1.5 bg-green-600 text-white rounded">{awarding ? 'Verifying...' : 'Verify Session'}</button>
          </div>
        </div>
      )}
    </li>
  );
}