"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/app/providers";
import { supabase } from "@/services/supabase";
import { TutorLayout } from "@/components/tutor-layout";
import apiService from "@/services/api";

interface TutoringOpportunity {
  id: string;
  tutee?: { id: string; first_name: string; last_name: string; email: string; school_id?: string };
  subject?: { id: string; name: string; category?: string; grade_level?: string };
  grade_level?: string;
  sessions_per_week?: number;
  availability?: any;
  location_preference?: string;
  additional_notes?: string;
  status: "open" | "assigned" | "completed" | "cancelled";
  priority: "normal" | "high" | "low";
  created_at: string;
}

interface TutorData {
  id: string;
  school_id: string;
  school: {
    name: string;
  };
}

interface SubjectApproval {
  subject: string;
  status: "approved" | "pending" | "denied";
}

export default function OpportunitiesPage() {
  const { user, userRole, signOut, isLoading: authLoading } = useAuth();
  const [opportunities, setOpportunities] = useState<TutoringOpportunity[]>([]);
  const [tutorData, setTutorData] = useState<TutorData | null>(null);
  const [approvedSubjects, setApprovedSubjects] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applyingTo, setApplyingTo] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const router = useRouter();

  // Function to get a random shape image based on opportunity ID for consistency
  const getRandomShapeImage = (opportunityId: string) => {
    const shapeImages = [
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

    // Use opportunity ID to create a consistent hash for the same opportunity
    let hash = 0;
    for (let i = 0; i < opportunityId.length; i++) {
      const char = opportunityId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    // Get a consistent index based on the hash
    const index = Math.abs(hash) % shapeImages.length;
    return shapeImages[index];
  };

  useEffect(() => {
    const fetchData = async () => {
      if (authLoading) return;

      if (!user) {
        console.log("Opportunities: No user found, redirecting to login");
        router.push("/auth/login");
        return;
      }

      if (userRole !== "tutor") {
        console.log("Opportunities: User is not tutor, redirecting");
  if (userRole === "admin") {
          router.push("/admin/dashboard");
        } else {
          router.push("/auth/login");
        }
        return;
      }

      try {
        // Fetch tutor data
        // Fetch tutor via backend profile endpoint
        const { data: { session } } = await supabase.auth.getSession();
        const profResp = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tutor/profile`, {
          headers: { 'Authorization': `Bearer ${session?.access_token ?? ''}` }
        });
        if (!profResp.ok) { setError('Failed to load tutor data'); return; }
        const profJson = await profResp.json();
        const tutor = profJson.tutor;

        setTutorData(tutor);

        // Fetch approved subjects for this tutor
        try {
          // First get the approvals
          const apprResp = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tutor/approvals`, {
            headers: { 'Authorization': `Bearer ${session?.access_token ?? ''}` }
          });
          if (!apprResp.ok) throw new Error('approvals failed');
          const apprJson = await apprResp.json();
          const subjectTriples = apprJson.approved_subjects || [];
          setApprovedSubjects(subjectTriples);
        } catch (approvalErr) {
          console.error("Exception fetching subject approvals:", approvalErr);
          setApprovedSubjects([]);
        }

        // Fetch ALL open tutoring opportunities (relational shape)
        const oppResp = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tutor/opportunities`, {
          headers: { 'Authorization': `Bearer ${session?.access_token ?? ''}` }
        });
        if (!oppResp.ok) { setError('Failed to load opportunities'); }
        const oppJson = await oppResp.json();
        setOpportunities(oppJson.opportunities || []);
      } catch (err: any) {
        console.error("Error in fetchData:", err);
        setError("An unexpected error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user, userRole, authLoading, router]);

  const handleApply = async (opportunityId: string) => {
    if (!tutorData) return;

    setApplyingTo(opportunityId);
    setError(null); // Clear any previous errors

    try {
      // Create a tutoring job (assignment)
      // Create job and assign via backend
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tutor/opportunities/${opportunityId}/apply`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token ?? ''}` }
      });
      if (!resp.ok) { setError('Failed to apply'); setApplyingTo(null); return; }
      const job = (await resp.json()).job;

      // Job assignment email will be sent after tutor finalizes schedule

      // Remove the opportunity from the list
      setOpportunities((prev) =>
        prev.filter((opp) => opp.id !== opportunityId)
      );

      // Redirect back to tutor dashboard (tutee must set availability first)
      router.push('/dashboard');
    } catch (err) {
      console.error("Error applying for opportunity:", err);
      setError("An error occurred while applying");
      // Don't redirect on error
      return;
    } finally {
      // Always clear the loading state
      setApplyingTo(null);
    }
  };

  const canApplyForSubject = (
    subject: string,
    gradeLevel: string,
    courseLevel: string
  ) => {
    // Create the combined string from opportunity fields (Subject Grade Course)
    const opportunityString = [subject, gradeLevel, courseLevel]
      .filter(Boolean) // Remove empty/null values
      .join(" ")
      .trim();

    // Debug what's being compared
    console.log("Checking if can apply for:", {
      subject,
      gradeLevel,
      courseLevel,
      combined: opportunityString,
    });
    console.log("Approved subjects:", approvedSubjects);

    // Check if any approved subject name matches the combined opportunity string
    return approvedSubjects.some((approvedSubjectName) => {
      const normalizedApproved = approvedSubjectName.toLowerCase().trim();
      const normalizedOpportunity = opportunityString.toLowerCase().trim();

      console.log(
        `Comparing: "${normalizedApproved}" vs "${normalizedOpportunity}"`
      );

      // Exact match comparison
      return normalizedApproved === normalizedOpportunity;
    });
  };

  const toggleRowExpansion = (opportunityId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(opportunityId)) {
      newExpanded.delete(opportunityId);
    } else {
      newExpanded.add(opportunityId);
    }
    setExpandedRows(newExpanded);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const refreshed = await apiService.listOpenOpportunities();
      setOpportunities(refreshed.opportunities || []);
    } catch (err) {
      console.error("Error refreshing opportunities:", err);
      alert("Failed to refresh opportunities. Please try again.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSignOut = async () => {
    console.log("Opportunities: Starting sign out...");
    await signOut();
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

  // Helper function to format date in "Month Day, Year" format
  const formatDate = (dateString: string) => {
    if (!dateString) return "";

    try {
      // If dateString is "YYYY-MM-DD", parse it as local date to avoid timezone issues
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        const [year, month, day] = dateString.split("-").map(Number);
        const date = new Date(year, month - 1, day); // month is 0-indexed
        return date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      }

      // Fallback for other date formats
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch (err) {
      console.error("Error formatting date:", err);
      return dateString; // Return original if parsing fails
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading opportunities...</p>
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
      <div className="p-3 sm:p-6 bg-white min-h-full">
        <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
          {/* Page header with refresh button */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mt-10">
                Tutoring Opportunities
              </h1>
              <div className="flex items-center gap-2 text-gray-600 mt-1">
                <span>
                  {tutorData?.school?.name} • {opportunities.length}{" "}
                  opportunities available
                </span>
                <div className="flex items-center gap-1 ml-4">
                  <div className="relative">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <div className="absolute inset-0 w-2 h-2 bg-green-400 rounded-full animate-ping"></div>
                  </div>
                  <span className="text-xs text-green-600 font-medium">
                    UPDATED
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg
                className={`-ml-0.5 mr-2 h-4 w-4 ${
                  isRefreshing ? "animate-spin" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {/* Opportunities table */}
          {opportunities.length > 0 ? (
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-0">
                        Subject
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-0">
                        Student
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-0 hidden sm:table-cell">
                        School
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-0 hidden md:table-cell">
                        Date
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-0 hidden lg:table-cell">
                        Time
                      </th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-0">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {opportunities.map((opportunity) => (
                      <>
                        {/* Main row */}
                        <tr
                          key={opportunity.id}
                          onClick={() => toggleRowExpansion(opportunity.id)}
                        >
                          <td className="px-3 py-4">
                            <div className="flex items-center gap-4">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0">
                                <img
                                  src={`/${getRandomShapeImage(
                                    opportunity.id
                                  )}`}
                                  alt="Profile"
                                  className="w-8 h-8 object-contain"
                                />
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <div className="text-sm font-medium text-gray-900 truncate">
                                   {opportunity.subject_name} • {opportunity.subject_type} • Grade {opportunity.subject_grade}
                                  </div>
                                  {opportunity.priority === "high" && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                      High Priority
                                    </span>
                                  )}
                                </div>
                                
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-4">
                             <div className="text-sm text-gray-900 truncate">
                              {opportunity.tutee_first_name ?? ''} {opportunity.tutee_last_name ?? ''}
                             </div>
                            {opportunity.tutee_pronouns && (
                              <div className="text-xs text-gray-500 truncate">
                                ({opportunity.tutee_pronouns})
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-4 hidden sm:table-cell">
                             <div className="text-sm text-gray-900 truncate">{tutorData?.school?.name || ""}</div>
                          </td>
                          <td className="px-3 py-4 hidden md:table-cell">
                            <div className="text-sm text-gray-900">
                              {opportunity.availability_date
                                ? formatDate(opportunity.availability_date)
                                : "Not specified"}
                            </div>
                          </td>
                          <td className="px-3 py-4 hidden lg:table-cell">
                            {opportunity.availability_start_time &&
                            opportunity.availability_end_time ? (
                              <div className="inline-flex items-center">
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                                  {formatTime(
                                    opportunity.availability_start_time
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
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                                  {formatTime(
                                    opportunity.availability_end_time
                                  )}
                                </span>
                              </div>
                            ) : (
                              <div className="text-sm text-gray-500">
                                Not specified
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-4 text-right text-sm font-medium">
                            <div className="flex items-center justify-end space-x-1">
                              {approvedSubjects.some(a => a.subject_name === opportunity.subject_name && a.subject_type === opportunity.subject_type && String(a.subject_grade) === String(opportunity.subject_grade)) ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleApply(opportunity.id);
                                  }}
                                  disabled={applyingTo === opportunity.id}
                                  className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-full text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
                                >
                                  {applyingTo === opportunity.id
                                    ? "Applying..."
                                    : "Apply"}
                                </button>
                              ) : (
                                <button
                                  disabled
                                  className="inline-flex items-center px-2 py-1.5 text-xs font-medium rounded-full text-gray-500 bg-gray-100 cursor-not-allowed"
                                >
                                  Not Approved
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleRowExpansion(opportunity.id);
                                }}
                                className="text-gray-400 hover:text-gray-600 p-1"
                              >
                                <svg
                                  className={`w-4 h-4 transform transition-transform ${
                                    expandedRows.has(opportunity.id)
                                      ? "rotate-180"
                                      : ""
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
                          </td>
                        </tr>

                        {/* Expanded details row */}
                        {expandedRows.has(opportunity.id) && (
                          <tr>
                            <td colSpan={6} className="px-3 py-4 bg-white">
                              <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <div>
                                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                                      Student Details
                                    </h4>
                                    <div className="text-sm text-gray-600 space-y-1">
                                      <p>
                                        <span className="font-medium">
                                          Name:
                                        </span>{" "}
                                        {opportunity.tutee_first_name}{" "}
                                        {opportunity.tutee_last_name}
                                      </p>
                                      {opportunity.tutee_pronouns && (
                                        <p>
                                          <span className="font-medium">
                                            Pronouns:
                                          </span>{" "}
                                          {opportunity.tutee_pronouns}
                                        </p>
                                      )}
                                      <p>
                                        <span className="font-medium">
                                          Grade:
                                        </span>{" "}
                                        Grade {opportunity.grade_level}
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
                                        {opportunity.subject}
                                      </p>
                                      <p>
                                        <span className="font-medium">
                                          Specific Topic:
                                        </span>{" "}
                                        {opportunity.specific_topic}
                                      </p>
                                      <p>
                                        <span className="font-medium">
                                          Course Level:
                                        </span>{" "}
                                        {opportunity.course_level}
                                      </p>
                                    </div>
                                  </div>
                                  <div>
                                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                                      Availability
                                    </h4>
                                    <div className="text-sm text-gray-600 space-y-1">
                                      <p>
                                        <span className="font-medium">
                                          Date:
                                        </span>{" "}
                                        {opportunity.availability_date
                                          ? formatDate(
                                              opportunity.availability_date
                                            )
                                          : "Not specified"}
                                      </p>
                                      <p>
                                        <span className="font-medium">
                                          Time:
                                        </span>
                                      </p>
                                      <div className="mt-2">
                                        {opportunity.availability_formatted ? (
                                          <span className="inline-flex items-center">
                                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                                              {formatTime(
                                                opportunity.availability_start_time
                                              )}
                                            </span>
                                            <svg
                                              className="w-4 h-4 mx-1 text-gray-500"
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
                                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                                              {formatTime(
                                                opportunity.availability_end_time
                                              )}
                                            </span>
                                          </span>
                                        ) : (
                                          "Not specified"
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div className="pt-2 border-t border-gray-200">
                                  <div className="text-xs text-gray-500">
                                    Posted:{" "}
                                    {new Date(
                                      opportunity.created_at
                                    ).toLocaleDateString()}{" "}
                                    at{" "}
                                    {new Date(
                                      opportunity.created_at
                                    ).toLocaleTimeString()}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-lg shadow">
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
                No opportunities available
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                There are currently no tutoring opportunities available for your
                school.
              </p>
              <div className="mt-6">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Back to Dashboard
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </TutorLayout>
  );
}
