// @ts-nocheck

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/app/providers";
import { supabase } from "@/services/supabase";
import { TutorLayout } from "@/components/tutor-layout";
import apiService from "@/services/api";

interface TutoringJob {
  id: string;
  opportunity_id: string;
  scheduled_time?: string;
  status: string;
  tutoring_opportunity?: {
    tutee?: { first_name: string; last_name: string; email: string };
    subject?: { name: string };
    location_preference?: string;
    availability?: string;
  };
}

interface SubjectApproval {
  id: string;
  subject: string;
  status: "pending" | "approved" | "denied";
  approved_at?: string;
}

interface TutorData {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  volunteer_hours: number;
  status: string;
  school: {
    name: string;
  };
}

// Function to get the appropriate subject icon
const getSubjectIcon = (subjectName: string): string => {
  const subject = subjectName.toLowerCase();

  // Mathematics subjects
  if (
    subject.includes("math") ||
    subject.includes("algebra") ||
    subject.includes("calculus") ||
    subject.includes("geometry") ||
    subject.includes("trigonometry") ||
    subject.includes("statistics") ||
    subject.includes("functions") ||
    subject.includes("equation")
  ) {
    return "/maths.svg";
  }

  // Physics subjects
  if (
    subject.includes("physics") ||
    subject.includes("mechanics") ||
    subject.includes("thermodynamics") ||
    subject.includes("electromagnetism") ||
    subject.includes("optics")
  ) {
    return "/physics.svg";
  }

  // Biology subjects
  if (
    subject.includes("biology") ||
    subject.includes("anatomy") ||
    subject.includes("genetics") ||
    subject.includes("ecology") ||
    subject.includes("botany") ||
    subject.includes("zoology")
  ) {
    return "/biology.svg";
  }

  // General Science subjects
  if (
    subject.includes("science") ||
    subject.includes("chemistry") ||
    subject.includes("lab")
  ) {
    return "/Science.svg";
  }

  // Geography subjects
  if (
    subject.includes("geography") ||
    subject.includes("geology") ||
    subject.includes("earth") ||
    subject.includes("environmental")
  ) {
    return "/geography.svg";
  }

  // History subjects
  if (
    subject.includes("history") ||
    subject.includes("social studies") ||
    subject.includes("civics") ||
    subject.includes("government") ||
    subject.includes("politics")
  ) {
    return "/history.svg";
  }

  // Language subjects
  if (
    subject.includes("english") ||
    subject.includes("literature") ||
    subject.includes("writing") ||
    subject.includes("language") ||
    subject.includes("spanish") ||
    subject.includes("french") ||
    subject.includes("german") ||
    subject.includes("chinese") ||
    subject.includes("reading")
  ) {
    return "/languages.svg";
  }

  // Default fallback to science icon
  return "/Science.svg";
};

export default function TutorDashboard() {
  const { user, userRole, signOut, isLoading: authLoading } = useAuth();
  const [tutorData, setTutorData] = useState<TutorData | null>(null);
  const [activeJobs, setActiveJobs] = useState<TutoringJob[]>([]);
  const [subjectApprovals, setSubjectApprovals] = useState<SubjectApproval[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());
  const [cancellingJobId, setCancellingJobId] = useState<string | null>(null);
  const [showRecordingModalFor, setShowRecordingModalFor] = useState<string | null>(null);
  const [recordingUrlInput, setRecordingUrlInput] = useState<string>("");
  const [pastJobs, setPastJobs] = useState<any[]>([]);
  const router = useRouter();

  // Check for URL parameters when component mounts
  useEffect(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const scheduled = searchParams.get("scheduled");
      const cancelled = searchParams.get("cancelled");
      const completed = searchParams.get("completed");

      if (scheduled === "success") {
        setSuccessMessage(
          "Session scheduled successfully! The tutee has been notified."
        );
      } else if (cancelled === "true") {
        setSuccessMessage(
          "Job cancelled successfully. The opportunity has been returned to the board."
        );
      } else if (completed === "success") {
        setSuccessMessage(
          "Session completed successfully! Your volunteer hours have been added to your account."
        );
      }
    }
  }, []);

  useEffect(() => {
    const fetchTutorData = async () => {
      if (authLoading) return;

      if (!user) {
        console.log("Dashboard: No user found, redirecting to login");
        router.push("/auth/login");
        return;
      }

      // Wait for role determination without forcing redirect
      if (userRole === null) {
        console.log("Dashboard: User role is null, waiting for role determination...");
        return;
      }

      if (userRole !== "tutor") {
        // Redirect admins to admin dashboard
        if (userRole === "admin") {
          console.log(
            "Dashboard: User is admin, redirecting to admin dashboard"
          );
          router.push("/admin/dashboard");
          return;
        }
        // Redirect tutees to their dashboard
        if (userRole === "tutee") {
          console.log("Dashboard: User is tutee, redirecting to tutee dashboard");
          router.push("/tutee/dashboard");
          return;
        }
        // For users without a role, redirect to login
        console.log("Dashboard: User has no valid role, redirecting to login");
        router.push("/auth/login");
        return;
      }

      console.log("Dashboard: User is tutor, loading dashboard data via backend...");

      try {
        const resp = await apiService.getTutorDashboard();
        // resp: { tutor, approved_subject_ids, opportunities, jobs }
        setTutorData(resp.tutor || null);
        setActiveJobs(resp.jobs || []);
        // Map approvals to { id, subject, status, approved_at }
        const approvals = (resp.approvals || resp.approved_subject_ids || []).map((a: any) => (
          typeof a === 'string' ? { id: a, subject: a, status: 'approved' } : a
        ));
        setSubjectApprovals(approvals);
        // Load past jobs
        try {
          const pj = await apiService.listTutorPastJobs();
          setPastJobs(pj.jobs || []);
        } catch (e) {
          // ignore
        }
        setIsLoading(false);
      } catch (err: any) {
        console.error("Error loading tutor dashboard:", err);
        setError("Failed to load tutor data");
        setIsLoading(false);
      }
    };

    fetchTutorData();
  }, [user, userRole, authLoading, router]);

  const handleSignOut = async () => {
    console.log("Tutor dashboard: Starting sign out...");
    await signOut();
    // SupabaseListener will move us to /auth/login
  };

  const handleCancelJob = async (jobId: string, opportunityId: string) => {
    setCancellingJobId(jobId);

    try {
      // Use backend endpoint to cancel job and reopen opportunity
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tutor/jobs/${jobId}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      // Remove the job from the active jobs list
      setActiveJobs((prev) => prev.filter((job) => job.id !== jobId));

      // Show success message
      setSuccessMessage(
        "Tutoring job cancelled successfully. The opportunity has been returned to the board."
      );
    } catch (err) {
      console.error("Error in handleCancelJob:", err);
      setError("An unexpected error occurred while cancelling the job.");
    } finally {
      setCancellingJobId(null);
    }
  };

  // Helper function to format time in 12-hour format with AM/PM
  const formatTime = (timeString: string) => {
    if (!timeString) return "";

    try {
      // For handling ISO format or time-only strings
      let time;
      if (timeString.includes("T")) {
        // Full ISO datetime
        time = new Date(timeString);
      } else {
        // Time-only string (HH:MM)
        const [hours, minutes] = timeString.split(":").map(Number);
        time = new Date();
        time.setHours(hours, minutes);
      }

      return time.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch (err) {
      console.error("Error formatting time:", err);
      return timeString; // Return original if parsing fails
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-800">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">⚠️ {error}</div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <TutorLayout>
      <div className="p-6 bg-white min-h-full">
        {successMessage && (
          <div className="max-w-7xl mx-auto mb-6">
            <div
              className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded relative"
              role="alert"
            >
              <span className="block sm:inline">{successMessage}</span>
              <button
                className="absolute top-0 bottom-0 right-0 px-4 py-3"
                onClick={() => setSuccessMessage(null)}
              >
                <span className="sr-only">Dismiss</span>
                <span className="text-green-600">&times;</span>
              </button>
            </div>
          </div>
        )}
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Welcome section */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Welcome back, {tutorData?.first_name}!
            </h2>
            <p className="text-gray-600">
              {tutorData?.school?.name} •{" "}
              {tutorData?.status === "active"
                ? "Active Tutor"
                : "Pending Approval"}
            </p>
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold">H</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Volunteer Hours
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {tutorData?.volunteer_hours || 0}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold">J</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Active Jobs
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {activeJobs.length}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold">S</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Approved Subjects
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {
                          subjectApprovals.filter(
                            (s) => s.status === "approved"
                          ).length
                        }
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
        

          {/* Active Jobs */}
          <div className="mb-8">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Active Tutoring Jobs
            </h3>
              {activeJobs.length > 0 ? (
                <div className="bg-white shadow overflow-hidden sm:rounded-md">
                  <ul className="divide-y divide-gray-200">
                    {activeJobs.map((job) => (
                      <li key={job.id}>
                        <div
                          className="px-4 py-4 sm:px-6 cursor-pointer"
                          onClick={() => {
                            const newExpandedJobs = new Set(expandedJobs);
                            if (newExpandedJobs.has(job.id)) {
                              newExpandedJobs.delete(job.id);
                            } else {
                              newExpandedJobs.add(job.id);
                            }
                            setExpandedJobs(newExpandedJobs);
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <div className="flex-shrink-0">
                                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                                  <span className="text-white font-medium">
                                    {(job.tutoring_opportunity?.subject?.name || '?').charAt(0)}
                                  </span>
                                </div>
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">
                                  {(job.tutoring_opportunity?.subject_name ? `${job.tutoring_opportunity.subject_name} • ${job.tutoring_opportunity.subject_type} • Grade ${job.tutoring_opportunity.subject_grade}` : (job.tutoring_opportunity?.subject?.name || ''))}
                                  {job.tutoring_opportunity?.tutee ? (
                                    ` - ${job.tutoring_opportunity.tutee.first_name} ${job.tutoring_opportunity.tutee.last_name}`
                                  ) : ''}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {job.tutoring_opportunity?.location_preference || ''}{" "}
                                  • {job.status === 'pending_tutee_scheduling' ? 'awaiting tutee scheduling' : job.status === 'pending_tutor_scheduling' ? 'awaiting tutor scheduling' : job.status}
                                </div>
                                {job.scheduled_time ? (
                                  <div className="text-xs text-gray-400 mt-1">
                                    Scheduled: {formatTime(job.scheduled_time)}
                                  </div>
                                ) : (
                                  <div className="text-xs text-gray-400 mt-1">
                                    {job.finalized_schedule ? 'Weekly schedule set' : 'No weekly schedule yet'}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span
                                className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  job.status === 'scheduled'
                                    ? 'bg-green-100 text-green-800'
                                    : job.status === 'pending_tutor_scheduling'
                                    ? 'bg-orange-100 text-orange-800'
                                    : job.status === 'pending_tutee_scheduling'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}
                              >
                                {job.status === 'pending_tutee_scheduling' ? 'awaiting tutee scheduling' : job.status === 'pending_tutor_scheduling' ? 'awaiting tutor scheduling' : job.status}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const newExpandedJobs = new Set(expandedJobs);
                                  if (newExpandedJobs.has(job.id)) {
                                    newExpandedJobs.delete(job.id);
                                  } else {
                                    newExpandedJobs.add(job.id);
                                  }
                                  setExpandedJobs(newExpandedJobs);
                                }}
                                className="text-gray-400 hover:text-gray-600"
                              >
                                <svg
                                  className={`w-5 h-5 transform transition-transform ${
                                    expandedJobs.has(job.id) ? "rotate-180" : ""
                                  }`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M19 9l-7 7-7-7"
                                  />
                                </svg>
                              </button>
                            </div>
                          </div>

                          {/* Expanded details */}
                          {expandedJobs.has(job.id) && (
                            <div className="mt-4 pt-4 border-t border-gray-200">
                              <div className="grid grid-cols-1 gap-4">
                                <div>
                                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                                    Tutee Details
                                  </h4>
                                  <div className="text-sm text-gray-600 space-y-1">
                                    <p>
                                      <span className="font-medium">Name:</span>{" "}
                                      {job.tutoring_opportunity.tutee_name}
                                    </p>
                                    <p>
                                      <span className="font-medium">
                                        Email:
                                      </span>{" "}
                                      {job.tutoring_opportunity.tutee_email}
                                    </p>
                                  </div>
                                </div>
                                <div>
                                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                                    Session Details
                                  </h4>
                                  <div className="text-sm text-gray-600 space-y-1">
                                    <p>
                                      <span className="font-medium">Subject:</span>{" "}
                                      {job.tutoring_opportunity?.subject_name ? `${job.tutoring_opportunity.subject_name} • ${job.tutoring_opportunity.subject_type} • Grade ${job.tutoring_opportunity.subject_grade}` : (job.tutoring_opportunity?.subject || '')}
                                    </p>
                                    <p>
                                      <span className="font-medium">
                                        Location:
                                      </span>{" "}
                                      {
                                        job.tutoring_opportunity
                                          .location_preference
                                      }
                                    </p>
                                    {job.scheduled_time ? (
                                      <p>
                                        <span className="font-medium">Scheduled Time:</span>{" "}
                                        {formatTime(job.scheduled_time)}
                                      </p>
                                    ) : (
                                      <p>
                                        <span className="font-medium">Availability:</span>{" "}
                                        {job.finalized_schedule ? 'Weekly schedule set' : 'No weekly schedule yet'}
                                      </p>
                                    )}
                                    <p>
                                      <span className="font-medium">
                                        Status:
                                      </span>{" "}
                                      {job.status}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              <div className="mt-4 flex flex-wrap gap-2">
                                {job.status === "pending_tutor_scheduling" && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      router.push(`/scheduling/${job.id}`);
                                    }}
                                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700"
                                  >
                                    Schedule
                                  </button>
                                )}
                                {job.status === "scheduled" && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // disabled until a recording link is provided via modal
                                    }}
                                    disabled
                                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-green-600 opacity-50 cursor-not-allowed"
                                  >
                                    Complete Session
                                  </button>
                                )}
                                {job.status === "scheduled" && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setShowRecordingModalFor(job.id);
                                    }}
                                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-purple-600 hover:bg-purple-700"
                                  >
                                    Upload Recording Link
                                  </button>
                                )}
                                {job.status === 'awaiting_admin_verification' && (
                                  <span className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded bg-yellow-100 text-yellow-800">
                                    Pending Verification
                                  </span>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (job.tutoring_opportunity?.tutee?.email) {
                                      window.location.href = `mailto:${job.tutoring_opportunity.tutee.email}`;
                                    }
                                  }}
                                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                                >
                                  Contact Tutee
                                </button>
                                {job.status !== 'awaiting_admin_verification' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCancelJob(job.id, job.opportunity_id);
                                  }}
                                  disabled={cancellingJobId === job.id}
                                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-red-600 hover:bg-red-700 disabled:bg-red-300"
                                >
                                  {cancellingJobId === job.id
                                    ? "Cancelling..."
                                    : "Cancel Job"}
                                </button>
                                )}
                              </div>
                              {job.finalized_schedule && typeof job.finalized_schedule === 'object' && (
                                <div className="mt-4">
                                  <h5 className="text-sm font-medium text-gray-700 mb-2">Weekly Schedule</h5>
                                  <div className="space-y-1">
                                    {Object.entries(job.finalized_schedule).map(([day, ranges]: any) => (
                                      <div key={day} className="text-sm text-gray-700">
                                        <span className="font-medium mr-2">{day}:</span>
                                        {Array.isArray(ranges) && ranges.length ? ranges.join(', ') : <span className="text-gray-400">No time set</span>}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="text-center py-8 bg-white rounded-lg shadow">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">
                    No active jobs
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    You don't have any active tutoring jobs at the moment.
                  </p>
                  <div className="mt-6">
                    <Link
                      href="/tutor/opportunities"
                      className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                    >
                      Browse Opportunities
                    </Link>
                  </div>
                </div>
              )}
          </div>

          {/* Past Jobs */}
          <div className="mb-8">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Past Jobs</h3>
            {pastJobs.length > 0 ? (
              <div className="bg-white shadow overflow-hidden sm:rounded-md">
                <ul className="divide-y divide-gray-200">
                  {pastJobs.map((job) => (
                    <li key={job.id} className="px-4 py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {job.subject_name} • {job.subject_type} • Grade {job.subject_grade}
                          </div>
                          <div className="text-xs text-gray-500">
                            {job.scheduled_time ? new Date(job.scheduled_time).toLocaleString() : ''} • {job.duration_minutes ? `${job.duration_minutes} minutes` : ''}
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="text-center py-8 bg-white rounded-lg shadow">
                <h4 className="text-sm font-medium text-gray-900">No past jobs</h4>
                <p className="text-sm text-gray-500">Completed and verified jobs will show up here.</p>
              </div>
            )}
          </div>

        {/* Subject Approvals */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Subject Approvals
          </h3>
              {subjectApprovals.length > 0 ? (
                <div className="bg-white shadow overflow-hidden sm:rounded-md">
                  <ul className="divide-y divide-gray-200">
                    {subjectApprovals.map((approval) => (
                      <li key={approval.id}>
                        <div className="px-2 py-4 sm:px-4 flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 mr-3">
                              <Image
                                src={getSubjectIcon(approval.subject)}
                                alt={`${approval.subject} icon`}
                                width={35}
                                height={24}
                                className="object-contain pl-[-15]"
                              />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {approval.subject}
                              </div>
                              {approval.approved_at && (
                                <div className="text-xs text-gray-500">
                                  Approved on{" "}
                                  {new Date(
                                    approval.approved_at
                                  ).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                          </div>
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              approval.status === "approved"
                                ? "bg-green-100 text-green-600"
                                : approval.status === "pending"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {approval.status}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="text-center py-8 bg-white rounded-lg shadow">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                    />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">
                    No subject approvals
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Contact your school administrator to get approved for
                    subjects you can tutor.
                  </p>
                </div>
              )}
            </div>
        </div>
      </div>
      {showRecordingModalFor && (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/40" onClick={() => setShowRecordingModalFor(null)}></div>
        <div className="relative bg-white rounded-lg shadow-lg w-full max-w-md p-6">
          <h3 className="text-lg font-semibold mb-2">Upload Session Recording Link</h3>
          <p className="text-sm text-gray-600 mb-4">Paste the URL to your session recording. You can edit this until you mark the session as completed.</p>
          <input
            type="url"
            placeholder="https://..."
            value={recordingUrlInput}
            onChange={(e) => setRecordingUrlInput(e.target.value)}
            className="w-full border rounded px-3 py-2 mb-4"
          />
          <div className="flex justify-end gap-2">
            <button className="px-3 py-1.5 border rounded" onClick={() => setShowRecordingModalFor(null)}>Cancel</button>
            <button
              className="px-3 py-1.5 bg-purple-600 text-white rounded"
              onClick={async () => {
                try {
                  if (!recordingUrlInput) return;
                  await apiService.upsertRecordingLink(showRecordingModalFor, recordingUrlInput);
                  // After link saved, allow completion
                  await apiService.completeJob(showRecordingModalFor, {});
                  setShowRecordingModalFor(null);
                  setRecordingUrlInput("");
                  // Remove job from active list
                  setActiveJobs(prev => prev.filter(j => j.id !== showRecordingModalFor));
                  setSuccessMessage('Recording link saved and session moved to awaiting verification.');
                } catch (e) {
                  setError('Failed to save recording link or complete session.');
                }
              }}
            >
              Save & Complete Session
            </button>
          </div>
        </div>
      </div>
      )}
    </TutorLayout>
  );
}
