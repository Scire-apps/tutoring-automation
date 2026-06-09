export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json, notFound, forbidden, serverError } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import { isApprovedForOpportunity } from "@/lib/domain";
import { sendAvailabilityNotification, siteUrl } from "@/lib/email";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ opportunityId: string }> }
) {
  const { opportunityId } = await ctx.params;

  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const supabase = auth.supabase;

  // Get tutor and enforce active status
  const tutorResult = await supabase
    .from("tutors")
    .select("id, status, approved_subject_ids")
    .eq("auth_id", auth.userId)
    .maybeSingle();
  if (!tutorResult.data) {
    return notFound("Tutor profile not found");
  }
  const tutor: any = tutorResult.data;
  if (String(tutor.status || "").toLowerCase() !== "active") {
    return json(
      {
        error: "tutor_not_active",
        message: "Your account must be active to accept opportunities.",
      },
      403
    );
  }

  // Get opportunity
  const oppResult = await supabase
    .from("tutoring_opportunities")
    .select("*")
    .eq("id", opportunityId)
    .maybeSingle();
  if (!oppResult.data) {
    return notFound("Opportunity not found");
  }
  const opp: any = oppResult.data;

  // Check subject approval strictly via subject_approvals (embedded fields)
  const subjName = opp.subject_name;
  const subjType = opp.subject_type;
  const subjGrade = opp.subject_grade;

  const approvalsRes = await supabase
    .from("subject_approvals")
    .select("*")
    .eq("tutor_id", tutor.id)
    .eq("subject_type", subjType)
    .eq("subject_grade", String(subjGrade))
    .eq("status", "approved");

  if (!isApprovedForOpportunity(approvalsRes.data || [], subjName)) {
    return forbidden("Not approved for this subject");
  }

  // Create job (single-session, pending tutee scheduling)
  // Enrich snapshot with student's grade for easy UI rendering later
  const opportunitySnapshot: any = { ...opp };
  try {
    if (opp.tutee_id) {
      const tuteeGradeRow = await supabase
        .from("tutees")
        .select("grade")
        .eq("id", opp.tutee_id)
        .maybeSingle();
      if (tuteeGradeRow && tuteeGradeRow.data) {
        opportunitySnapshot.tutee_grade = (tuteeGradeRow.data as any).grade;
      }
    }
  } catch {
    // best-effort
  }

  const jobInsert: any = {
    opportunity_id: opp.id,
    tutor_id: tutor.id,
    tutee_id: opp.tutee_id,
    subject_name: subjName,
    subject_type: subjType,
    subject_grade: String(subjGrade),
    language: opp.language || "English",
    location: opp.location_preference,
    additional_notes: opp.additional_notes,
    opportunity_snapshot: opportunitySnapshot,
    status: "pending_tutee_scheduling",
  };

  const jobRes = await supabase
    .from("tutoring_jobs")
    .insert(jobInsert)
    .select();
  if (!jobRes.data || jobRes.data.length === 0) {
    return serverError("Failed to create job");
  }

  // Get tutor and (if permitted) tutee information for email notification
  let tutorInfo: any = null;
  try {
    const r = await supabase
      .from("tutors")
      .select("first_name, last_name")
      .eq("id", tutor.id)
      .maybeSingle();
    tutorInfo = r.data;
  } catch {
    tutorInfo = null;
  }
  let tuteeInfo: any = null;
  try {
    const r = await supabase
      .from("tutees")
      .select("email, first_name, last_name")
      .eq("id", opp.tutee_id)
      .maybeSingle();
    tuteeInfo = r.data;
  } catch {
    tuteeInfo = null;
  }

  // Send email notification to tutee when possible
  if (tutorInfo && tuteeInfo) {
    try {
      const tutorName = `${tutorInfo.first_name || ""} ${tutorInfo.last_name || ""}`.trim();
      const tuteeName = `${tuteeInfo.first_name || ""} ${tuteeInfo.last_name || ""}`.trim();
      const tuteeEmail = tuteeInfo.email;
      const dashboardUrl = `${siteUrl()}/tutee/dashboard`;
      await sendAvailabilityNotification(
        tuteeEmail,
        tuteeName,
        tutorName,
        subjName,
        dashboardUrl
      );
    } catch {
      // email is best-effort
    }
  }

  // After job creation, remove the opportunity from the pool (best-effort)
  try {
    const delRes = await supabase
      .from("tutoring_opportunities")
      .delete()
      .eq("id", opportunityId);
    if (delRes.error) {
      // Fallback: mark as assigned if deletion not permitted
      try {
        await supabase
          .from("tutoring_opportunities")
          .update({ status: "assigned" })
          .eq("id", opportunityId);
      } catch {
        // best-effort
      }
    }
  } catch {
    try {
      await supabase
        .from("tutoring_opportunities")
        .update({ status: "assigned" })
        .eq("id", opportunityId);
    } catch {
      // best-effort
    }
  }

  return json({ message: "Job created", job: jobRes.data[0] }, 201);
}
