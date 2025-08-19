'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/services/supabase';

export default function RegisterTuteePage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // new fields
  const currentYear = new Date().getFullYear();
  const gradYears = [0,1,2,3,4].map(off => String(currentYear + off));
  const [graduationYear, setGraduationYear] = useState<string>('');
  const [pronouns, setPronouns] = useState<string>('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [allSubjects, setAllSubjects] = useState<string[]>([]);

  const addSubject = () => {
    if (subjects.length >= 10) return;
    setSubjects([...subjects, '']);
  };
  const updateSubject = (idx: number, value: string) => {
    const next = subjects.slice();
    next[idx] = value;
    setSubjects(next);
  };
  const removeSubject = (idx: number) => {
    const next = subjects.slice();
    next.splice(idx,1);
    setSubjects(next);
  };

  // load master subjects from backend admin subjects endpoint (reads subjects.txt)
  useEffect(() => {
    (async () => {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL as string;
        const { data: { session } } = await supabase.auth.getSession();
        const resp = await fetch(`${apiBase}/api/admin/subjects`, { headers: { Authorization: `Bearer ${session?.access_token ?? ''}` }});
        const j = await resp.json();
        const names = (j.subjects || []).map((s:any) => s.name).filter(Boolean);
        setAllSubjects(names);
      } catch {}
    })();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { first_name: firstName, last_name: lastName, account_type: 'tutee' } },
      });
      if (error) throw error;
      // Persist signup intent and tutee profile extras for first-login ensure
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('signup_account_type', 'tutee');
          localStorage.setItem('signup_first_name', firstName);
          localStorage.setItem('signup_last_name', lastName);
          localStorage.setItem('tutee_graduation_year', graduationYear || '');
          localStorage.setItem('tutee_pronouns', pronouns || '');
          localStorage.setItem('tutee_subjects', JSON.stringify(subjects.filter(Boolean)));
        }
      } catch {}
      // do not create tutee row until after verification and first login (unchanged behavior)
      setDone(true);
    } catch (e: any) {
      setError(e?.message || 'Failed to register');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div>
          <h1 className="text-2xl font-bold">Check your email</h1>
          <p className="text-gray-600 mt-2">Verify your email to continue, then log in.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <form onSubmit={submit} className="w-full max-w-md space-y-3">
        <h1 className="text-2xl font-bold">Sign up as Tutee</h1>
        <input className="w-full border rounded px-3 py-2" placeholder="First name" value={firstName} onChange={e=>setFirstName(e.target.value)} required />
        <input className="w-full border rounded px-3 py-2" placeholder="Last name" value={lastName} onChange={e=>setLastName(e.target.value)} required />
        <input type="email" className="w-full border rounded px-3 py-2" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required />
        <input type="password" className="w-full border rounded px-3 py-2" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required />

        {/* Graduation Year */}
        <div>
          <label className="block text-sm font-medium mb-1">Graduation Year</label>
          <select className="w-full border rounded px-3 py-2" value={graduationYear} onChange={e=>setGraduationYear(e.target.value)} required>
            <option value="">Select...</option>
            {gradYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* Pronouns */}
        <div>
          <label className="block text-sm font-medium mb-1">Pronouns</label>
          <select className="w-full border rounded px-3 py-2" value={pronouns} onChange={e=>setPronouns(e.target.value)} required>
            <option value="">Select...</option>
            {['He/Him','She/Her','They/Them'].map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {/* Subjects */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium">Subjects (up to 10)</label>
            <button type="button" onClick={addSubject} disabled={subjects.length>=10} className="text-blue-600 text-sm">Add course</button>
          </div>
          <div className="space-y-2">
            {subjects.map((s, idx) => (
              <div key={idx} className="flex gap-2">
                <select className="flex-1 border rounded px-3 py-2" value={s} onChange={e=>updateSubject(idx, e.target.value)}>
                  <option value="">Select...</option>
                  {allSubjects.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <button type="button" onClick={()=>removeSubject(idx)} className="px-3 py-2 border rounded">Remove</button>
              </div>
            ))}
          </div>
        </div>
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <button disabled={loading} className="w-full bg-blue-600 text-white rounded px-3 py-2">{loading?'Signing up...':'Sign up'}</button>
      </form>
    </div>
  );
}


