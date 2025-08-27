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

// Function to get a random flower icon based on job ID
const getRandomFlowerIcon = (jobId: string): string => {
  const flowerIcons = [
    "🥳 Type=Shape, 📏 Size=40, 🎨 Color=1, 🔳 Outline=None.png",
    "🥳 Type=Shape, 📏 Size=40, 🎨 Color=2, 🔳 Outline=None.png",
    "🥳 Type=Shape, 📏 Size=40, 🎨 Color=3, 🔳 Outline=None.png",
    "🥳 Type=Shape, 📏 Size=40, 🎨 Color=4, 🔳 Outline=None.png",
    "🥳 Type=Shape, 📏 Size=40, 🎨 Color=5, 🔳 Outline=None.png",
    "🥳 Type=Shape, 📏 Size=40, 🎨 Color=6, 🔳 Outline=None.png",
    "🥳 Type=Shape, 📏 Size=40, 🎨 Color=7, 🔳 Outline=None.png",
    "🥳 Type=Shape, 📏 Size=40, 🎨 Color=8, 🔳 Outline=None.png",
    "🥳 Type=Shape, 📏 Size=40, 🎨 Color=9, 🔳 Outline=None.png",
    "🥳 Type=Shape, 📏 Size=40, 🎨 Color=10, 🔳 Outline=None.png",
  ];
  // Use job ID to ensure consistent icon for same job
  const hash = jobId.split("").reduce((a, b) => {
    a = (a << 5) - a + b.charCodeAt(0);
    return a & a;
  }, 0);
  return flowerIcons[Math.abs(hash) % flowerIcons.length];
};

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
  const [showRecordingModalFor, setShowRecordingModalFor] = useState<
    string | null
  >(null);
  const [recordingUrlInput, setRecordingUrlInput] = useState<string>("");
  const [pastJobs, setPastJobs] = useState<any[]>([]);
  const router = useRouter();

  // Load extra job details securely on demand
  const loadJobDetails = async (jobId: string) => {
    try {
      const details = await apiService.getJobDetails(jobId);
      if (details?.job) {
        setActiveJobs((prev) =>
          prev.map((j) => (j.id === jobId ? { ...j, ...details.job } : j))
        );
      }
    } catch (e) {
      // ignore; best effort enrichment
    }
  };

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
        console.log(
          "Dashboard: User role is null, waiting for role determination..."
        );
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
          console.log(
            "Dashboard: User is tutee, redirecting to tutee dashboard"
          );
          router.push("/tutee/dashboard");
          return;
        }
        // For users without a role, redirect to login
        console.log("Dashboard: User has no valid role, redirecting to login");
        router.push("/auth/login");
        return;
      }

      console.log(
        "Dashboard: User is tutor, loading dashboard data via backend..."
      );

      try {
        const resp = await apiService.getTutorDashboard();
        // resp: { tutor, approved_subject_ids, opportunities, jobs }
        setTutorData(resp.tutor || null);
        setActiveJobs(resp.jobs || []);

        // Load subject approvals via dedicated endpoint
        try {
          const approvalsResp = await apiService.getTutorApprovals();
          const approvals = (approvalsResp.approvals || []).map((a: any) => ({
            id: `${a.subject_name}-${a.subject_type}-${a.subject_grade}`,
            subject: `${a.subject_name} • ${a.subject_type} • Grade ${a.subject_grade}`,
            status: a.status,
            approved_at: a.approved_at,
          }));
          setSubjectApprovals(approvals);
        } catch (e) {
          console.error("Error loading approvals:", e);
          setSubjectApprovals([]);
        }
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
      const {
        data: { session },
      } = await supabase.auth.getSession();
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/tutor/jobs/${jobId}/cancel`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session?.access_token}` },
        }
      );

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
            <div className="flex items-center gap-4 mb-3">
              <p className="text-gray-600">{tutorData?.school?.name}</p>
              <div className="flex items-center gap-2">
                {/* Status Pill with Particle Effects */}
                <div className="relative">
                  {/* Particle Effects Container */}
                  <div className="absolute inset-0 -m-2">
                    {/* Particle 1 */}
                    <div
                      className={`absolute w-1 h-1 rounded-full animate-ping ${
                        tutorData?.status === "active"
                          ? "bg-green-400"
                          : tutorData?.status === "pending"
                          ? "bg-yellow-400"
                          : "bg-red-400"
                      }`}
                      style={{ top: "25%", left: "25%", animationDelay: "0s" }}
                    ></div>
                    {/* Particle 2 */}
                    <div
                      className={`absolute w-1 h-1 rounded-full animate-ping ${
                        tutorData?.status === "active"
                          ? "bg-green-400"
                          : tutorData?.status === "pending"
                          ? "bg-yellow-400"
                          : "bg-red-400"
                      }`}
                      style={{
                        top: "75%",
                        right: "25%",
                        animationDelay: "0.5s",
                      }}
                    ></div>
                    {/* Particle 3 */}
                    <div
                      className={`absolute w-1 h-1 rounded-full animate-ping ${
                        tutorData?.status === "active"
                          ? "bg-green-400"
                          : tutorData?.status === "pending"
                          ? "bg-yellow-400"
                          : "bg-red-400"
                      }`}
                      style={{
                        bottom: "25%",
                        left: "50%",
                        animationDelay: "1s",
                      }}
                    ></div>
                    {/* Particle 4 */}
                    <div
                      className={`absolute w-1 h-1 rounded-full animate-ping ${
                        tutorData?.status === "active"
                          ? "bg-green-400"
                          : tutorData?.status === "pending"
                          ? "bg-yellow-400"
                          : "bg-red-400"
                      }`}
                      style={{
                        top: "50%",
                        right: "10%",
                        animationDelay: "1.5s",
                      }}
                    ></div>
                  </div>

                  {/* Main Status Pill */}
                  <div
                    className={`relative w-4 h-6 rounded-full ${
                      tutorData?.status === "active"
                        ? "bg-green-500 animate-pulse shadow-lg shadow-green-200"
                        : tutorData?.status === "pending"
                        ? "bg-yellow-500 animate-pulse shadow-lg shadow-yellow-200"
                        : "bg-red-500 animate-pulse shadow-lg shadow-red-200"
                    }`}
                  >
                    {/* Inner glow effect */}
                    <div
                      className={`absolute inset-0 rounded-full ${
                        tutorData?.status === "active"
                          ? "bg-green-400 opacity-50 animate-pulse"
                          : tutorData?.status === "pending"
                          ? "bg-yellow-400 opacity-50 animate-pulse"
                          : "bg-red-400 opacity-50 animate-pulse"
                      }`}
                      style={{ animationDelay: "0.3s" }}
                    ></div>
                  </div>
                </div>

                {/* Status Badge */}
                <div
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    tutorData?.status === "active"
                      ? "bg-green-100 text-green-800"
                      : tutorData?.status === "pending"
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {tutorData?.status === "active"
                    ? "Active Tutor"
                    : tutorData?.status === "pending"
                    ? "Pending Approval"
                    : tutorData?.status === "suspended"
                    ? "Account Suspended"
                    : "Status Unknown"}
                </div>
              </div>
            </div>
            {tutorData?.status !== "active" && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-blue-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-blue-800">
                      Account Status Notice
                    </h3>
                    <div className="mt-2 text-sm text-blue-700">
                      {tutorData?.status === "pending" && (
                        <p>
                          Your account is pending approval. You'll be able to
                          apply for tutoring opportunities once your account is
                          activated by an administrator.
                        </p>
                      )}
                      {tutorData?.status === "suspended" && (
                        <p>
                          Your account has been suspended. Please contact your
                          school administrator for more information.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white overflow-hidden border-2 border-gray-100 rounded-lg">
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

            <div className="bg-white overflow-hidden border-2 border-gray-100 rounded-lg">
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

            <div className="bg-white overflow-hidden border-2 border-gray-100 rounded-lg">
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
              Quick actions
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Request Certification Card */}
              <Link
                href={`/tutor/${tutorData?.id || "me"}/requestcert`}
                className="flex items-center p-6 bg-white border-2 border-blue-100 rounded-lg hover:border-blue-200 hover:bg-blue-50 transition-colors group"
              >
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                    <svg
                      className="w-6 h-6 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                      />
                    </svg>
                  </div>
                </div>
                <div className="ml-4 text-left">
                  <h4 className="text-lg font-medium text-gray-900 group-hover:text-blue-900">
                    Request Certification
                  </h4>
                  <p className="text-sm text-gray-500 group-hover:text-blue-700">
                    Get certified to teach subjects
                  </p>
                </div>
              </Link>

              {/* Browse Opportunities Card */}
              <Link
                href="/tutor/opportunities"
                className="flex items-center p-6 bg-white border-2 border-blue-100 rounded-lg hover:border-blue-200 hover:bg-blue-50 transition-colors group"
              >
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                    <svg
                      className="w-6 h-6 text-blue-600"
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
                  </div>
                </div>
                <div className="ml-4 text-left">
                  <h4 className="text-lg font-medium text-gray-900 group-hover:text-blue-900">
                    Browse Opportunities
                  </h4>
                  <p className="text-sm text-gray-500 group-hover:text-blue-700">
                    Find tutoring opportunities
                  </p>
                </div>
              </Link>
            </div>
          </div>

          {/* Active Jobs */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Active Tutoring Jobs
              </h3>
              {activeJobs.filter(
                (j: any) => j.status === "pending_tutor_scheduling"
              ).length > 0 && (
                <div className="bg-red-100 text-red-600 w-6 h-6 rounded-md text-xs font-medium flex items-center justify-center">
                  {
                    activeJobs.filter(
                      (j: any) => j.status === "pending_tutor_scheduling"
                    ).length
                  }
                </div>
              )}
            </div>
            {activeJobs.length > 0 ? (
              <div className="bg-white border-2 border-gray-100 overflow-hidden sm:rounded-md">
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
                          if (!expandedJobs.has(job.id)) {
                            // fetch details when expanding
                            loadJobDetails(job.id);
                          }
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="flex-shrink-0">
                              <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden">
                                <Image
                                  src={`/${getRandomFlowerIcon(job.id)}`}
                                  alt="Job icon"
                                  width={40}
                                  height={40}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {job.tutoring_opportunity?.subject_name
                                  ? `${job.tutoring_opportunity.subject_name} • ${job.tutoring_opportunity.subject_type} • Grade ${job.tutoring_opportunity.subject_grade}`
                                  : job.tutoring_opportunity?.subject?.name ||
                                    ""}
                                {job.tutoring_opportunity?.tutee
                                  ? ` - ${job.tutoring_opportunity.tutee.first_name} ${job.tutoring_opportunity.tutee.last_name}`
                                  : ""}
                              </div>
                              <div className="text-sm text-gray-500 flex items-center gap-2">
                                <span>
                                  {job.tutoring_opportunity
                                    ?.location_preference || ""}
                                </span>
                                <span
                                  className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                    job.status === "scheduled"
                                      ? "bg-green-100 text-green-800"
                                      : job.status ===
                                        "pending_tutor_scheduling"
                                      ? "bg-orange-100 text-orange-800"
                                      : job.status ===
                                        "pending_tutee_scheduling"
                                      ? "bg-red-100 text-red-800"
                                      : "bg-yellow-100 text-yellow-800"
                                  }`}
                                >
                                  {job.status === "pending_tutee_scheduling"
                                    ? "Waiting for Tutee to Schedule"
                                    : job.status === "pending_tutor_scheduling"
                                    ? "Waiting for Tutor (You) To Schedule"
                                    : job.status}
                                </span>
                              </div>
                              {job.scheduled_time ? (
                                <div className="text-xs text-gray-400 mt-1">
                                  Scheduled: {formatTime(job.scheduled_time)}
                                </div>
                              ) : (
                                <div className="text-xs text-gray-400 mt-1">
                                  {job.finalized_schedule
                                    ? "Weekly schedule set"
                                    : "No weekly schedule yet"}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {/* Action buttons moved from expanded section */}
                            {job.status === "pending_tutor_scheduling" && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/tutor/scheduling/${job.id}`);
                                }}
                                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-full w-25 h-10 items-center justify-center font-medium text-blue-600 bg-blue-100 hover:bg-blue-200 cursor-pointer"
                              >
                                Schedule
                              </button>
                            )}
                            {job.status === "pending_tutee_scheduling" && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCancelJob(job.id, job.opportunity_id);
                                }}
                                disabled={cancellingJobId === job.id}
                                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-full text-red-600 bg-red-100 w-25 items-center justify-center font-medium cursor-pointer h-10 hover:bg-red-200"
                              >
                                {cancellingJobId === job.id
                                  ? "Cancelling..."
                                  : "Cancel"}
                              </button>
                            )}
                            {job.status === "scheduled" && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowRecordingModalFor(job.id);
                                }}
                                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-full text-purple-600 bg-purple-100 hover:bg-purple-200 w-35 items-center justify-center h-10"
                              >
                                Upload Recording
                              </button>
                            )}
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
                          <div className="mt-4 pt-4 border-t border-gray-100">
                            <div className="grid grid-cols-1 gap-4">
                              <div>
                                <h4 className="text-sm font-medium text-gray-700 mb-2">
                                  Tutee Details
                                </h4>
                                <div className="text-sm text-gray-600 space-y-1">
                                  <p>
                                    <span className="font-medium">Name:</span>{" "}
                                    {job.tutoring_opportunity?.tutee_name ||
                                      (job.tutee?.first_name &&
                                      job.tutee?.last_name
                                        ? `${job.tutee.first_name} ${job.tutee.last_name}`
                                        : "—")}
                                  </p>
                                  <p>
                                    <span className="font-medium">Email:</span>{" "}
                                    {job.tutoring_opportunity?.tutee_email ||
                                      job.tutee?.email ||
                                      "—"}
                                  </p>
                                  <p>
                                    <span className="font-medium">Grade:</span>{" "}
                                    {(() => {
                                      const gy =
                                        job.tutoring_opportunity
                                          ?.tutee_graduation_year ||
                                        job.tutee?.graduation_year;
                                      if (gy) {
                                        const current =
                                          new Date().getFullYear();
                                        const g = 12 - (Number(gy) - current);
                                        return isFinite(g) ? g : "—";
                                      }
                                      return "—";
                                    })()}
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
                                    {job.tutoring_opportunity?.subject_name
                                      ? `${job.tutoring_opportunity.subject_name} • ${job.tutoring_opportunity.subject_type} • Grade ${job.tutoring_opportunity.subject_grade}`
                                      : job.subject_name
                                      ? `${job.subject_name} • ${job.subject_type} • Grade ${job.subject_grade}`
                                      : ""}
                                  </p>
                                  <p>
                                    <span className="font-medium">
                                      Language:
                                    </span>{" "}
                                    {job.language ||
                                      job.tutoring_opportunity?.language ||
                                      "English"}
                                  </p>
                                  <p>
                                    <span className="font-medium">
                                      Location:
                                    </span>{" "}
                                    {job.tutoring_opportunity
                                      ?.location_preference ||
                                      job.location ||
                                      "—"}
                                  </p>
                                  {job.additional_notes ||
                                  job.tutoring_opportunity?.additional_notes ? (
                                    <p>
                                      <span className="font-medium">
                                        Additional notes:
                                      </span>{" "}
                                      <span className="whitespace-pre-wrap break-words">
                                        {job.additional_notes ||
                                          job.tutoring_opportunity
                                            ?.additional_notes}
                                      </span>
                                    </p>
                                  ) : null}
                                  {job.scheduled_time ? (
                                    <p>
                                      <span className="font-medium">
                                        Scheduled Time:
                                      </span>{" "}
                                      {formatTime(job.scheduled_time)}
                                    </p>
                                  ) : null}
                                  {/* Status omitted here; shown in header badge */}
                                </div>
                              </div>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                              {job.status === "scheduled" && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // disabled until a recording link is provided via modal
                                  }}
                                  disabled
                                  className="inline-flex items-center px-4 py-1.5 border border-transparent text-xs font-medium rounded-full h-10 text-green-600 bg-green-100  cursor-not-allowed"
                                >
                                  Complete Session
                                </button>
                              )}

                              {job.status === "awaiting_admin_verification" && (
                                <span className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded bg-yellow-100 text-yellow-800">
                                  Pending Verification
                                </span>
                              )}
                              {/* Schedule and Cancel buttons moved to main row */}
                              {/* Contact Tutee button removed per requirements */}
                              {job.status === "scheduled" && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCancelJob(job.id, job.opportunity_id);
                                  }}
                                  disabled={cancellingJobId === job.id}
                                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-full text-red-600 bg-red-100 hover:bg-red-700 disabled:bg-red-300"
                                >
                                  {cancellingJobId === job.id
                                    ? "Cancelling..."
                                    : "Cancel Job"}
                                </button>
                              )}
                            </div>
                            {/* Weekly schedule details removed per requirements */}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="text-center py-8 bg-white rounded-lg border-2 border-gray-100">
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
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Browse Opportunities
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Past Jobs */}
          <div className="mb-8">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Past Jobs
            </h3>
            {pastJobs.length > 0 ? (
              <div className="bg-white border-2 border-gray-100 overflow-hidden sm:rounded-md">
                <ul className="divide-y divide-gray-200">
                  {pastJobs.map((job) => (
                    <li key={job.id} className="px-4 py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {job.subject_name} • {job.subject_type} • Grade{" "}
                            {job.subject_grade}
                          </div>
                          <div className="text-xs text-gray-500">
                            {job.scheduled_time
                              ? new Date(job.scheduled_time).toLocaleString()
                              : ""}{" "}
                            •{" "}
                            {job.duration_minutes
                              ? `${job.duration_minutes} minutes`
                              : ""}
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="text-center py-8 bg-white rounded-lg border-2 border-gray-100">
                <h4 className="text-sm font-medium text-gray-900">
                  No past jobs
                </h4>
                <p className="text-sm text-gray-500">
                  Completed and verified jobs will show up here.
                </p>
              </div>
            )}
          </div>

          {/* Subject Approvals */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Subject Approvals
            </h3>
            {subjectApprovals.length > 0 ? (
              <div className="bg-white border-2 border-gray-100 overflow-hidden sm:rounded-md">
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
              <div className="text-center py-8 bg-white rounded-lg border-2 border-gray-200">
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
                  Contact your school administrator to get approved for subjects
                  you can tutor.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      {showRecordingModalFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowRecordingModalFor(null)}
          ></div>
          <div className="relative bg-white rounded-lg border-2 border-gray-200 w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-2">
              Upload Session Recording Link
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Paste the URL to your session recording. You can edit this until
              you mark the session as completed.
            </p>
            <input
              type="url"
              placeholder="https://..."
              value={recordingUrlInput}
              onChange={(e) => setRecordingUrlInput(e.target.value)}
              className="w-full border rounded px-3 py-2 mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                className="px-3 py-1.5 border rounded"
                onClick={() => setShowRecordingModalFor(null)}
              >
                Cancel
              </button>
              <button
                className="px-3 py-1.5 bg-purple-600 text-white rounded"
                onClick={async () => {
                  try {
                    if (!recordingUrlInput) return;
                    await apiService.upsertRecordingLink(
                      showRecordingModalFor,
                      recordingUrlInput
                    );
                    // After link saved, allow completion
                    await apiService.completeJob(showRecordingModalFor, {});
                    setShowRecordingModalFor(null);
                    setRecordingUrlInput("");
                    // Remove job from active list
                    setActiveJobs((prev) =>
                      prev.filter((j) => j.id !== showRecordingModalFor)
                    );
                    setSuccessMessage(
                      "Recording link saved and session moved to awaiting verification."
                    );
                  } catch (e: any) {
                    console.error("Complete job error:", e);
                    setError(
                      e?.message || "Failed to save recording link or complete session."
                    );
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
