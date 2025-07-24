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
  tutoring_opportunity: {
    tutee_name: string;
    tutee_email: string;
    subject: string;
    location_preference: string;
    availability: string;
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

      // Add timeout for role determination to prevent infinite loading
      if (userRole === null) {
        console.log(
          "Dashboard: User role is null, waiting for role determination..."
        );
        // If role is still null after auth loading is complete, give it a moment
        setTimeout(() => {
          if (userRole === null) {
            console.log(
              "Dashboard: Role determination timeout, redirecting to login"
            );
            router.push("/auth/login");
          }
        }, 2000);
        return;
      }

      if (userRole !== "tutor") {
        // Redirect admins to admin dashboard
        if (userRole === "admin" || userRole === "superadmin") {
          console.log(
            "Dashboard: User is admin, redirecting to admin dashboard"
          );
          router.push("/admin/dashboard");
          return;
        }
        // For users without a role, redirect to login
        console.log("Dashboard: User has no valid role, redirecting to login");
        router.push("/auth/login");
        return;
      }

      console.log("Dashboard: User is tutor, loading dashboard data...");

      try {
        // Fetch tutor data
        const { data: tutor, error: tutorError } = await supabase
          .from("tutors")
          .select("*, school:schools(*)")
          .eq("auth_id", user.id)
          .single();

        if (tutorError) {
          console.error("Error fetching tutor data:", tutorError);
          setError("Failed to load tutor data");
          return;
        }

        setTutorData(tutor);

        // Fetch active tutoring jobs
        try {
          // First, get the jobs
          const { data: jobs, error: jobsError } = await supabase
            .from("tutoring_jobs")
            .select("*")
            .eq("tutor_id", tutor.id)
            .in("status", ["scheduled", "pending", "active"])
            .order("created_at", { ascending: false });

          if (jobsError) {
            console.error("Error fetching jobs:", jobsError.message);
            setActiveJobs([]);
          } else {
            // If we have jobs, fetch the related opportunities separately
            if (jobs && jobs.length > 0) {
              const opportunityIds = jobs
                .map((job) => job.opportunity_id)
                .filter(Boolean);

              if (opportunityIds.length > 0) {
                const { data: opportunities, error: oppError } = await supabase
                  .from("tutoring_opportunities")
                  .select("*")
                  .in("id", opportunityIds);

                if (oppError) {
                  console.error(
                    "Error fetching opportunities:",
                    oppError.message
                  );
                } else {
                  // Create a map of opportunities by ID for easy lookup
                  const opportunityMap = (opportunities || []).reduce(
                    (map, opp) => {
                      map[opp.id] = opp;
                      return map;
                    },
                    {}
                  );

                  // Join the data manually
                  const transformedJobs = jobs.map((job) => {
                    const opportunity =
                      opportunityMap[job.opportunity_id] || {};
                    return {
                      ...job,
                      tutoring_opportunity: {
                        ...opportunity,
                        tutee_name: `${opportunity.tutee_first_name || ""} ${
                          opportunity.tutee_last_name || ""
                        }`.trim(),
                        location_preference: opportunity.session_location || "",
                        availability: opportunity.availability_formatted || "",
                      },
                    };
                  });

                  setActiveJobs(transformedJobs);
                }
              } else {
                setActiveJobs([]);
              }
            } else {
              setActiveJobs([]);
            }
          }
        } catch (jobErr) {
          console.error("Exception fetching jobs:", jobErr);
          setActiveJobs([]);
        }

        // Fetch subject approvals
        try {
          // First get the approvals
          const { data: approvals, error: approvalsError } = await supabase
            .from("subject_approvals")
            .select("*")
            .eq("tutor_id", tutor.id)
            .order("created_at", { ascending: false });

          if (approvalsError) {
            console.error(
              "Error fetching subject approvals:",
              approvalsError.message
            );
            setSubjectApprovals([]);
          } else {
            // If we have approvals, fetch the related subjects separately
            if (approvals && approvals.length > 0) {
              const subjectIds = approvals
                .map((approval) => approval.subject_id)
                .filter(Boolean);

              if (subjectIds.length > 0) {
                const { data: subjects, error: subjectsError } = await supabase
                  .from("subjects")
                  .select("*")
                  .in("id", subjectIds);

                if (subjectsError) {
                  console.error(
                    "Error fetching subjects:",
                    subjectsError.message
                  );
                  // Still use the approvals without subject details
                  setSubjectApprovals(approvals);
                } else {
                  // Create a map of subjects by ID for easy lookup
                  const subjectMap = (subjects || []).reduce((map, subject) => {
                    map[subject.id] = subject;
                    return map;
                  }, {});

                  // Join the data manually
                  const transformedApprovals = approvals.map((approval) => {
                    const subject = subjectMap[approval.subject_id] || {};
                    return {
                      ...approval,
                      subject: subject.name || "Unknown Subject",
                    };
                  });

                  setSubjectApprovals(transformedApprovals);
                }
              } else {
                setSubjectApprovals([]);
              }
            } else {
              setSubjectApprovals([]);
            }
          }
        } catch (approvalErr) {
          console.error("Exception fetching subject approvals:", approvalErr);
          setSubjectApprovals([]);
        }
      } catch (err: any) {
        console.error("Error in fetchTutorData:", err);
        setError("An unexpected error occurred");
      } finally {
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
      // 1. Update job status to cancelled
      const { error: jobError } = await supabase
        .from("tutoring_jobs")
        .update({ status: "cancelled" })
        .eq("id", jobId);

      if (jobError) {
        console.error("Error cancelling job:", jobError);
        setError("Failed to cancel job. Please try again.");
        return;
      }

      // 2. Update opportunity status back to open with high priority
      const { error: oppError } = await supabase
        .from("tutoring_opportunities")
        .update({
          status: "open",
          priority: "high",
        })
        .eq("id", opportunityId);

      if (oppError) {
        console.error("Error updating opportunity:", oppError);
        setError(
          "Failed to update opportunity status. Please contact support."
        );
        return;
      }

      // 3. Send cancellation notification emails
      try {
        const cancelledJob = activeJobs.find((job) => job.id === jobId);
        if (cancelledJob && user) {
          // Get tutor's full name from auth user or construct from available data
          const tutorName =
            user?.user_metadata?.full_name ||
            `${user?.user_metadata?.first_name || ""} ${
              user?.user_metadata?.last_name || ""
            }`.trim() ||
            user?.email?.split("@")[0] ||
            "Tutor";

          const tuteeName = `${cancelledJob.tutoring_opportunity.tutee_first_name} ${cancelledJob.tutoring_opportunity.tutee_last_name}`;

          await apiService.sendCancellationNotification(
            user.email || "",
            cancelledJob.tutoring_opportunity.tutee_email,
            {
              subject: cancelledJob.tutoring_opportunity.subject,
              tutor_name: tutorName,
              tutee_name: tuteeName,
              reason: "Tutor cancelled the session",
            },
            jobId
          );
          console.log("Cancellation notification emails sent successfully");
        }
      } catch (emailError) {
        console.error("Failed to send cancellation notifications:", emailError);
        // Don't fail the entire process if email fails - this is expected in development
        console.log(
          "Email sending failed (expected in development mode) - continuing with cancellation"
        );
      }

      // 4. Remove the job from the active jobs list
      setActiveJobs((prev) => prev.filter((job) => job.id !== jobId));

      // 5. Show success message
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
          <div className="mb-8">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Quick Actions
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-1 lg:grid-cols-1 gap-4">
              <Link
                href="/opportunities"
                className="relative block w-full rounded-lg border-2 border-dashed border-gray-300 p-6 text-center hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <svg
                  className="mx-auto h-8 w-8 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <span className="mt-2 block text-sm font-medium text-gray-900">
                  Browse Opportunities
                </span>
                <span className="mt-1 block text-xs text-gray-500">
                  Find new tutoring opportunities
                </span>
              </Link>
            </div>
          </div>

          {/* Active Jobs and Subject Approvals - 2 Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Active Jobs */}
            <div>
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
                                    {job.tutoring_opportunity.subject.charAt(0)}
                                  </span>
                                </div>
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">
                                  {job.tutoring_opportunity.subject} -{" "}
                                  {job.tutoring_opportunity.tutee_name}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {job.tutoring_opportunity.location_preference}{" "}
                                  • {job.status}
                                </div>
                                {job.scheduled_time ? (
                                  <div className="text-xs text-gray-400 mt-1">
                                    Scheduled: {formatTime(job.scheduled_time)}
                                  </div>
                                ) : (
                                  <div className="text-xs text-gray-400 mt-1">
                                    Available:{" "}
                                    {job.tutoring_opportunity.availability && (
                                      <span className="inline-flex items-center">
                                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs">
                                          {formatTime(
                                            job.tutoring_opportunity.availability.split(
                                              " - "
                                            )[0]
                                          )}
                                        </span>
                                        <svg
                                          className="w-3 h-3 mx-1 text-gray-500"
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth="2"
                                            d="M14 5l7 7m0 0l-7 7m7-7H3"
                                          />
                                        </svg>
                                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs">
                                          {formatTime(
                                            job.tutoring_opportunity.availability.split(
                                              " - "
                                            )[1]
                                          )}
                                        </span>
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span
                                className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  job.status === "scheduled"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-yellow-100 text-yellow-800"
                                }`}
                              >
                                {job.status}
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
                                      <span className="font-medium">
                                        Subject:
                                      </span>{" "}
                                      {job.tutoring_opportunity.subject}
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
                                        <span className="font-medium">
                                          Scheduled Time:
                                        </span>{" "}
                                        {formatTime(job.scheduled_time)}
                                      </p>
                                    ) : (
                                      <p>
                                        <span className="font-medium">
                                          Availability:
                                        </span>{" "}
                                        {job.tutoring_opportunity
                                          .availability && (
                                          <span className="inline-flex items-center">
                                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs">
                                              {formatTime(
                                                job.tutoring_opportunity.availability.split(
                                                  " - "
                                                )[0]
                                              )}
                                            </span>
                                            <svg
                                              className="w-3 h-3 mx-1 text-gray-500"
                                              fill="none"
                                              stroke="currentColor"
                                              viewBox="0 0 24 24"
                                            >
                                              <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth="2"
                                                d="M14 5l7 7m0 0l-7 7m7-7H3"
                                              />
                                            </svg>
                                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs">
                                              {formatTime(
                                                job.tutoring_opportunity.availability.split(
                                                  " - "
                                                )[1]
                                              )}
                                            </span>
                                          </span>
                                        )}
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
                                {job.status === "pending" && (
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
                                      router.push(
                                        `/sessions/${job.id}/complete`
                                      );
                                    }}
                                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700"
                                  >
                                    Complete Session
                                  </button>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.location.href = `mailto:${job.tutoring_opportunity.tutee_email}`;
                                  }}
                                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                                >
                                  Contact Tutee
                                </button>
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
                              </div>
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
                      href="/opportunities"
                      className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                    >
                      Browse Opportunities
                    </Link>
                  </div>
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
      </div>
    </TutorLayout>
  );
}
