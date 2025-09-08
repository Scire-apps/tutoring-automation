// @ts-nocheck

"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/providers";
import api from "@/services/api";
import Link from "next/link";
import { TuteeLayout } from "@/components/tutee-layout";
import { SubjectIcon } from "@/components/subject-icon";

export default function TuteeDashboardPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());
  const [editingSubjects, setEditingSubjects] = useState(false);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [allSubjects, setAllSubjects] = useState<string[]>([]);
  const [savingSubjects, setSavingSubjects] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [helpUrgency, setHelpUrgency] = useState<'urgent'|'non-urgent'>('non-urgent');
  const [helpDescription, setHelpDescription] = useState<string>("");
  const [helpSubmitting, setHelpSubmitting] = useState<boolean>(false);

  // Helper function to check if there are sessions waiting for availability
  const hasPendingAvailability = () => {
    return data?.jobs?.filter((j: any) => j.status === 'pending_tutee_scheduling').length > 0;
  };

  // On-demand job details enrichment
  const loadJobDetails = async (jobId: string) => {
    try {
      const details = await api.getTuteeJobDetails(jobId);
      if (details?.job) {
        setData((prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            jobs: (prev.jobs || []).map((j: any) =>
              j.id === jobId ? { ...j, ...details.job } : j
            ),
          };
        });
      }
    } catch (e) {
      // ignore enrichment errors
    }
  };

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.push("/auth/login");
      return;
    }
    (async () => {
      try {
        const d = await api.getTuteeDashboard();
        setData(d);
        // preload subjects
        try {
          const apiBase = process.env.NEXT_PUBLIC_API_URL as string;
          const {
            data: { session },
          } = await (
            await import("@/services/supabase")
          ).supabase.auth.getSession();
          const resp = await fetch(`${apiBase}/api/tutee/subjects`, {
            headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
          });
          const j = await resp.json();
          setSubjects(Array.isArray(j.subjects) ? j.subjects : []);
          setAllSubjects(Array.isArray(j.all_subjects) ? j.all_subjects : []);
        } catch {}
      } catch (e: any) {
        setError(e?.message || "Failed to load");
      }
    })();
  }, [isLoading, user, router]);

  if (isLoading || !data) {
    return (
      <TuteeLayout>
        <div className="min-h-full flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-gray-800">Loading your dashboard...</p>
          </div>
        </div>
      </TuteeLayout>
    );
  }

  return (
    <TuteeLayout>
      
      <div className="relative p-6 bg-white min-h-full overflow-hidden">
        <div className="pointer-events-none absolute -z-10 inset-0">
          <div className="absolute -top-24 -left-24 w-[32rem] h-[32rem] rounded-full bg-gradient-to-tr from-blue-200 via-indigo-200 to-purple-200 blur-3xl opacity-70 animate-pulse" />
          <div className="absolute -bottom-24 -right-24 w-[32rem] h-[32rem] rounded-full bg-gradient-to-tr from-indigo-200 via-purple-200 to-pink-200 blur-3xl opacity-70 animate-pulse" />
        </div>
        {/* Stats cards */}
         {/* Welcome section */}
         <div className="mb-8">
          <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 mb-2">
            Welcome back!
          </h2>
          <p className="text-gray-600">
            Review your requests and upcoming sessions.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white overflow-hidden border-2 border-gray-100 rounded-lg shadow-sm hover:shadow-md transition-shadow">
            <div className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="flex-shrink-0 mr-4">
                    <img 
                      src="/total_requests.svg" 
                      alt="Total Requests" 
                      className="w-10 h-10"
                    />
                  </div>
                  <div>
                    <h3 className="text-md font-semibold text-gray-900">
                      Total Requests
                    </h3>
                    <p className="text-xs text-gray-500">
                      All tutoring requests made
                    </p>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#FFD9FE' }}>
                    <span className="text-2xl font-medium text-gray-900">
                      {data.opportunities?.length || 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white overflow-hidden border-2 border-gray-100 rounded-lg shadow-sm hover:shadow-md transition-shadow">
            <div className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="flex-shrink-0 mr-4">
                    <img 
                      src="/open_requests.svg" 
                      alt="Open Requests" 
                      className="w-10 h-10"
                    />
                  </div>
                  <div>
                    <h3 className="text-md font-semibold text-gray-900">
                      Open Requests
                    </h3>
                    <p className="text-xs text-gray-500">
                      Requests awaiting tutors
                    </p>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#C9ECFF' }}>
                    <span className="text-2xl font-medium text-gray-900">
                      {
                        (data.opportunities || []).filter(
                          (o: any) => o.status === "open"
                        ).length
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white overflow-hidden border-2 border-gray-100 rounded-lg shadow-sm hover:shadow-md transition-shadow">
            <div className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="flex-shrink-0 mr-4">
                    <img 
                      src="/scheduled_sessions.svg" 
                      alt="Scheduled Sessions" 
                      className="w-10 h-10"
                    />
                  </div>
                  <div>
                    <h3 className="text-md font-semibold text-gray-900">
                      Scheduled Sessions
                    </h3>
                    <p className="text-xs text-gray-500">
                      Confirmed tutoring sessions
                    </p>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#DBF9F5' }}>
                    <span className="text-2xl font-medium text-gray-900">
                      {
                        (data.jobs || []).filter(
                          (j: any) => j.status === "scheduled"
                        ).length
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Quick actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Edit My Subjects Card */}
            <button
              onClick={() => setEditingSubjects(true)}
              className="flex items-center p-6 bg-white border-2 border-blue-100 rounded-xl hover:border-blue-200 hover:bg-blue-50 transition-colors group shadow-sm hover:shadow-md"
            >
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
              </div>
              <div className="ml-4 text-left">
                <h4 className="text-lg font-medium text-gray-900 group-hover:text-blue-900">Edit My Subjects</h4>
                <p className="text-sm text-gray-500 group-hover:text-blue-700">Manage your subject preferences</p>
              </div>
            </button>

            {/* Request Tutoring Card */}
            <Link
              href="/tutee/request"
              className="flex items-center p-6 bg-white border-2 border-blue-100 rounded-xl hover:border-blue-200 hover:bg-blue-50 transition-colors group shadow-sm hover:shadow-md"
            >
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                </div>
              </div>
              <div className="ml-4 text-left">
                <h4 className="text-lg font-medium text-gray-900 group-hover:text-blue-900">Request Tutoring</h4>
                <p className="text-sm text-gray-500 group-hover:text-blue-700">Find a tutor for your subjects</p>
              </div>
            </Link>
            {/* Ask for Help Card */}
            <button
              onClick={() => setShowHelpModal(true)}
              className="flex items-center p-6 bg-white border-2 border-blue-100 rounded-xl hover:border-blue-200 hover:bg-blue-50 transition-colors group text-left shadow-sm hover:shadow-md"
            >
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5h.01" />
                  </svg>
                </div>
              </div>
              <div className="ml-4 text-left">
                <h4 className="text-lg font-medium text-gray-900 group-hover:text-blue-900">Ask for Help</h4>
                <p className="text-sm text-gray-500 group-hover:text-blue-700">Request help from Tutoring Executives</p>
              </div>
            </button>
          </div>
        </div>

        {/* Requests */}
        <div className="mb-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Your Requests
          </h3>
          {data.opportunities && data.opportunities.length > 0 ? (
            <div className="bg-white border-2 border-gray-100 overflow-hidden sm:rounded-md shadow-sm">
              <ul className="divide-y divide-gray-200">
                {data.opportunities.map((o: any) => (
                  <li key={o.id}>
                    <div className="px-4 py-4 sm:px-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <SubjectIcon subjectName={o.subject_name || "Subject"} size="md" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {o.subject_name} • {o.subject_type} • Grade{" "}
                              {o.subject_grade}
                            </div>
                            <div className="text-sm text-gray-500">
                              Status: {o.status}
                            </div>
                            {o.sessions_per_week && (
                              <div className="text-xs text-gray-400 mt-1">
                                Sessions/week: {o.sessions_per_week}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-sm text-gray-400">
                            {new Date(o.created_at).toLocaleString()}
                          </div>
                          {o.status === 'open' && (
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  // Optimistically remove from UI
                                  setData((prev: any) => prev ? {
                                    ...prev,
                                    opportunities: (prev.opportunities || []).filter((op: any) => op.id !== o.id)
                                  } : prev);
                                  await api.cancelTuteeOpportunity(o.id);
                                } catch (err) {
                                  // Revert on failure (add back)
                                  setData((prev: any) => prev ? {
                                    ...prev,
                                    opportunities: [o, ...(prev.opportunities || [])]
                                  } : prev);
                                }
                              }}
                              className="inline-flex items-center px-4 py-1.5 border border-transparent text-xs font-medium rounded-full h-10 text-red-600 font-medium bg-red-100 hover:bg-red-200"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="text-center py-8 bg-white rounded-lg border-2 border-gray-100">
              <h4 className="mt-2 text-sm font-medium text-gray-900">
                No requests
              </h4>
              <p className="mt-1 text-sm text-gray-500">
                Create a tutoring request to get matched with a tutor.
              </p>
              <div className="mt-6">
                <Link
                  href="/tutee/request"
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Create Tutoring Request
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Sessions */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Your Sessions
            </h3>
            {hasPendingAvailability() && (
              <div className="bg-red-100 text-red-600 w-6 h-6 rounded-md text-xs font-medium flex items-center justify-center">
                {data?.jobs?.filter((j: any) => j.status === 'pending_tutee_scheduling').length || 0}
              </div>
            )}
          </div>
          {data.jobs && data.jobs.length > 0 ? (
            <div className="bg-white border-2 border-gray-100 overflow-hidden sm:rounded-md shadow-sm">
              <ul className="divide-y divide-gray-200">
                {data.jobs.map((j: any, index: number) => (
                  <li key={j.id}>
                    <div
                      className="px-4 py-4 sm:px-6 cursor-pointer"
                      onClick={() => {
                        const s = new Set(expandedJobs);
                        if (s.has(j.id)) s.delete(j.id);
                        else s.add(j.id);
                        setExpandedJobs(s);
                        if (!expandedJobs.has(j.id)) {
                          loadJobDetails(j.id);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 mr-4">
                            <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-md flex items-center justify-center font-semibold text-sm">
                              {index + 1}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {j.subject_name} • {j.subject_type} • Grade{" "}
                              {j.subject_grade}
                            </div>
                            <div className="text-sm text-gray-500 flex items-center gap-2">
                              <span>
                                Tutor: {j.tutor?.first_name} {j.tutor?.last_name}
                              </span>
                              <span
                                className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  j.status === "scheduled"
                                    ? "bg-green-100 text-green-800"
                                    : j.status === "pending_tutor_scheduling"
                                    ? "bg-orange-100 text-orange-800"
                                    : j.status === "pending_tutee_scheduling"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-yellow-100 text-yellow-800"
                                }`}
                              >
                                {j.status === "pending_tutee_scheduling"
                                  ? "Waiting for you to Set Availability"
                                  : j.status === "pending_tutor_scheduling"
                                  ? "Waiting for Tutor to Set Availability"
                                  : j.status}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {j.status === "pending_tutee_scheduling" && (
                            <Link
                              href={`/tutee/schedule/${j.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center px-4 py-1.5 border border-transparent text-xs font-medium rounded-full h-10 text-red-600 font-medium bg-red-100 hover:bg-red-200"
                            >
                              Set your availability
                            </Link>
                          )}
                          {/* Allow tutee to cancel an active or pending job */}
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                // Optimistically remove from UI
                                setData((prev: any) => prev ? { ...prev, jobs: (prev.jobs || []).filter((k: any) => k.id !== j.id) } : prev);
                                await api.cancelJob(j.id);
                              } catch (err) {
                                // Revert on failure
                                setData((prev: any) => prev ? { ...prev, jobs: [j, ...(prev.jobs || [])] } : prev);
                              }
                            }}
                            className="inline-flex items-center px-4 py-1.5 border border-transparent text-xs font-medium rounded-full h-10 text-red-600 font-medium bg-red-100 hover:bg-red-200"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                      {expandedJobs.has(j.id) && (
                        <div className="mt-4 pl-2 border-l border-gray-200">
                          <div className="grid grid-cols-1 gap-3 text-sm text-gray-700">
                            <div>
                              <div className="font-medium mb-1">
                                Tutor Details
                              </div>
                              <div className="space-y-1">
                                <div>
                                  <span className="font-medium">Name:</span>{" "}
                                  {j.tutor?.first_name && j.tutor?.last_name
                                    ? `${j.tutor.first_name} ${j.tutor.last_name}`
                                    : "—"}
                                </div>
                                <div>
                                  <span className="font-medium">Email:</span>{" "}
                                  {(j.tutor?.email || "—").replace(/(^[^@\s]+)(\+(?:tutor|tutee))@([Hh][Dd][Ss][Bb]\.ca)$/,'$1@$3')}
                                </div>
                              </div>
                            </div>
                            <div>
                              <div className="font-medium mb-1">
                                Session Details
                              </div>
                              <div className="space-y-1">
                                <div>
                                  <span className="font-medium">Subject:</span>{" "}
                                  {j.subject_name} • {j.subject_type} • Grade{" "}
                                  {j.subject_grade}
                                </div>
                                <div>
                                  <span className="font-medium">Language:</span>{" "}
                                  {j.language || "English"}
                                </div>
                                {j.scheduled_time ? (
                                  <div>
                                    <span className="font-medium">
                                      Scheduled:
                                    </span>{" "}
                                    {new Date(
                                      j.scheduled_time
                                    ).toLocaleString()}
                                  </div>
                                ) : null}
                                {/* Status omitted here; shown in header chip */}
                              </div>
                            </div>
                            <div>
                              {/* <div className="font-medium mb-1">Your availability</div>
                              {j.tutee_availability ? (
                                <div className="space-y-1">
                                  {Object.entries(j.tutee_availability).map(([date, ranges]: any) => (
                                    <div key={date} className="text-sm text-gray-700">
                                      <span className="font-medium mr-2">{new Date(date as string).toLocaleDateString()}</span>
                                      {Array.isArray(ranges) && ranges.length ? ranges.join(', ') : <span className="text-gray-400">No time set</span>}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-sm text-gray-500">No availability submitted.</div>
                              )} */}
                            </div>
                          </div>
                          {/* Set your availability button moved to main row */}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="text-center py-8 bg-white rounded-lg border-2 border-gray-100">
              <h4 className="mt-2 text-sm font-medium text-gray-900">
                No sessions yet
              </h4>
              <p className="mt-1 text-sm text-gray-500">
                Once a tutor accepts your request, your sessions will appear
                here.
              </p>
            </div>
          )}
        </div>
      </div>
      {editingSubjects && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setEditingSubjects(false)}
          ></div>
          <div className="relative w-full max-w-md">
            <div className="absolute -inset-2 rounded-3xl bg-gradient-to-tr from-blue-400 via-indigo-400 to-purple-400 opacity-30 blur-2xl animate-pulse" />
            <div className="relative bg-white/90 backdrop-blur shadow-xl ring-1 ring-gray-200 rounded-2xl p-6">
            <h3 className="text-lg font-semibold mb-2">Edit My Subjects</h3>
            <div className="space-y-2 mb-3">
              {subjects.map((s, idx) => {
                // compute options that exclude already chosen values (except current row)
                const chosen = new Set(
                  subjects.filter((_, i) => i !== idx && !!subjects[i])
                );
                const options = allSubjects.filter((n) => !chosen.has(n));
                return (
                  <div key={idx} className="flex gap-2">
                    <select
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                      value={s}
                      onChange={(e) => {
                        const next = subjects.slice();
                        next[idx] = e.target.value;
                        setSubjects(next);
                      }}
                    >
                      <option value="">Select...</option>
                      {options.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        const next = subjects.slice();
                        next.splice(idx, 1);
                        setSubjects(next);
                      }}
                      className="px-3 py-2 border border-gray-200 rounded-xl hover:bg-gray-50"
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between">
              <button
                type="button"
                disabled={subjects.length >= 10 || subjects.some((s) => !s)}
                onClick={() =>
                  subjects.length < 10 &&
                  !subjects.some((s) => !s) &&
                  setSubjects([...subjects, ""])
                }
                className="px-3 py-2 border border-gray-200 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Add course
              </button>
              <div className="flex gap-2">
                <button
                  className="px-3 py-2 border border-gray-200 rounded-xl hover:bg-gray-50"
                  onClick={() => setEditingSubjects(false)}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white shadow-md transition hover:bg-blue-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500/60 disabled:opacity-60"
                  disabled={savingSubjects}
                  onClick={async () => {
                    // Optimistically close immediately
                    setEditingSubjects(false);
                    try {
                      setSavingSubjects(true);
                      const apiBase = process.env.NEXT_PUBLIC_API_URL as string;
                      const {
                        data: { session },
                      } = await (
                        await import("@/services/supabase")
                      ).supabase.auth.getSession();
                      const resp = await fetch(
                        `${apiBase}/api/tutee/subjects`,
                        {
                          method: "PUT",
                          headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${
                              session?.access_token ?? ""
                            }`,
                          },
                          body: JSON.stringify({
                            subjects: subjects.filter(Boolean),
                          }),
                        }
                      );
                      if (!resp.ok) {
                        const j = await resp.json().catch(() => ({}));
                        throw new Error(j.error || "Failed to update");
                      }
                    } catch (e) {
                      // Could show toast
                    } finally {
                      setSavingSubjects(false);
                    }
                  }}
                >
                  <span className="font-semibold tracking-wide">{savingSubjects ? "Saving..." : "Save"}</span>
                </button>
              </div>
            </div>
            </div>
          </div>
        </div>
      )}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowHelpModal(false)}></div>
          <div className="relative w-full max-w-lg">
            <div className="absolute -inset-2 rounded-3xl bg-gradient-to-tr from-blue-400 via-indigo-400 to-purple-400 opacity-30 blur-2xl animate-pulse" />
            <div className="relative bg-white/90 backdrop-blur shadow-xl ring-1 ring-gray-200 rounded-2xl p-6">
              <h3 className="text-lg font-semibold mb-2">Ask for Help</h3>
              <p className="text-sm text-gray-600 mb-4">Request help from Tutoring Executives.</p>
              <div className="grid grid-cols-1 gap-3 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Urgency</label>
                  <select
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                    value={helpUrgency}
                    onChange={(e) => setHelpUrgency((e.target.value as 'urgent'|'non-urgent') || 'non-urgent')}
                  >
                    <option value="urgent">Urgent</option>
                    <option value="non-urgent">Non-urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 min-h-[140px] shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                    placeholder="Describe your issue or question..."
                    value={helpDescription}
                    onChange={(e) => setHelpDescription(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button className="px-3 py-1.5 border border-gray-200 rounded-xl hover:bg-gray-50" onClick={() => setShowHelpModal(false)}>Cancel</button>
                <button
                  className="group relative overflow-hidden px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-md transition hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500/60 disabled:opacity-60"
                  disabled={helpSubmitting || !helpDescription.trim()}
                  onClick={async () => {
                    // Optimistically close the modal immediately
                    setShowHelpModal(false);
                    const desc = helpDescription.trim();
                    setHelpDescription("");
                    setHelpUrgency('non-urgent');
                    try {
                      setHelpSubmitting(true);
                      await api.submitHelpRequest({ urgency: helpUrgency, description: desc });
                    } catch (e: any) {
                      setError(e?.message || 'Failed to submit help request.');
                    } finally {
                      setHelpSubmitting(false);
                    }
                  }}
                >
                  <span className="relative z-10 font-semibold tracking-wide">{helpSubmitting ? 'Submitting...' : 'Submit Request'}</span>
                  <span className="pointer-events-none absolute -inset-px rounded-[inherit] bg-gradient-to-r from-blue-400/40 via-indigo-400/30 to-purple-400/40 blur opacity-60 group-hover:opacity-90" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </TuteeLayout>
  );
}
