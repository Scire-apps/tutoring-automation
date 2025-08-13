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
  const SUBJECT_NAMES = ['Math', 'English', 'Science'];
  const SUBJECT_TYPES = ['Academic', 'ALP', 'IB'];
  const SUBJECT_GRADES = ['9', '10', '11', '12'];
  const [subjectName, setSubjectName] = useState('');
  const [subjectType, setSubjectType] = useState('');
  const [subjectGrade, setSubjectGrade] = useState('');
  const [sessionsPerWeek, setSessionsPerWeek] = useState(1);
  const [availabilities, setAvailabilities] = useState<WeeklySelection[]>([{},{},{}].slice(0,1));
  const [locationPreference, setLocationPreference] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.push('/auth/login');
      return;
    }
    // No subjects API; choices are hardcoded as per new spec
  }, [isLoading, user, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // Merge all session availabilities into a single weekly map for storage
      const merged: { [key: string]: Set<string> } = {} as any;
      for (const sel of availabilities.slice(0, sessionsPerWeek)) {
        const m = compressSelectionToWeeklyMap(sel);
        Object.entries(m).forEach(([day, ranges]) => {
          if (!merged[day]) merged[day] = new Set();
          ranges.forEach(r => merged[day].add(r));
        });
      }
      const finalAvailability: { [key: string]: string[] } = {};
      Object.entries(merged).forEach(([day, set]) => {
        finalAvailability[day] = Array.from(set);
      });
      await api.createTuteeOpportunity({
        subject_name: subjectName,
        subject_type: subjectType,
        subject_grade: subjectGrade,
        sessions_per_week: sessionsPerWeek,
        availability: finalAvailability,
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
              {SUBJECT_NAMES.map(s => (<option key={s} value={s}>{s}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Type</label>
            <select className="mt-1 border rounded px-3 py-2 w-full" value={subjectType} onChange={e=>setSubjectType(e.target.value)} required>
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
        <div>
          <label className="block text-sm font-medium">Sessions per Week</label>
          <select className="mt-1 border rounded px-3 py-2 w-full" value={sessionsPerWeek} onChange={e=>{
            const n = Number(e.target.value); setSessionsPerWeek(n);
            setAvailabilities(prev => {
              const next = prev.slice(0, n);
              while (next.length < n) next.push({});
              return next;
            });
          }}>
            {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
          <div>
          <label className="block text-sm font-medium mb-2">Availability</label>
          <div className="space-y-6">
            {Array.from({ length: sessionsPerWeek }).map((_, idx) => (
              <div key={idx} className="border rounded p-3">
                <div className="mb-2 text-sm font-medium text-gray-700">Session {idx+1} availability</div>
                <WeeklyTimeGrid
                  value={(availabilities[idx] || {}) as WeeklySelection}
                  onChange={(next) => setAvailabilities(prev => {
                    const arr = prev.slice();
                    arr[idx] = next;
                    return arr;
                  })}
                />
              </div>
            ))}
          </div>
          </div>
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


