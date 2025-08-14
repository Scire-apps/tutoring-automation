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
                          {j.scheduled_time ? (
                            <div className="text-sm text-gray-700">
                              <span className="font-medium mr-2">Scheduled:</span>
                              {new Date(j.scheduled_time).toLocaleString()}
                            </div>
                          ) : j.tutee_availability ? (
                            <div className="text-sm text-gray-700">
                              <div className="font-medium mb-1">Your availability</div>
                              <div className="space-y-1">
                                {Object.entries(j.tutee_availability).map(([date, ranges]: any) => (
                                  <div key={date} className="text-sm text-gray-700">
                                    <span className="font-medium mr-2">{new Date(date as string).toLocaleDateString()}</span>
                                    {Array.isArray(ranges) && ranges.length ? ranges.join(', ') : <span className="text-gray-400">No time set</span>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm text-gray-500">No schedule yet.</div>
                          )}
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
    </TuteeLayout>
  );
}


