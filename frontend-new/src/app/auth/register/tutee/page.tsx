'use client';
import { useState } from 'react';
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { first_name: firstName, last_name: lastName } },
      });
      if (error) throw error;
      // do not create tutee row until after verification and first login; alternatively, we can create immediately
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
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <button disabled={loading} className="w-full bg-blue-600 text-white rounded px-3 py-2">{loading?'Signing up...':'Sign up'}</button>
      </form>
    </div>
  );
}


