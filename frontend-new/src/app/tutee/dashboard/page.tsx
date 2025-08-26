// @ts-nocheck

"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers';
import api from '@/services/api';
import Link from 'next/link';
import { TuteeLayout } from '@/components/tutee-layout';

export default function TuteeDashboardPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());
  const [editingSubjects, setEditingSubjects] = useState(false);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [allSubjects, setAllSubjects] = useState<string[]>([]);
  const [savingSubjects, setSavingSubjects] = useState(false);
  
  // On-demand job details enrichment
  const loadJobDetails = async (jobId: string) => {
    try {
      const details = await api.getTuteeJobDetails(jobId);
      if (details?.job) {
        setData((prev: any) => {
          if (!prev) return prev;
          return { ...prev, jobs: (prev.jobs || []).map((j: any) => (j.id === jobId ? { ...j, ...details.job } : j)) };
        });
      }
    } catch (e) {
      // ignore enrichment errors
    }
  };

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.push('/auth/login');
      return;
    }
    (async () => {
      try {
        const d = await api.getTuteeDashboard();
        setData(d);
        // preload subjects
        try {
          const apiBase = process.env.NEXT_PUBLIC_API_URL as string;
          const { data: { session } } = await (await import('@/services/supabase')).supabase.auth.getSession();
          const resp = await fetch(`${apiBase}/api/tutee/subjects`, { headers: { Authorization: `Bearer ${session?.access_token ?? ''}` }});
          const j = await resp.json();
          setSubjects(Array.isArray(j.subjects) ? j.subjects : []);
          setAllSubjects(Array.isArray(j.all_subjects) ? j.all_subjects : []);
        } catch {}
      } catch (e: any) {
        setError(e?.message || 'Failed to load');
      }
    })();
  }, [isLoading, user, router]);

  if (isLoading || !data) {
    return (
      <TuteeLayout>
        <div className="min-h-full flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-gray-800">Loading your dashboard...</p>
          </div>
        </div>
      </TuteeLayout>
    );
  }

  return (
    <TuteeLayout>
      <div className="p-6 bg-white min-h-full">
        {/* Stats cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold">R</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Requests</dt>
                    <dd className="text-lg font-medium text-gray-900">{data.opportunities?.length || 0}</dd>
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
                    <dt className="text-sm font-medium text-gray-500 truncate">Open Requests</dt>
                    <dd className="text-lg font-medium text-gray-900">{(data.opportunities || []).filter((o: any)=>o.status==='open').length}</dd>
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
                    <span className="text-white font-bold">S</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Scheduled Sessions</dt>
                    <dd className="text-lg font-medium text-gray-900">{(data.jobs || []).filter((j:any)=>j.status==='scheduled').length}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Welcome section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome back!</h2>
          <p className="text-gray-600">Review your requests and upcoming sessions.</p>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Quick actions</h3>
            <Link href="/tutee/request" className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
              Request Tutoring
            </Link>
          </div>
          <div className="mt-3">
            <button onClick={()=> setEditingSubjects(true)} className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50">
              Edit My Subjects
            </button>
          </div>
        </div>

        {/* Requests */}
        <div className="mb-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Your Requests</h3>
          {data.opportunities && data.opportunities.length > 0 ? (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {data.opportunities.map((o: any) => (
                  <li key={o.id}>
                    <div className="px-4 py-4 sm:px-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                              <span className="text-white font-medium">{(o.subject_name || 'S').charAt(0)}</span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{o.subject_name} • {o.subject_type} • Grade {o.subject_grade}</div>
                            <div className="text-sm text-gray-500">Status: {o.status}</div>
                            {o.sessions_per_week && (
                              <div className="text-xs text-gray-400 mt-1">Sessions/week: {o.sessions_per_week}</div>
                            )}
                          </div>
                        </div>
                        <div className="text-sm text-gray-400">{new Date(o.created_at).toLocaleString()}</div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="text-center py-8 bg-white rounded-lg shadow">
              <h4 className="mt-2 text-sm font-medium text-gray-900">No requests</h4>
              <p className="mt-1 text-sm text-gray-500">Create a tutoring request to get matched with a tutor.</p>
              <div className="mt-6">
                <Link href="/tutee/request" className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
                  Create Request
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Sessions */}
        <div className="mb-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Your Sessions</h3>
          {data.jobs && data.jobs.length > 0 ? (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {data.jobs.map((j: any) => (
                  <li key={j.id}>
                    <div
                      className="px-4 py-4 sm:px-6 cursor-pointer"
                      onClick={() => {
                        const s = new Set(expandedJobs);
                        if (s.has(j.id)) s.delete(j.id); else s.add(j.id);
                        setExpandedJobs(s);
                        if (!expandedJobs.has(j.id)) {
                          loadJobDetails(j.id);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{j.subject_name} • {j.subject_type} • Grade {j.subject_grade}</div>
                          <div className="text-sm text-gray-500">Tutor: {j.tutor?.first_name} {j.tutor?.last_name}</div>
                        </div>
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          j.status === 'scheduled' ? 'bg-green-100 text-green-800' :
                          j.status === 'pending_tutor_scheduling' ? 'bg-orange-100 text-orange-800' :
                          j.status === 'pending_tutee_scheduling' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>{
                          j.status === 'pending_tutee_scheduling' ? 'awaiting your scheduling' :
                          j.status === 'pending_tutor_scheduling' ? 'awaiting tutor scheduling' : j.status
                        }</span>
                      </div>
                      {expandedJobs.has(j.id) && (
                        <div className="mt-4 pl-2 border-l border-gray-200">
                          <div className="grid grid-cols-1 gap-3 text-sm text-gray-700">
                            <div>
                              <div className="font-medium mb-1">Tutor Details</div>
                              <div className="space-y-1">
                                <div><span className="font-medium">Name:</span> {j.tutor?.first_name && j.tutor?.last_name ? `${j.tutor.first_name} ${j.tutor.last_name}` : '—'}</div>
                                <div><span className="font-medium">Email:</span> {j.tutor?.email || '—'}</div>
                              </div>
                            </div>
                            <div>
                              <div className="font-medium mb-1">Session Details</div>
                              <div className="space-y-1">
                                <div><span className="font-medium">Subject:</span> {j.subject_name} • {j.subject_type} • Grade {j.subject_grade}</div>
                                <div><span className="font-medium">Language:</span> {j.language || 'English'}</div>
                                {j.scheduled_time ? (
                                  <div><span className="font-medium">Scheduled:</span> {new Date(j.scheduled_time).toLocaleString()}</div>
                                ) : null}
                                <div><span className="font-medium">Status:</span> {j.status}</div>
                              </div>
                            </div>
                            <div>
                              <div className="font-medium mb-1">Your availability</div>
                              {j.tutee_availability ? (
                                <div className="space-y-1">
                                  {Object.entries(j.tutee_availability).map(([date, ranges]: any) => (
                                    <div key={date} className="text-sm text-gray-700">
                                      <span className="font-medium mr-2">{new Date(date as string).toLocaleDateString()}</span>
                                      {Array.isArray(ranges) && ranges.length ? ranges.join(', ') : <span className="text-gray-400">No time set</span>}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-sm text-gray-500">No availability submitted.</div>
                              )}
                            </div>
                          </div>
                          {j.status === 'pending_tutee_scheduling' && (
                            <div className="mt-4">
                              <Link href={`/tutee/schedule/${j.id}`} className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-red-600 hover:bg-red-700">Set your availability</Link>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="text-center py-8 bg-white rounded-lg shadow">
              <h4 className="mt-2 text-sm font-medium text-gray-900">No sessions yet</h4>
              <p className="mt-1 text-sm text-gray-500">Once a tutor accepts your request, your sessions will appear here.</p>
            </div>
          )}
        </div>
      </div>
      {editingSubjects && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={()=> setEditingSubjects(false)}></div>
          <div className="relative bg-white rounded-lg shadow-lg w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-2">Edit My Subjects</h3>
            <div className="space-y-2 mb-3">
              {subjects.map((s, idx) => {
                // compute options that exclude already chosen values (except current row)
                const chosen = new Set(subjects.filter((_, i)=> i !== idx && !!subjects[i]));
                const options = allSubjects.filter(n => !chosen.has(n));
                return (
                  <div key={idx} className="flex gap-2">
                    <select className="flex-1 border rounded px-3 py-2" value={s} onChange={(e)=>{
                      const next = subjects.slice(); next[idx] = e.target.value; setSubjects(next);
                    }}>
                      <option value="">Select...</option>
                      {options.map(n => (<option key={n} value={n}>{n}</option>))}
                    </select>
                    <button type="button" onClick={()=>{ const next = subjects.slice(); next.splice(idx,1); setSubjects(next); }} className="px-3 py-2 border rounded">Remove</button>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between">
              <button type="button" disabled={subjects.length>=10 || subjects.some(s=>!s)} onClick={()=> subjects.length<10 && !subjects.some(s=>!s) && setSubjects([...subjects, ''])} className="px-3 py-2 border rounded disabled:opacity-50 disabled:cursor-not-allowed">Add course</button>
              <div className="flex gap-2">
                <button className="px-3 py-2 border rounded" onClick={()=> setEditingSubjects(false)}>Cancel</button>
                <button className="px-3 py-2 bg-blue-600 text-white rounded" disabled={savingSubjects} onClick={async ()=>{
                  try {
                    setSavingSubjects(true);
                    const apiBase = process.env.NEXT_PUBLIC_API_URL as string;
                    const { data: { session } } = await (await import('@/services/supabase')).supabase.auth.getSession();
                    const resp = await fetch(`${apiBase}/api/tutee/subjects`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
                      body: JSON.stringify({ subjects: subjects.filter(Boolean) })
                    });
                    if (!resp.ok) { const j = await resp.json().catch(()=>({})); throw new Error(j.error || 'Failed to update'); }
                    setEditingSubjects(false);
                  } catch (e) {
                    // Could show toast
                  } finally {
                    setSavingSubjects(false);
                  }
                }}>{savingSubjects? 'Saving...' : 'Save'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </TuteeLayout>
  );
}


