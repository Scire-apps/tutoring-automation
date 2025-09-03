"use client";
import Link from 'next/link';
import Image from 'next/image';

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-white">
      {/* Animated gradient background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 -left-32 w-[40rem] h-[40rem] rounded-full bg-gradient-to-tr from-blue-200 via-indigo-200 to-purple-200 blur-3xl opacity-70 animate-pulse" />
        <div className="absolute -bottom-32 -right-32 w-[40rem] h-[40rem] rounded-full bg-gradient-to-tr from-indigo-200 via-purple-200 to-pink-200 blur-3xl opacity-70 animate-pulse" />
      </div>

      {/* Subtle grid */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-40" />

      {/* Header */}
      <header className="relative z-10">
        <div className="mx-auto max-w-7xl px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Tutoring Logo" width={40} height={40} className="rounded-md shadow" />
            <span className="text-xl font-bold tracking-tight text-gray-900">WOSS Tutoring</span>
          </div>
          <nav className="hidden sm:flex items-center gap-6 text-sm text-gray-600">
            <a href="#features" className="hover:text-gray-900 transition-colors">Features</a>
            <a href="#how" className="hover:text-gray-900 transition-colors">How it works</a>
            <Link href="/auth/login" className="text-blue-600 hover:text-blue-700 font-medium">Log in</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-10">
        <section className="mx-auto max-w-7xl px-6 pt-10 pb-8 grid grid-cols-1 place-items-center gap-10">
          <div className="order-2 lg:order-1 flex flex-col items-center text-center w-full max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 text-blue-700 px-3 py-1 text-xs font-semibold ring-1 ring-inset ring-blue-200">
              Proven at WOSS • Fast • Secure
            </div>
            <h1 className="mt-4 text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900">
              Match. Learn. Excel.
            </h1>
            <p className="mt-4 text-gray-600 leading-7">
              Join as a tutor or request help as a tutee. Get matched, schedule sessions, and track progress — all in one place.
            </p>

            {/* CTA Cards */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 justify-items-center">
              <Link href="/auth/register/tutor" className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 p-0.5 shadow-lg transition-transform hover:scale-[1.01] focus:outline-none">
                <div className="relative h-full w-full rounded-[1rem] bg-white p-5">
                  <div className="absolute -inset-20 bg-gradient-to-r from-blue-400/20 via-indigo-400/20 to-purple-400/20 blur-3xl group-hover:opacity-100 opacity-0 transition-opacity" />
                  <div className="relative flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-inner">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6"><path d="M12 14.5c2.485 0 4.5-2.015 4.5-4.5S14.485 5.5 12 5.5 7.5 7.515 7.5 10s2.015 4.5 4.5 4.5z"/><path fillRule="evenodd" d="M4.5 19.5a7.5 7.5 0 1115 0V21a.75.75 0 01-.75.75h-13.5A.75.75 0 014.5 21v-1.5z" clipRule="evenodd"/></svg>
                    </div>
                    <div className="flex-1">
                      <h2 className="text-lg font-semibold text-gray-900">Sign up as Tutor</h2>
                      <p className="mt-1 text-sm text-gray-600">Browse opportunities and start tutoring.</p>
                    </div>
                  </div>
                </div>
              </Link>

              <Link href="/auth/register/tutee" className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 p-0.5 shadow-lg transition-transform hover:scale-[1.01] focus:outline-none">
                <div className="relative h-full w-full rounded-[1rem] bg-white p-5">
                  <div className="absolute -inset-20 bg-gradient-to-r from-purple-400/20 via-pink-400/20 to-red-400/20 blur-3xl group-hover:opacity-100 opacity-0 transition-opacity" />
                  <div className="relative flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-pink-50 text-pink-600 flex items-center justify-center shadow-inner">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6"><path d="M11.7 2.3a1 1 0 0 1 1.6 0l8 10a1 1 0 0 1-.8 1.7H3.5a1 1 0 0 1-.8-1.7l8-10z"/><path d="M12 14a5 5 0 0 0-5 5v1h10v-1a5 5 0 0 0-5-5z"/></svg>
                    </div>
                    <div className="flex-1">
                      <h2 className="text-lg font-semibold text-gray-900">Sign up as Tutee</h2>
                      <p className="mt-1 text-sm text-gray-600">Request help for subjects and schedule sessions.</p>
                    </div>
                  </div>
                </div>
              </Link>
            </div>

            {/* Note about @hdsb.ca */}
            <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-sm text-blue-800">
              <p className="font-semibold">Use your @hdsb.ca email</p>
              <p className="mt-1">You can create two separate accounts with the same school email — one as a Tutor and one as a Tutee. Just sign up for each role using your @hdsb.ca address.</p>
            </div>

            {/* Secondary link */}
            <div className="mt-5">
              <Link href="/auth/login" className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium group">
                Already have an account? Log in
                <svg className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l5 5a1 1 0 010 1.414l-5 5a1 1 0 11-1.414-1.414L13.586 11H4a1 1 0 110-2h9.586l-3.293-3.293a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
              </Link>
            </div>
          </div>

          {/* Hero visual removed per request */}
        </section>

        {/* Secondary sections */}
        <section id="features" className="mx-auto max-w-7xl px-6 py-10">
          <h2 className="text-2xl font-bold text-gray-900">Why WOSS Tutoring?</h2>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { title: 'Fast matching', desc: 'Smart filters and approvals to match students with the right tutors quickly.' },
              { title: 'Seamless scheduling', desc: 'Share availability, confirm times, and stay on top of sessions.' },
              { title: 'Track progress', desc: 'Admins verify sessions and award hours. Students get consistent support.' },
            ].map((f) => (
              <div key={f.title} className="group rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition hover:shadow-md">
                <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-inner">
                  <span>✨</span>
                </div>
                <h3 className="mt-3 text-lg font-semibold text-gray-900">{f.title}</h3>
                <p className="mt-1 text-sm text-gray-600">{f.desc}</p>
                <div className="mt-3 h-1 w-0 group-hover:w-16 transition-all bg-blue-200 rounded-full" />
              </div>
            ))}
          </div>
        </section>

        <section id="how" className="mx-auto max-w-7xl px-6 pb-14">
          <h2 className="text-2xl font-bold text-gray-900">How it works</h2>
          <ol className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            {[ 'Sign up', 'Get matched', 'Schedule & learn' ].map((s, i) => (
              <li key={s} className="relative rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <div className="absolute -top-3 -left-3 h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold shadow">{i+1}</div>
                <h3 className="ml-6 text-lg font-semibold text-gray-900">{s}</h3>
                <p className="mt-2 ml-6 text-sm text-gray-600">{[
                  'Use your @hdsb.ca email and choose Tutor or Tutee to get started.',
                  'Admins validate tutor subjects. Students see eligible tutors and open requests.',
                  'Pick times that work, meet up, and track sessions effortlessly.',
                ][i]}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  );
}