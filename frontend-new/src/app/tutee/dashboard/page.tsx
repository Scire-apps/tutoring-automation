"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers';
import api from '@/services/api';

export default function TuteeDashboardPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      <div className="min-h-screen flex items-center justify-center">Loading...</div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-6">
      <h1 className="text-3xl font-bold">Welcome back!</h1>
      <p className="text-gray-600 mt-2">View your requests and current sessions.</p>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-2">Your Requests</h2>
        <div className="space-y-2">
          {(data.opportunities || []).map((o: any) => (
            <div key={o.id} className="border rounded p-4 flex items-center justify-between">
              <div>
                <div className="font-medium">{o.subject?.name || 'Subject'}</div>
                <div className="text-sm text-gray-500">Status: {o.status}</div>
              </div>
              <div className="text-sm text-gray-400">{new Date(o.created_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-2">Your Sessions</h2>
        <div className="space-y-2">
          {(data.jobs || []).map((j: any) => (
            <div key={j.id} className="border rounded p-4">
              <div className="font-medium">{j.subject?.name}</div>
              <div className="text-sm text-gray-500">Tutor: {j.tutor?.first_name} {j.tutor?.last_name}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}


