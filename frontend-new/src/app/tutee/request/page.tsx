// @ts-nocheck

"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/providers";
import api from "@/services/api";
import { TuteeLayout } from "@/components/tutee-layout";
import {
  WeeklyTimeGrid,
  WeeklySelection,
  compressSelectionToWeeklyMap,
} from "@/components/weekly-time-grid";

export default function TuteeRequestPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  // Embedded subject fields
  const [subjectNames, setSubjectNames] = useState<string[]>([]);
  const SUBJECT_TYPES = ["Academic", "ALP", "IB"];
  const SUBJECT_GRADES = ["9", "10", "11", "12"];
  const [subjectName, setSubjectName] = useState("");
  const [subjectType, setSubjectType] = useState("");
  const [subjectGrade, setSubjectGrade] = useState("");
  // IB level (HL/SL) shown only when subjectType === 'IB'
  const [ibLevel, setIbLevel] = useState("");
  // Single-session flow: no weekly availability at request time
  const [locationPreference, setLocationPreference] = useState("");
  const [notes, setNotes] = useState("");
  const [isELL, setIsELL] = useState(false);
  const [ellLanguage, setEllLanguage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Subject editing popup state
  const [editingSubjects, setEditingSubjects] = useState(false);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [allSubjects, setAllSubjects] = useState<string[]>([]);
  const [savingSubjects, setSavingSubjects] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.push("/auth/login");
      return;
    }
    (async () => {
      try {
        // Load tutee profile to get their subjects
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
        const mySubjects = Array.isArray(j.subjects) ? j.subjects : [];
        setSubjectNames(mySubjects);
        setSubjects(mySubjects);
        setAllSubjects(Array.isArray(j.all_subjects) ? j.all_subjects : []);
        // Prefill grade based on graduation year if backend sent it in separate endpoint; for now, keep manual grade select
      } catch {}
    })();
  }, [isLoading, user, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // Build final subject name; append IB level when applicable
      let finalSubjectName =
        subjectType === "IB" && ibLevel
          ? `${subjectName} ${ibLevel}`
          : subjectName;
      if (isELL) {
        finalSubjectName = `${finalSubjectName} (ELL)`;
      }
      await api.createTuteeOpportunity({
        subject_name: finalSubjectName,
        subject_type: subjectType,
        subject_grade: subjectGrade,
        language: isELL && ellLanguage ? ellLanguage : undefined,
        location_preference: locationPreference,
        additional_notes: notes,
      });
      router.push("/tutee/dashboard");
    } catch (e: any) {
      setError(e?.message || "Failed to create request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <TuteeLayout>
      <div className="relative p-6 bg-white min-h-full overflow-hidden">
        <div className="pointer-events-none absolute -z-10 inset-0">
          <div className="absolute -top-24 -left-24 w-[32rem] h-[32rem] rounded-full bg-gradient-to-tr from-blue-200 via-indigo-200 to-purple-200 blur-3xl opacity-70 animate-pulse" />
          <div className="absolute -bottom-24 -right-24 w-[32rem] h-[32rem] rounded-full bg-gradient-to-tr from-indigo-200 via-purple-200 to-pink-200 blur-3xl opacity-70 animate-pulse" />
        </div>

        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">Request Tutoring</h1>
          <p className="mt-1 text-gray-600">Tell us what you need help with and we’ll match you quickly.</p>

          <form onSubmit={submit} className="mt-6 space-y-5 relative">
            <div className="absolute -inset-2 rounded-3xl bg-gradient-to-tr from-blue-400 via-indigo-400 to-purple-400 opacity-20 blur-2xl" />
            <div className="relative rounded-2xl bg-white/80 backdrop-blur shadow-xl ring-1 ring-gray-200 p-5 sm:p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium">Subject</label>
              <select
                className="mt-1 border border-gray-200 rounded-xl px-3 py-2 w-full shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                value={subjectName}
                onChange={(e) => {
                  if (e.target.value === "EDIT_COURSES") {
                    setEditingSubjects(true);
                  } else {
                    setSubjectName(e.target.value);
                  }
                }}
                required
              >
                <option value="">Select...</option>
                {subjectNames.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
                <option
                  value="EDIT_COURSES"
                  className="text-blue-600 font-medium"
                >
                  Edit my courses
                </option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium">Type</label>
              <select
                className="mt-1 border border-gray-200 rounded-xl px-3 py-2 w-full shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                value={subjectType}
                onChange={(e) => {
                  setSubjectType(e.target.value);
                  if (e.target.value !== "IB") setIbLevel("");
                }}
                required
              >
                <option value="">Select...</option>
                {SUBJECT_TYPES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium">Grade</label>
              <select
                className="mt-1 border border-gray-200 rounded-xl px-3 py-2 w-full shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                value={subjectGrade}
                onChange={(e) => setSubjectGrade(e.target.value)}
                required
              >
                <option value="">Select...</option>
                {SUBJECT_GRADES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-2">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isELL}
                onChange={(e) => setIsELL(e.target.checked)}
              />
              Are you an ELL student?
            </label>
          </div>
          {isELL && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium">
                  Preferred Language
                </label>
                <input
                  className="mt-1 border border-gray-200 rounded-xl px-3 py-2 w-full shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                  value={ellLanguage}
                  onChange={(e) => setEllLanguage(e.target.value)}
                  placeholder="e.g., Spanish, French"
                />
              </div>
            </div>
          )}
          {subjectType === "IB" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium">IB Level</label>
                <select
                  className="mt-1 border border-gray-200 rounded-xl px-3 py-2 w-full shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                  value={ibLevel}
                  onChange={(e) => setIbLevel(e.target.value)}
                  required
                >
                  <option value="">Select...</option>
                  {["SL", "HL"].map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  This will be appended to the subject name (e.g., "Math HL").
                </p>
              </div>
            </div>
          )}
          {/* No availability selection at request time in single-session flow */}
          <div>
            <label className="block text-sm font-medium">
              Location Preference
            </label>
            <select
              className="mt-1 border border-gray-200 rounded-xl px-3 py-2 w-full shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
              value={locationPreference}
              onChange={(e) => setLocationPreference(e.target.value)}
              required
            >
              <option value="">Select...</option>
              <option value="Online">Online</option>
              <option value="In Person">In Person</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium" htmlFor="notes">
              More Details/Information
              <span className="block text-xs font-normal mt-1">
                Please include any specific details or information about your request, such as the specific topic you need help with, the specific questions you have, or the specific assignments you need help with, etc.
              </span>
            </label>
            <textarea
              className="mt-1 border border-gray-200 rounded-xl px-3 py-2 w-full shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          {error && <div className="text-red-600 text-sm">{error}</div>}
          <button
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white shadow-md transition hover:bg-blue-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500/60 disabled:opacity-60"
          >
            <span className="font-semibold tracking-wide">{loading ? "Submitting..." : "Submit Request"}</span>
          </button>
            </div>
          </form>
        </div>
      </div>
      {editingSubjects && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setEditingSubjects(false)}
          ></div>
          <div className="relative bg-white rounded-2xl shadow-xl ring-1 ring-gray-200 w-full max-w-md p-6">
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
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-2 shadow-sm"
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
                      className="px-3 py-2 border border-gray-200 rounded-xl"
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
                className="px-3 py-2 border border-gray-200 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add course
              </button>
              <div className="flex gap-2">
                <button
                  className="px-3 py-2 border border-gray-200 rounded-xl"
                  onClick={() => setEditingSubjects(false)}
                >
                  Cancel
                </button>
                <button
                  className="px-3 py-2 bg-blue-600 text-white rounded-xl"
                  disabled={savingSubjects}
                  onClick={async () => {
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
                      // Update the subject names in the dropdown
                      const updatedSubjects = subjects.filter(Boolean);
                      setSubjectNames(updatedSubjects);
                      setEditingSubjects(false);
                    } catch (e) {
                      // Could show toast
                    } finally {
                      setSavingSubjects(false);
                    }
                  }}
                >
                  {savingSubjects ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </TuteeLayout>
  );
}
