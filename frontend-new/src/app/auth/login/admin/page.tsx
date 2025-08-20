// @ts-nocheck

"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/services/supabase';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // verify admin role via backend
      const token = data.session?.access_token;
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/role`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.role === 'admin') router.replace('/admin/dashboard');
      else if (json.role === 'admin') router.replace('/admin/school/dashboard');
      else setError('This account is not an administrator');
    } catch (e: any) {
      setError(e?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <form onSubmit={submit} className="w-full max-w-md space-y-3">
        <h1 className="text-2xl font-bold">Admin Login</h1>
        <input className="w-full border rounded px-3 py-2" type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required />
        <input className="w-full border rounded px-3 py-2" type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required />
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <button disabled={loading} className="w-full bg-blue-600 text-white rounded px-3 py-2">{loading?'Signing in...':'Sign in'}</button>
      </form>
    </div>
  );
}


