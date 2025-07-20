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
  school: string;
  tutee_first_name: string;
  tutee_last_name: string;
  tutee_pronouns: string;
  tutee_email: string;
  grade_level: string;
  subject: string;
  specific_topic: string;
  course_level: string;
  urgency_level: number;
  session_location: string;
  availability_date: string;
  availability_start_time: string;
  availability_end_time: string;
  availability_formatted: string;
  status: "open" | "assigned" | "completed" | "cancelled";
  priority: "normal" | "high";
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
        if (userRole === "admin" || userRole === "superadmin") {
          router.push("/admin/dashboard");
        } else {
          router.push("/auth/login");
        }
        return;
      }

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

        // Fetch approved subjects for this tutor
        try {
          // First get the approvals
          const { data: approvals, error: approvalsError } = await supabase
            .from("subject_approvals")
            .select("*")
            .eq("tutor_id", tutor.id)
            .eq("status", "approved");

          if (approvalsError) {
            console.error(
              "Error fetching subject approvals:",
              approvalsError.message
            );
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
                } else {
                  // Extract subject names for approval checking
                  const subjectNames = subjects?.map((s) => s.name) || [];
                  console.log("Approved subjects:", subjectNames);
                  setApprovedSubjects(subjectNames);
                }
              }
            } else {
              setApprovedSubjects([]);
            }
          }
        } catch (approvalErr) {
          console.error("Exception fetching subject approvals:", approvalErr);
          setApprovedSubjects([]);
        }

        // Fetch ALL open tutoring opportunities (not filtered by school)
        const { data: opps, error: oppsError } = await supabase
          .from("tutoring_opportunities")
          .select("*")
          .eq("status", "open")
          .order("priority", { ascending: false }) // High priority first
          .order("created_at", { ascending: true }); // Oldest first within same priority

        if (oppsError) {
          console.error("Error fetching opportunities:", oppsError);
          setError("Failed to load opportunities");
        } else {
          setOpportunities(opps || []);
        }
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

    try {
      // Create a tutoring job (assignment)
      const { data: job, error: jobError } = await supabase
        .from("tutoring_jobs")
        .insert({
          opportunity_id: opportunityId,
          tutor_id: tutorData.id,
          status: "scheduled", // Changed from 'pending' to match the database constraint
        })
        .select()
        .single();

      if (jobError) {
        console.error("Error creating tutoring job:", jobError);
        setError("Failed to apply for this opportunity. Please try again.");
        return;
      }

      // Update the opportunity status to assigned
      const { error: updateError } = await supabase
        .from("tutoring_opportunities")
        .update({ status: "assigned" })
        .eq("id", opportunityId);

      if (updateError) {
        console.error("Error updating opportunity status:", updateError);
        // Try to delete the job if opportunity update fails
        await supabase.from("tutoring_jobs").delete().eq("id", job.id);

        setError("Failed to update opportunity status");
        return;
      }

      // Send job assignment notification email
      try {
        const opportunity = opportunities.find(opp => opp.id === opportunityId);
        if (opportunity) {
          // Get tutor's full name from auth user or construct from available data
          const tutorName = user?.user_metadata?.full_name || 
                           `${user?.user_metadata?.first_name || ''} ${user?.user_metadata?.last_name || ''}`.trim() ||
                           user?.email?.split('@')[0] || 'Tutor';
          
          await apiService.sendJobAssignmentNotification(
            user?.email || '',
            tutorName,
            {
              subject: opportunity.subject,
              tutee_name: `${opportunity.tutee_first_name} ${opportunity.tutee_last_name}`,
              grade_level: opportunity.grade_level,
              location: opportunity.session_location
            },
            job.id
          );
          console.log('Job assignment notification sent successfully');
        }
      } catch (emailError) {
        console.error('Failed to send job assignment notification:', emailError);
        // Don't fail the entire process if email fails - this is expected in development
        console.log('Email sending failed (expected in development mode) - continuing with job application');
      }

      // Remove the opportunity from the list
      setOpportunities((prev) =>
        prev.filter((opp) => opp.id !== opportunityId)
      );

      // Redirect to scheduling interface
      router.push(`/scheduling/${job.id}`);
    } catch (err) {
      console.error("Error applying for opportunity:", err);
      setError("An error occurred while applying");
    } finally {
      setApplyingTo(null);
    }
  };

  const canApplyForSubject = (subject: string) => {
    // Debug what's being compared
    console.log("Checking if can apply for:", subject);
    console.log("Approved subjects:", approvedSubjects);

    // More flexible matching - check if any approved subject contains this subject or vice versa
    // This handles cases like "Physics" vs "Grade 11 IB Physics"
    return approvedSubjects.some(
      (approved) =>
        approved.toLowerCase().includes(subject.toLowerCase()) ||
        subject.toLowerCase().includes(approved.toLowerCase())
    );
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
      // Fetch fresh opportunities data
      const { data: opps, error: oppsError } = await supabase
        .from("tutoring_opportunities")
        .select("*")
        .eq("status", "open")
        .order("priority", { ascending: false }) // High priority first
        .order("created_at", { ascending: true }); // Oldest first within same priority

      if (oppsError) {
        console.error("Error refreshing opportunities:", oppsError);
        alert("Failed to refresh opportunities. Please try again.");
      } else {
        setOpportunities(opps || []);
        console.log("Opportunities refreshed successfully");
      }
    } catch (err) {
      console.error("Error refreshing opportunities:", err);
      alert("An error occurred while refreshing. Please try again.");
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading opportunities...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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
      <div className="p-6 bg-gray-50 min-h-full">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Page header with refresh button */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Tutoring Opportunities
              </h1>
              <p className="text-gray-600 mt-1">
                {tutorData?.school?.name} • {opportunities.length} opportunities
                available
              </p>
              {approvedSubjects.length > 0 && (
                <p className="text-sm text-gray-500 mt-2">
                  You're approved for: {approvedSubjects.join(", ")}
                </p>
              )}
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
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Subject
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Student
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      School
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Available Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Available Time
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
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
                        className={`my-10 cursor-pointer ${
                          opportunity.priority === "high"
                            ? "border-l-4 border-orange-500"
                            : ""
                        }`}
                        onClick={() => toggleRowExpansion(opportunity.id)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-5">
                            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center mr-3">
                              <span className="text-white font-bold text-sm">
                                {opportunity.subject.charAt(0)}
                              </span>
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {opportunity.subject}
                              </div>
                              {opportunity.grade_level && (
                                <div className="text-sm text-gray-500">
                                  {opportunity.grade_level}
                                </div>
                              )}
                            </div>
                            {opportunity.priority === "high" && (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                High Priority
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {opportunity.tutee_first_name}{" "}
                            {opportunity.tutee_last_name}
                          </div>
                          {opportunity.tutee_pronouns && (
                            <div className="text-xs text-gray-500">
                              ({opportunity.tutee_pronouns})
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {opportunity.school || "Not specified"}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {opportunity.availability_date
                              ? formatDate(opportunity.availability_date)
                              : "Not specified"}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
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
                                {formatTime(opportunity.availability_end_time)}
                              </span>
                            </div>
                          ) : (
                            <div className="text-sm text-gray-500">
                              Not specified
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
                            {canApplyForSubject(opportunity.subject) ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleApply(opportunity.id);
                                }}
                                disabled={applyingTo === opportunity.id}
                                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
                              >
                                {applyingTo === opportunity.id
                                  ? "Applying..."
                                  : "Apply"}
                              </button>
                            ) : (
                              <button
                                disabled
                                className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-500 bg-gray-100 cursor-not-allowed"
                              >
                                Not Approved
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleRowExpansion(opportunity.id);
                              }}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <svg
                                className={`w-5 h-5 transform transition-transform ${
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
                          <td colSpan={6} className="px-6 py-4 bg-gray-50">
                            <div className="space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                                    Student Details
                                  </h4>
                                  <div className="text-sm text-gray-600 space-y-1">
                                    <p>
                                      <span className="font-medium">Name:</span>{" "}
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
                                      <span className="font-medium">Date:</span>{" "}
                                      {opportunity.availability_date ||
                                        "Not specified"}
                                    </p>
                                    <p>
                                      <span className="font-medium">Time:</span>
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

                              <div className="flex justify-between items-center pt-2 border-t border-gray-200">
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
                                {canApplyForSubject(opportunity.subject) ? (
                                  <button
                                    onClick={() => handleApply(opportunity.id)}
                                    disabled={applyingTo === opportunity.id}
                                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
                                  >
                                    {applyingTo === opportunity.id
                                      ? "Applying..."
                                      : "Apply for this Opportunity"}
                                  </button>
                                ) : (
                                  <div className="text-center">
                                    <div className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-500 bg-gray-100 cursor-not-allowed">
                                      Not Approved for {opportunity.subject}
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1">
                                      Contact admin for subject approval
                                    </p>
                                  </div>
                                )}
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
