"use client";
import Link from 'next/link';

export default function Home() {

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
              href="/auth/register/tutor"
              className="group rounded-lg border border-gray-200 px-6 py-5 hover:bg-gray-50 transition"
            >
              <h2 className="text-xl font-semibold text-gray-900">Sign up as Tutor</h2>
              <p className="mt-1 text-sm text-gray-600">Browse opportunities and start tutoring.</p>
            </Link>
            <Link
              href="/auth/register/tutee"
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