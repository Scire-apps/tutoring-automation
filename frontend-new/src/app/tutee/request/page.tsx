// @ts-nocheck

"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers';
import api from '@/services/api';
import { TuteeLayout } from '@/components/tutee-layout';
import { WeeklyTimeGrid, WeeklySelection, compressSelectionToWeeklyMap } from '@/components/weekly-time-grid';

export default function TuteeRequestPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  // Embedded subject fields
  const [subjectNames, setSubjectNames] = useState<string[]>([]);
  const SUBJECT_TYPES = ['Academic', 'ALP', 'IB'];
  const SUBJECT_GRADES = ['9', '10', '11', '12'];
  const [subjectName, setSubjectName] = useState('');
  const [subjectType, setSubjectType] = useState('');
  const [subjectGrade, setSubjectGrade] = useState('');
  // IB level (HL/SL) shown only when subjectType === 'IB'
  const [ibLevel, setIbLevel] = useState('');
  // Single-session flow: no weekly availability at request time
  const [locationPreference, setLocationPreference] = useState('');
  const [notes, setNotes] = useState('');
  const [isELL, setIsELL] = useState(false);
  const [ellLanguage, setEllLanguage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.push('/auth/login');
      return;
    }
    (async () => {
      try {
        // Load tutee profile to get their subjects
        const apiBase = process.env.NEXT_PUBLIC_API_URL as string;
        const { data: { session } } = await (await import('@/services/supabase')).supabase.auth.getSession();
        const resp = await fetch(`${apiBase}/api/tutee/subjects`, { headers: { Authorization: `Bearer ${session?.access_token ?? ''}` }});
        const j = await resp.json();
        const mySubjects = Array.isArray(j.subjects) ? j.subjects : [];
        setSubjectNames(mySubjects);
        // Prefill grade based on graduation year if backend sent it in separate endpoint; for now, keep manual grade select
      } catch {}
    })();
  }, [isLoading, user, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
      try {
        // Build final subject name; append IB level when applicable
        let finalSubjectName = subjectType === 'IB' && ibLevel
          ? `${subjectName} ${ibLevel}`
          : subjectName;
        if (isELL) {
          finalSubjectName = `${finalSubjectName} (ELL)`;
        }
        await api.createTuteeOpportunity({
        subject_name: finalSubjectName,
        subject_type: subjectType,
        subject_grade: subjectGrade,
        language: isELL && ellLanguage ? ellLanguage : undefined,
        location_preference: locationPreference,
        additional_notes: notes,
      });
      router.push('/tutee/dashboard');
    } catch (e: any) {
      setError(e?.message || 'Failed to create request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <TuteeLayout>
      <div className="p-6 bg-white max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold">Request Tutoring</h1>
        <form onSubmit={submit} className="mt-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium">Subject</label>
            <select className="mt-1 border rounded px-3 py-2 w-full" value={subjectName} onChange={e=>setSubjectName(e.target.value)} required>
              <option value="">Select...</option>
              {subjectNames.map(s => (<option key={s} value={s}>{s}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Type</label>
            <select className="mt-1 border rounded px-3 py-2 w-full" value={subjectType} onChange={e=>{ setSubjectType(e.target.value); if (e.target.value !== 'IB') setIbLevel(''); }} required>
              <option value="">Select...</option>
              {SUBJECT_TYPES.map(s => (<option key={s} value={s}>{s}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Grade</label>
            <select className="mt-1 border rounded px-3 py-2 w-full" value={subjectGrade} onChange={e=>setSubjectGrade(e.target.value)} required>
              <option value="">Select...</option>
              {SUBJECT_GRADES.map(s => (<option key={s} value={s}>{s}</option>))}
            </select>
          </div>
        </div>
        <div className="mt-2">
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isELL} onChange={e=> setIsELL(e.target.checked)} />
            Are you an ELL student?
          </label>
        </div>
        {isELL && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium">Preferred Language</label>
              <input className="mt-1 border rounded px-3 py-2 w-full" value={ellLanguage} onChange={e=> setEllLanguage(e.target.value)} placeholder="e.g., Spanish, French" />
            </div>
          </div>
        )}
        {subjectType === 'IB' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium">IB Level</label>
              <select className="mt-1 border rounded px-3 py-2 w-full" value={ibLevel} onChange={e=>setIbLevel(e.target.value)} required>
                <option value="">Select...</option>
                {['SL','HL'].map(l => (<option key={l} value={l}>{l}</option>))}
              </select>
              <p className="mt-1 text-xs text-gray-500">This will be appended to the subject name (e.g., "Math HL").</p>
            </div>
          </div>
        )}
        {/* No availability selection at request time in single-session flow */}
        <div>
          <label className="block text-sm font-medium">Location Preference</label>
          <input className="mt-1 border rounded px-3 py-2 w-full" value={locationPreference} onChange={e=>setLocationPreference(e.target.value)} placeholder="In-person / Online" />
        </div>
        <div>
          <label className="block text-sm font-medium">Additional Notes</label>
          <textarea className="mt-1 border rounded px-3 py-2 w-full" rows={3} value={notes} onChange={e=>setNotes(e.target.value)} />
        </div>
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <button disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded">{loading?'Submitting...':'Submit Request'}</button>
        </form>
      </div>
    </TuteeLayout>
  );
}


