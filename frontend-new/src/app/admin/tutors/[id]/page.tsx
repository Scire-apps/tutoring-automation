// @ts-nocheck

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/services/supabase';

export default function ViewTutorPage() {
  const router = useRouter();
  const params = useParams();
  const tutorId = params.id as string;
  const [data, setData] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token ?? '';
        const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/tutors/${tutorId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!resp.ok) throw new Error('Failed to load tutor');
        const json = await resp.json();
        setData(json);

        // Load past jobs for this tutor
        const hist = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/tutors/${tutorId}/history`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (hist.ok) {
          const hj = await hist.json();
          setHistory(hj.jobs || []);
        }
      } catch (e: any) {
        setError(e.message || 'Failed to load tutor');
      } finally {
        setLoading(false);
      }
    })();
  }, [tutorId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading tutor...</p>
        </div>
      </div>
    );
  }
  if (error || !data?.tutor) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Tutor not found'}</p>
          <button onClick={() => router.back()} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Go Back</button>
        </div>
      </div>
    );
  }

  const { tutor, subject_approvals = [] } = data;

  return (
    <div className="relative min-h-screen bg-white overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 -left-32 w-[40rem] h-[40rem] rounded-full bg-gradient-to-tr from-blue-200 via-indigo-200 to-purple-200 blur-3xl opacity-70 animate-pulse" />
        <div className="absolute -bottom-32 -right-32 w-[40rem] h-[40rem] rounded-full bg-gradient-to-tr from-indigo-200 via-purple-200 to-pink-200 blur-3xl opacity-70 animate-pulse" />
      </div>
      <header className="bg-white/80 backdrop-blur shadow-sm ring-1 ring-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <button onClick={() => router.back()} className="text-blue-600 hover:text-blue-800 mb-2">← Back</button>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">{tutor.first_name} {tutor.last_name}</h1>
          <p className="text-gray-600">{tutor.school?.name} • {tutor.email?.replace(/(^[^@\s]+)(\+(?:tutor|tutee))@([Hh][Dd][Ss][Bb]\.ca)$/,'$1@$3')}</p>
        </div>
      </header>
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white shadow-xl ring-1 ring-gray-200 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-2">Account</h2>
            <div className="text-sm text-gray-700 space-y-1">
              <p>Status: <span className="font-medium">{tutor.status}</span></p>
              <p>Volunteer Hours: <span className="font-medium">{tutor.volunteer_hours || 0}</span></p>
            </div>
          </div>
          <div className="bg-white shadow-xl ring-1 ring-gray-200 rounded-2xl p-6 lg:col-span-2">
            <h2 className="text-lg font-semibold mb-4">Subject Approvals</h2>
            {subject_approvals.length === 0 ? (
              <p className="text-sm text-gray-500">No subject approvals.</p>
            ) : (
              <ul className="divide-y">
                {subject_approvals.map((a: any) => (
                  <li key={a.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium">{a.subject_name || 'Unknown'} • {a.subject_type}</div>
                      <div className="text-xs text-gray-500">Grade {a.subject_grade}</div>
                    </div>
                    <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">{a.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-6 bg-white shadow-xl ring-1 ring-gray-200 rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4">Past Jobs</h2>
          {history.length === 0 ? (
            <p className="text-sm text-gray-500">No past jobs.</p>
          ) : (
            <ul className="divide-y">
              {history.map((j: any) => (
                <li key={j.id} className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{j.subject_name} • {j.subject_type} • Grade {j.subject_grade}</div>
                      <div className="text-xs text-gray-500">{j.scheduled_time ? new Date(j.scheduled_time).toLocaleString() : ''} • {j.duration_minutes ? `${j.duration_minutes} minutes` : ''}</div>
                    </div>
                    <div className="text-xs text-gray-500">Awarded: {j.awarded_volunteer_hours || 0}h</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}


