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
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <div className="max-w-3xl text-center">
        <h1 className="text-4xl font-bold tracking-tight">Welcome to the Tutoring Platform</h1>
        <p className="mt-4 text-muted-foreground">
          Join as a tutor or request help as a tutee. Get matched, schedule sessions, and track progress.
        </p>
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Link
            href="/auth/register?t=mentor"
            className="rounded-lg border bg-white px-6 py-5 text-left shadow-sm transition hover:shadow"
          >
            <h2 className="text-2xl font-semibold">Sign up as Tutor →</h2>
            <p className="mt-2 text-sm text-muted-foreground">Browse opportunities and start tutoring.</p>
          </Link>
          <Link
            href="/auth/register?t=mentee"
            className="rounded-lg border bg-white px-6 py-5 text-left shadow-sm transition hover:shadow"
          >
            <h2 className="text-2xl font-semibold">Sign up as Tutee →</h2>
            <p className="mt-2 text-sm text-muted-foreground">Request help for subjects and schedule sessions.</p>
          </Link>
        </div>
        <div className="mt-6">
          <Link href="/auth/login" className="text-primary underline">Already have an account? Log in</Link>
        </div>
      </div>
    </main>
  );
}