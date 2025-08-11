"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers';
import api from '@/services/api';
import { TuteeLayout } from '@/components/tutee-layout';

export default function TuteeRequestPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [subjects, setSubjects] = useState<any[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [sessionsPerWeek, setSessionsPerWeek] = useState(1);
  const [availability, setAvailability] = useState<any>({});
  const [dayEnabled, setDayEnabled] = useState<Record<string, boolean>>({
    Mon: false, Tue: false, Wed: false, Thu: false, Fri: false, Sat: false, Sun: false
  });
  const [dayRanges, setDayRanges] = useState<Record<string, Array<{ start: string; end: string }>>({
    Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [], Sun: []
  });
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
      // Build availability JSON from UI ranges
      const built: Record<string, string[]> = {};
      Object.entries(dayRanges).forEach(([day, ranges]) => {
        if (dayEnabled[day] && ranges.length > 0) {
          const items = ranges
            .filter(r => r.start && r.end)
            .map(r => `${r.start}-${r.end}`);
          if (items.length) built[day] = items;
        }
      });
      const finalAvailability = Object.keys(built).length ? built : availability;
      await api.createTuteeOpportunity({
        subject_id: subjectId,
        grade_level: gradeLevel,
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
            <label className="block text-sm font-medium mb-2">Availability</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((day) => (
                <div key={day} className="border rounded p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{day}</div>
                    <label className="flex items-center space-x-2 text-sm">
                      <input
                        type="checkbox"
                        checked={dayEnabled[day]}
                        onChange={(e) => setDayEnabled(prev => ({ ...prev, [day]: e.target.checked }))}
                      />
                      <span>Available</span>
                    </label>
                  </div>
                  {dayEnabled[day] && (
                    <div className="mt-3 space-y-2">
                      {(dayRanges[day] || []).map((range, idx) => (
                        <div key={idx} className="flex items-center space-x-2">
                          <input
                            type="time"
                            className="border rounded px-2 py-1 flex-1"
                            value={range.start}
                            onChange={(e) => {
                              setDayRanges(prev => {
                                const next = { ...prev };
                                const copy = [...(next[day] || [])];
                                copy[idx] = { ...copy[idx], start: e.target.value };
                                next[day] = copy;
                                return next;
                              })
                            }}
                          />
                          <span className="text-gray-500">to</span>
                          <input
                            type="time"
                            className="border rounded px-2 py-1 flex-1"
                            value={range.end}
                            onChange={(e) => {
                              setDayRanges(prev => {
                                const next = { ...prev };
                                const copy = [...(next[day] || [])];
                                copy[idx] = { ...copy[idx], end: e.target.value };
                                next[day] = copy;
                                return next;
                              })
                            }}
                          />
                          <button
                            type="button"
                            className="text-red-600 text-sm"
                            onClick={() => setDayRanges(prev => {
                              const next = { ...prev };
                              const copy = [...(next[day] || [])];
                              copy.splice(idx, 1);
                              next[day] = copy;
                              return next;
                            })}
                          >Remove</button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="text-blue-600 text-sm"
                        onClick={() => setDayRanges(prev => ({ ...prev, [day]: [ ...(prev[day] || []), { start: '', end: '' } ] }))}
                      >+ Add time range</button>
                    </div>
                  )}
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


