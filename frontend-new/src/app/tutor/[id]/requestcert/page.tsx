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
        // Use public subjects endpoint (reads subjects.txt) — no auth required
        const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/public/subjects`);
        if (resp.ok) {
          const j = await resp.json();
          const names = Array.isArray(j.subjects) ? j.subjects.map((s: any) => s?.name).filter(Boolean) : [];
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
      <div className="relative p-6 bg-white min-h-full overflow-hidden">
        <div className="pointer-events-none absolute -z-10 inset-0">
          <div className="absolute -top-24 -left-24 w-[32rem] h-[32rem] rounded-full bg-gradient-to-tr from-blue-200 via-indigo-200 to-purple-200 blur-3xl opacity-70 animate-pulse" />
          <div className="absolute -bottom-24 -right-24 w-[32rem] h-[32rem] rounded-full bg-gradient-to-tr from-indigo-200 via-purple-200 to-pink-200 blur-3xl opacity-70 animate-pulse" />
        </div>

        <div className="max-w-3xl mx-auto">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">Request Subject Certification</h1>
            <Link href="/tutor/dashboard" className="text-blue-600 hover:text-blue-700">← Back</Link>
          </div>
          <form onSubmit={onSubmit} className="space-y-6 relative">
            <div className="absolute -inset-2 rounded-3xl bg-gradient-to-tr from-blue-400 via-indigo-400 to-purple-400 opacity-20 blur-2xl" />
            <div className="relative rounded-2xl bg-white/80 backdrop-blur shadow-xl ring-1 ring-gray-200 p-5 sm:p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium">Subject</label>
              <select className="mt-1 border border-gray-200 rounded-xl px-3 py-2 w-full shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500" value={subjectName} onChange={e=>setSubjectName(e.target.value)} required>
                <option value="">Select...</option>
                {subjectOptions.map(s => (<option key={s} value={s}>{s}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium">Type</label>
              <select className="mt-1 border border-gray-200 rounded-xl px-3 py-2 w-full shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500" value={subjectType} onChange={e=>{ setSubjectType(e.target.value); if (e.target.value !== 'IB') setIbLevel(''); }} required>
                <option value="">Select...</option>
                {SUBJECT_TYPES.map(s => (<option key={s} value={s}>{s}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium">Grade</label>
              <select className="mt-1 border border-gray-200 rounded-xl px-3 py-2 w-full shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500" value={subjectGrade} onChange={e=>setSubjectGrade(e.target.value)} required>
                <option value="">Select...</option>
                {SUBJECT_GRADES.map(s => (<option key={s} value={s}>{s}</option>))}
              </select>
            </div>
          </div>
          {subjectType === 'IB' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium">IB Level</label>
                <select className="mt-1 border border-gray-200 rounded-xl px-3 py-2 w-full shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500" value={ibLevel} onChange={e=>setIbLevel(e.target.value)} required>
                  <option value="">Select...</option>
                  {['SL','HL'].map(l => (<option key={l} value={l}>{l}</option>))}
                </select>
                <p className="mt-1 text-xs text-gray-500">Appended to subject name (e.g., "Math HL").</p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium">Your mark in this subject</label>
            <input className="mt-1 border border-gray-200 rounded-xl px-3 py-2 w-full shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500" value={tutorMark} onChange={e=>setTutorMark(e.target.value)} placeholder="e.g., 97%, A+, 7 (IB)" />
          </div>

          {error && <div className="text-red-600 text-sm">{error}</div>}
          <div className="flex gap-3">
            <button disabled={submitting} className="group relative overflow-hidden px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-md transition hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500/60 disabled:opacity-60">
              <span className="relative z-10 font-semibold tracking-wide">{submitting ? 'Submitting...' : 'Submit Request'}</span>
              <span className="pointer-events-none absolute -inset-px rounded-[inherit] bg-gradient-to-r from-blue-400/40 via-indigo-400/30 to-purple-400/40 blur opacity-60 group-hover:opacity-90" />
            </button>
            <Link href="/tutor/dashboard" className="px-4 py-2 border border-gray-200 rounded-xl text-gray-700">Cancel</Link>
          </div>
            </div>
          </form>
        </div>
      </div>
    </TutorLayout>
  );
}


