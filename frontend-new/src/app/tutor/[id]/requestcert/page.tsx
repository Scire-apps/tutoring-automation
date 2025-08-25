// @ts-nocheck

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/app/providers';
import { supabase } from '@/services/supabase';
import api from '@/services/api';
import { TutorLayout } from '@/components/tutor-layout';

export default function TutorRequestCertificationPage() {
  const router = useRouter();
  const params = useParams();
  const tutorIdFromRoute = params?.id as string | undefined;
  const { user, userRole, isLoading } = useAuth();

  const SUBJECT_TYPES = ['Academic','ALP','IB'];
  const SUBJECT_GRADES = ['9','10','11','12'];

  const [subjectOptions, setSubjectOptions] = useState<string[]>(['Math','English','History']);
  const [subjectName, setSubjectName] = useState('');
  const [subjectType, setSubjectType] = useState('');
  const [subjectGrade, setSubjectGrade] = useState('');
  const [ibLevel, setIbLevel] = useState('');
  const [tutorMark, setTutorMark] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.push('/auth/login');
      return;
    }
    if (userRole && userRole !== 'tutor') {
      router.push('/');
      return;
    }
    // Load master subjects list from backend (reads subjects.txt)
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tutee/subjects`, {
          headers: { Authorization: `Bearer ${session?.access_token ?? ''}` }
        });
        if (resp.ok) {
          const j = await resp.json();
          const names = Array.isArray(j.all_subjects) ? j.all_subjects : [];
          if (names.length) setSubjectOptions(names);
        }
      } catch {}
    })();
  }, [isLoading, user, userRole, router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const finalSubjectName = subjectType === 'IB' && ibLevel ? `${subjectName} ${ibLevel}` : subjectName;
      await api.createCertificationRequest({
        subject_name: finalSubjectName,
        subject_type: subjectType as any,
        subject_grade: subjectGrade as any,
        tutor_mark: tutorMark || undefined,
      });
      // tutorMark is collected but not sent (no backend field requested). Keep for future.
      router.push('/tutor/dashboard');
    } catch (err: any) {
      setError(err?.message || 'Failed to submit certification request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <TutorLayout>
      <div className="p-6 bg-white max-w-3xl mx-auto">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Request Subject Certification</h1>
          <Link href="/tutor/dashboard" className="text-blue-600 hover:underline">← Back to dashboard</Link>
        </div>
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium">Subject</label>
              <select className="mt-1 border rounded px-3 py-2 w-full" value={subjectName} onChange={e=>setSubjectName(e.target.value)} required>
                <option value="">Select...</option>
                {subjectOptions.map(s => (<option key={s} value={s}>{s}</option>))}
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
          {subjectType === 'IB' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium">IB Level</label>
                <select className="mt-1 border rounded px-3 py-2 w-full" value={ibLevel} onChange={e=>setIbLevel(e.target.value)} required>
                  <option value="">Select...</option>
                  {['SL','HL'].map(l => (<option key={l} value={l}>{l}</option>))}
                </select>
                <p className="mt-1 text-xs text-gray-500">Appended to subject name (e.g., "Math HL").</p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium">Your mark in this subject</label>
            <input className="mt-1 border rounded px-3 py-2 w-full" value={tutorMark} onChange={e=>setTutorMark(e.target.value)} placeholder="e.g., 97%, A+, 7 (IB)" />
          </div>

          {error && <div className="text-red-600 text-sm">{error}</div>}
          <div className="flex gap-3">
            <button disabled={submitting} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50">
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
            <Link href="/tutor/dashboard" className="px-4 py-2 border rounded text-gray-700">Cancel</Link>
          </div>
        </form>
      </div>
    </TutorLayout>
  );
}


