"use client";
import Link from 'next/link';
import { useEffect } from 'react';
import { supabase } from '@/services/supabase';
import api from '@/services/api';
import type { RequestInit } from 'next/dist/server/web/spec-extension/request';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      // Determine role and redirect from homepage
      try {
        // Reuse backend API wrapper via fetch with token - using apiRequest here requires auth header; we call through api module indirectly by hardcoding endpoint
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/role`, { headers: {} as any } as RequestInit);
        const roleResp = await res.json();
        if (roleResp.role === 'superadmin') return router.replace('/admin/dashboard');
        if (roleResp.role === 'admin') return router.replace('/admin/school/dashboard');
        if (roleResp.role === 'tutor') return router.replace('/dashboard');
        if (roleResp.role === 'tutee') return router.replace('/tutee/dashboard');
      } catch {}
    })();
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl w-full">
        <div className="bg-white shadow rounded-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 text-center">Welcome to the Tutoring Platform</h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            Join as a tutor or request help as a tutee. Get matched, schedule sessions, and track progress.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Link
              href="/auth/register?t=mentor"
              className="group rounded-lg border border-gray-200 px-6 py-5 hover:bg-gray-50 transition"
            >
              <h2 className="text-xl font-semibold text-gray-900">Sign up as Tutor</h2>
              <p className="mt-1 text-sm text-gray-600">Browse opportunities and start tutoring.</p>
            </Link>
            <Link
              href="/auth/register?t=mentee"
              className="group rounded-lg border border-gray-200 px-6 py-5 hover:bg-gray-50 transition"
            >
              <h2 className="text-xl font-semibold text-gray-900">Sign up as Tutee</h2>
              <p className="mt-1 text-sm text-gray-600">Request help for subjects and schedule sessions.</p>
            </Link>
          </div>
          <div className="mt-6 text-center">
            <Link href="/auth/login" className="text-blue-600 hover:text-blue-500">Already have an account? Log in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}