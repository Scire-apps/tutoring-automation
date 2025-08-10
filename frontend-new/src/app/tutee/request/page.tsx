"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers';
import api from '@/services/api';

export default function TuteeRequestPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [subjects, setSubjects] = useState<any[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [sessionsPerWeek, setSessionsPerWeek] = useState(1);
  const [availability, setAvailability] = useState<any>({});
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
    (async () => {
      try {
        const resp = await api.listSubjects();
        setSubjects(resp.subjects || []);
      } catch {
        setSubjects([]);
      }
    })();
  }, [isLoading, user, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.createTuteeOpportunity({
        subject_id: subjectId,
        grade_level: gradeLevel,
        sessions_per_week: sessionsPerWeek,
        availability,
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
    <div className="min-h-screen bg-white p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold">Request Tutoring</h1>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium">Subject</label>
          <select className="mt-1 border rounded px-3 py-2 w-full" value={subjectId} onChange={e=>setSubjectId(e.target.value)} required>
            <option value="">Select subject...</option>
            {subjects.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Grade Level</label>
          <input className="mt-1 border rounded px-3 py-2 w-full" value={gradeLevel} onChange={e=>setGradeLevel(e.target.value)} placeholder="e.g. Grade 11" />
        </div>
        <div>
          <label className="block text-sm font-medium">Sessions per Week</label>
          <input type="number" min={1} max={7} className="mt-1 border rounded px-3 py-2 w-full" value={sessionsPerWeek} onChange={e=>setSessionsPerWeek(Number(e.target.value))} required />
        </div>
        <div>
          <label className="block text-sm font-medium">Availability (JSON)</label>
          <textarea className="mt-1 border rounded px-3 py-2 w-full" rows={4} value={JSON.stringify(availability)} onChange={e=>{
            try { setAvailability(JSON.parse(e.target.value || '{}')); } catch {}
          }} />
          <p className="text-xs text-gray-500 mt-1">Example: {{"Mon":["16:00-17:00"],"Wed":["18:00-19:00"]}}</p>
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
  );
}


