'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/services/supabase';

export default function ViewTutorPage() {
  const router = useRouter();
  const params = useParams();
  const tutorId = params.id as string;
  const [data, setData] = useState<any>(null);
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
      } catch (e: any) {
        setError(e.message || 'Failed to load tutor');
      } finally {
        setLoading(false);
      }
    })();
  }, [tutorId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading tutor...</p>
        </div>
      </div>
    );
  }
  if (error || !data?.tutor) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Tutor not found'}</p>
          <button onClick={() => router.back()} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Go Back</button>
        </div>
      </div>
    );
  }

  const { tutor, subject_approvals = [] } = data;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <button onClick={() => router.back()} className="text-blue-600 hover:text-blue-800 mb-2">← Back</button>
          <h1 className="text-3xl font-bold text-gray-900">{tutor.first_name} {tutor.last_name}</h1>
          <p className="text-gray-600">{tutor.school?.name} • {tutor.email}</p>
        </div>
      </header>
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-2">Account</h2>
            <div className="text-sm text-gray-700 space-y-1">
              <p>Status: <span className="font-medium">{tutor.status}</span></p>
              <p>Volunteer Hours: <span className="font-medium">{tutor.volunteer_hours || 0}</span></p>
            </div>
          </div>
          <div className="bg-white shadow rounded-lg p-6 lg:col-span-2">
            <h2 className="text-lg font-semibold mb-4">Subject Approvals</h2>
            {subject_approvals.length === 0 ? (
              <p className="text-sm text-gray-500">No subject approvals.</p>
            ) : (
              <ul className="divide-y">
                {subject_approvals.map((a: any) => (
                  <li key={a.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium">{a.subject?.name || 'Unknown'}</div>
                      <div className="text-xs text-gray-500">{a.subject?.category} {a.subject?.grade_level}</div>
                    </div>
                    <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">{a.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}


