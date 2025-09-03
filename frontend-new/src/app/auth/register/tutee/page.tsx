// @ts-nocheck

"use client";

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/app/providers';

function TuteeRegisterForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [schools, setSchools] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailTaken, setEmailTaken] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSchools, setIsLoadingSchools] = useState(true);
  const [registrationComplete, setRegistrationComplete] = useState(false);

  // tutee extras
  const currentYear = new Date().getFullYear();
  const gradYears = [0,1,2,3,4].map(off => String(currentYear + off));
  const [graduationYear, setGraduationYear] = useState('');
  const [pronouns, setPronouns] = useState('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [allSubjects, setAllSubjects] = useState<string[]>([]);

  const router = useRouter();
  const { signUp } = useAuth();

  useEffect(() => {
    const fetchSchools = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/public/schools`);
        const json = res.ok ? await res.json() : { schools: [] };
        const data = json.schools || [];
        setSchools(data);
      } catch (err) {
        setSchools([]);
      } finally {
        setIsLoadingSchools(false);
      }
    };
    fetchSchools();
    (async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/public/subjects`);
        const j = await res.json();
        const names = (j.subjects || []).map((s: any) => s.name).filter(Boolean);
        setAllSubjects(names);
      } catch {}
    })();
  }, []);

  const isHdsbEmail = (addr: string) => /^[^@\s]+@hdsb\.ca$/i.test((addr || '').trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      if (!isHdsbEmail(email)) {
        setEmailError('Please use your @hdsb.ca email address.');
        setIsLoading(false);
        return;
      }
      // Persist extras for first-login ensure
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('signup_account_type', 'tutee');
          localStorage.setItem('signup_first_name', firstName || '');
          localStorage.setItem('signup_last_name', lastName || '');
          localStorage.setItem('signup_school_id', schoolId || '');
          localStorage.setItem('tutee_graduation_year', graduationYear || '');
          localStorage.setItem('tutee_pronouns', pronouns || '');
          localStorage.setItem('tutee_subjects', JSON.stringify(subjects.filter(Boolean)));
        }
      } catch {}
      const { error } = await signUp(email, password, firstName, lastName, schoolId, 'tutee');
      // After signup, if we already have a session (email confirmation disabled), proactively ensure with extras
      try {
        const { data: { session } } = await (await import('@/services/supabase')).supabase.auth.getSession();
        if (session?.access_token) {
          await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/account/ensure`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              account_type: 'tutee',
              first_name: firstName,
              last_name: lastName,
              school_id: schoolId,
              graduation_year: graduationYear ? Number(graduationYear) : undefined,
              pronouns,
              subjects: subjects.filter(Boolean),
            })
          });
        }
      } catch {}
      if (error) {
        const msg = String(error.message || '').toLowerCase();
        if (msg.includes('already') && (msg.includes('registered') || msg.includes('exists'))) {
          setEmailError('This email is already registered. Please sign in or reset your password.');
          setEmailTaken(true);
        } else {
          setError(error.message);
        }
        return;
      }
      setRegistrationComplete(true);
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (registrationComplete) {
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-white py-12 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-32 -left-32 w-[40rem] h-[40rem] rounded-full bg-gradient-to-tr from-blue-200 via-indigo-200 to-purple-200 blur-3xl opacity-70 animate-pulse" />
          <div className="absolute -bottom-32 -right-32 w-[40rem] h-[40rem] rounded-full bg-gradient-to-tr from-indigo-200 via-purple-200 to-pink-200 blur-3xl opacity-70 animate-pulse" />
        </div>
        <div className="max-w-md w-full space-y-8 bg-white/90 rounded-2xl shadow-xl ring-1 ring-gray-200 p-8 backdrop-blur">
          <div className="text-center">
            <svg className="mx-auto h-12 w-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Registration Successful!</h2>
            <div className="mt-4 text-md text-gray-600">
              <p className="mb-4"><strong>Please check your email to verify your account.</strong></p>
              <div className="mt-8 border-t pt-4">
                <p>Already verified? <Link href="/auth/login" className="font-medium text-blue-600 hover:text-blue-500">Sign in</Link></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-white py-12 px-4 sm:px-6 lg:px-8 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 -left-32 w-[40rem] h-[40rem] rounded-full bg-gradient-to-tr from-blue-200 via-indigo-200 to-purple-200 blur-3xl opacity-70 animate-pulse" />
        <div className="absolute -bottom-32 -right-32 w-[40rem] h-[40rem] rounded-full bg-gradient-to-tr from-indigo-200 via-purple-200 to-pink-200 blur-3xl opacity-70 animate-pulse" />
      </div>
      <div className="max-w-md w-full">
        <div className="relative rounded-2xl bg-white/90 backdrop-blur shadow-xl ring-1 ring-gray-200 p-6 sm:p-8">
        <div>
          <h2 className="mt-1 text-center text-3xl font-extrabold text-gray-900">Register as a tutee</h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Or{' '}<Link href="/auth/login" className="font-medium text-blue-600 hover:text-blue-500">sign in to your existing account</Link>
          </p>
        </div>
        <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md -space-y-px">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label htmlFor="first-name" className="sr-only">First Name</label>
                <input id="first-name" name="firstName" type="text" required className="appearance-none rounded-xl relative block w-full px-3 py-2 border border-gray-200 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 focus:z-10 sm:text-sm shadow-sm" placeholder="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div>
                <label htmlFor="last-name" className="sr-only">Last Name</label>
                <input id="last-name" name="lastName" type="text" required className="appearance-none rounded-xl relative block w-full px-3 py-2 border border-gray-200 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 focus:z-10 sm:text-sm shadow-sm" placeholder="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>

            <div className="mb-3">
              <label htmlFor="school" className="sr-only">School</label>
              <select id="school" name="school" required className="appearance-none rounded-xl relative block w-full px-3 py-2 border border-gray-200 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 focus:z-10 sm:text-sm shadow-sm" value={schoolId} onChange={(e) => setSchoolId(e.target.value)} disabled={isLoadingSchools}>
                <option value="">Select your school</option>
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>{school.name}</option>
                ))}
              </select>
            </div>

            <div className="mb-3">
              <label htmlFor="email-address" className="sr-only">Email address</label>
              {emailError && (
                <div className="text-red-600 text-sm mb-1">{emailError}</div>
              )}
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className={`appearance-none rounded-xl relative block w-full px-3 py-2 border ${emailError ? 'border-red-500' : 'border-gray-200'} placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 focus:z-10 sm:text-sm shadow-sm`}
                placeholder="Email address"
                value={email}
                onChange={(e) => {
                  const v = e.target.value;
                  setEmail(v);
                  if (v && !isHdsbEmail(v)) setEmailError('Please use your @hdsb.ca email address.');
                  else setEmailError(null);
                  if (emailTaken) setEmailTaken(false);
                }}
                aria-invalid={!!emailError}
              />
            </div>

            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <input id="password" name="password" type="password" autoComplete="new-password" required className="appearance-none rounded-xl relative block w-full px-3 py-2 border border-gray-200 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 focus:z-10 sm:text-sm shadow-sm" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} />
            </div>

            {/* Graduation Year */}
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">Graduation Year</label>
              <select className="w-full border border-gray-200 rounded-xl px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500" value={graduationYear} onChange={(e)=>setGraduationYear(e.target.value)} required>
                <option value="">Select...</option>
                {gradYears.map(y => (<option key={y} value={y}>{y}</option>))}
              </select>
            </div>

            {/* Pronouns */}
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">Pronouns</label>
              <select className="w-full border border-gray-200 rounded-xl px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500" value={pronouns} onChange={(e)=>setPronouns(e.target.value)} required>
                <option value="">Select...</option>
                {['He/Him','She/Her','They/Them'].map(p => (<option key={p} value={p}>{p}</option>))}
              </select>
            </div>

            {/* Subjects */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium">Subjects (up to 10)</label>
                <button type="button" disabled={subjects.length>=10 || subjects.some(s=>!s)} onClick={()=> subjects.length<10 && !subjects.some(s=>!s) && setSubjects([...subjects, ''])} className="text-blue-600 text-sm disabled:opacity-50 disabled:cursor-not-allowed">Add course</button>
              </div>
              <div className="space-y-2">
                {subjects.map((s, idx) => (
                  <div key={idx} className="flex gap-2">
                    <select className="flex-1 border border-gray-200 rounded-xl px-3 py-2 shadow-sm" value={s} onChange={(e)=>{
                      const next = subjects.slice(); next[idx] = e.target.value; setSubjects(next);
                    }}>
                      <option value="">Select...</option>
                      {allSubjects.map(n => (<option key={n} value={n}>{n}</option>))}
                    </select>
                    <button type="button" onClick={()=>{ const next = subjects.slice(); next.splice(idx,1); setSubjects(next); }} className="px-3 py-2 border border-gray-200 rounded-xl hover:bg-gray-50">Remove</button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {error && (<div className="text-red-500 text-sm mt-2">{error}</div>)}

          <div>
            <button type="submit" disabled={isLoading || isLoadingSchools || !!emailError || emailTaken || !isHdsbEmail(email)} className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-60 shadow-md">
              <span className="font-semibold tracking-wide">{isLoading ? 'Registering...' : 'Register'}</span>
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
}

export default function TuteeRegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <TuteeRegisterForm />
    </Suspense>
  );
}


