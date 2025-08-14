// @ts-nocheck

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers';
import { TuteeLayout } from '@/components/tutee-layout';
import api from '@/services/api';
import { TwoWeekTimeGrid, compressSelectionToDateMap } from '@/components/two-week-time-grid';

export default function TuteeSchedulePage() {
  const { user, isLoading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  const [job, setJob] = useState<any>(null);
  const [selection, setSelection] = useState<{ [date: string]: Array<{ start: string; end: string }> }>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.push('/auth/login'); return; }
    (async () => {
      try {
        const { data: { session } } = await (await import('@/services/supabase')).supabase.auth.getSession();
        const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tutee/jobs/${jobId}`, {
          headers: { 'Authorization': `Bearer ${session?.access_token ?? ''}` }
        });
        if (!resp.ok) { setError('Job not found'); return; }
        const json = await resp.json();
        setJob(json.job);
        // Preload previous availability if any
        if (json.job?.tutee_availability && typeof json.job.tutee_availability === 'object') {
          const mask: any = {};
          Object.entries(json.job.tutee_availability).forEach(([d, arr]: any) => {
            mask[d] = (arr || []).map((s: string) => { const [start,end] = s.split('-'); return { start, end }; })
          });
          setSelection(mask);
        }
      } catch (e) {
        setError('Failed to load job');
      }
    })();
  }, [isLoading, user, router, jobId]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const availability = compressSelectionToDateMap(selection);
      await api.setTuteeAvailability(jobId, availability);
      router.push('/tutee/dashboard');
    } catch (e: any) {
      setError(e?.message || 'Failed to save availability');
    } finally {
      setSaving(false);
    }
  };

  if (!job) {
    return (
      <TuteeLayout>
        <div className="min-h-full flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-gray-800">Loading...</p>
          </div>
        </div>
      </TuteeLayout>
    );
  }

  return (
    <TuteeLayout>
      <div className="p-6 bg-white max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold">Set Your Availability</h1>
        <p className="text-sm text-gray-600 mt-1">Select all times you can meet over the next 14 days (excluding the next 2 days). The tutor will choose one time from your selection.</p>

        <div className="mt-6">
          <TwoWeekTimeGrid value={selection} onChange={setSelection} maxMinutesPerSession={180} />
        </div>

        {error && <div className="mt-4 text-red-600 text-sm">{error}</div>}

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={()=> router.push('/tutee/dashboard')} className="px-4 py-2 border rounded">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded">{saving ? 'Saving...' : 'Save Availability'}</button>
        </div>
      </div>
    </TuteeLayout>
  );
}


