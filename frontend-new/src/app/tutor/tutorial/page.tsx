// @ts-nocheck

"use client";

import Link from "next/link";
import Image from "next/image";
import { TutorLayout } from "@/components/tutor-layout";

export default function TutorTutorialPage() {
  const steps = [
    
    {
      title: "Request subject certification",
      desc:
        "From your dashboard, open Request Certification to submit the subjects you can tutor (Academic, ALP, or IB with grade). Admins approve these.",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v12m6-6H6" />
        </svg>
      ),
    },
    {
      title: "Browse and accept opportunities",
      desc:
        "Visit Opportunities to view open requests that match your approvals. Accepting creates a job and notifies the student to set availability.",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      ),
    },
    {
      title: "Schedule the session",
      desc:
        "When the tutee sets availability, your job shows ‘Waiting for Tutor’. Pick a time within the provided ranges and confirm the schedule.",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3M4 11h16M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      title: "Run the session and upload recording link",
      desc:
        "After the session, upload a recording link from your job card. This is required before you can mark the job as completed.",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M4 6h8a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z" />
        </svg>
      ),
    },
    {
      title: "Complete and await verification",
      desc:
        "Mark the job as completed. Admins verify and award volunteer hours. Your hours accumulate on your dashboard.",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7 20h10a2 2 0 002-2V6" />
        </svg>
      ),
    },
  ];

  const tips = [
    {
      title: "Pick precise times",
      desc: "Choose a time fully inside the tutee's availability and match their requested duration.",
    },
    {
      title: "Be professional",
      desc: "Arrive on time, be prepared, and keep communication respectful and clear.",
    },
  ];

  return (
    <TutorLayout>
      <div className="min-h-full bg-white">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none" aria-hidden>
            <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full blur-3xl" style={{ backgroundColor: "#DBF9F5", opacity: 0.6 }} />
            <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full blur-3xl" style={{ backgroundColor: "#C9ECFF", opacity: 0.6 }} />
          </div>
          <div className="max-w-7xl mx-auto px-6 pt-10 pb-6 relative">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Image src="/active_jobs.svg" alt="Icon" width={24} height={24} />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Tutor Guide</h1>
            </div>
            <p className="text-gray-600 max-w-3xl">
              A concise, end-to-end walkthrough of how to succeed on the platform—from certification to
              verified volunteer hours.
            </p>
            {/* Session Scheduling Note */}
            <div className="mt-6 mb-2">
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" strokeWidth="2" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h8M12 8v8" />
                </svg>
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 w-full">
                  <span className="font-semibold text-blue-700">Important:</span>{" "}
                  Tutoring requests now schedule <span className="font-semibold">one session at a time</span>. 
                  Each time a tutee wants a session, they simply submit a new request—only that session will be scheduled. This makes it easier to coordinate and confirm each meeting individually.
                </div>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/tutor/dashboard" className="inline-flex items-center px-4 py-2 rounded-full text-blue-700 bg-blue-100 hover:bg-blue-200">
                ← Back to Dashboard
              </Link>
            </div>
          </div>
        </section>

        {/* Steps timeline */}
        <section className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid lg:grid-cols-2 gap-6">
            {steps.map((s, i) => (
              <div key={i} className="group relative border-2 border-gray-100 rounded-xl bg-white p-5 hover:border-blue-200 transition">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-50 text-blue-600">
                    {s.icon}
                  </div>
                  <div>
                    <h3 className="text-gray-900 font-semibold">{i + 1}. {s.title}</h3>
                    <p className="mt-1 text-sm text-gray-600 leading-6">{s.desc}</p>
                  </div>
                </div>
                <div className="absolute -z-10 inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition" style={{ boxShadow: "0 10px 30px rgba(59,130,246,0.08)" }} />
              </div>
            ))}
          </div>
        </section>

        {/* Quick tips */}
        <section className="max-w-7xl mx-auto px-6 pb-12">
          <div className="bg-white border-2 border-gray-100 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick tips</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {tips.map((t, i) => (
                <div key={i} className="rounded-lg border border-gray-100 p-4 bg-gradient-to-br from-white to-gray-50">
                  <div className="text-gray-900 font-medium">{t.title}</div>
                  <p className="text-sm text-gray-600 mt-1">{t.desc}</p>
                </div>
              ))}
            </div>
            <div className="mt-6">
              <Link href="/tutor/dashboard" className="inline-flex items-center px-4 py-2 rounded-md text-white bg-blue-600 hover:bg-blue-700">
                Go to my dashboard
              </Link>
            </div>
          </div>
        </section>
      </div>
    </TutorLayout>
  );
}

