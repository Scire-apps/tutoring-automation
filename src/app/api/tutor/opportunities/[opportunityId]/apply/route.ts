export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json, notFound, serverError } from "@/lib/http";
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

  const tutorRes = await supabase
    .from("tutors")
    .select("id, status")
    .eq("auth_id", auth.userId)
    .maybeSingle();
  if (!tutorRes.data) {
    return notFound("Tutor not found");
  }
  // Enforce active-only tutors can apply
  if (String((tutorRes.data as any).status || "").toLowerCase() !== "active") {
    return json(
      {
        error: "tutor_not_active",
        message: "Your account must be active to apply for opportunities.",
      },
      403
    );
  }
  const tutorId = (tutorRes.data as any).id;

  // Verify subject approval first using embedded fields
  const oppRes = await supabase
    .from("tutoring_opportunities")
    .select(
      "subject_name, subject_type, subject_grade, tutee_id, language, location_preference, additional_notes"
    )
    .eq("id", opportunityId)
    .maybeSingle();
  if (!oppRes.data) {
    return notFound("Opportunity not found");
  }
  const oppData: any = oppRes.data;
  const subjName = oppData.subject_name;
  const subjType = oppData.subject_type;
  const subjGrade = String(oppData.subject_grade);

  const approvalsRes = await supabase
    .from("subject_approvals")
    .select("*")
    .eq("tutor_id", tutorId)
    .eq("subject_type", subjType)
    .eq("subject_grade", subjGrade)
    .eq("status", "approved");

  if (!isApprovedForOpportunity(approvalsRes.data || [], subjName)) {
    return json({ error: "Not approved for this subject" }, 403);
  }

  // Create job and move to pending tutee scheduling; snapshot the opportunity
  // so we can surface details later even after deleting the opportunity row.
  const opportunitySnapshot: any = { ...oppData };
  try {
    if (oppData.tutee_id) {
      const tuteeGradeRow = await supabase
        .from("tutees")
        .select("grade")
        .eq("id", oppData.tutee_id)
        .maybeSingle();
      if (tuteeGradeRow && tuteeGradeRow.data) {
        opportunitySnapshot.tutee_grade = (tuteeGradeRow.data as any).grade;
      }
    }
  } catch {
    // best-effort
  }

  const jobIns = await supabase
    .from("tutoring_jobs")
    .insert({
      opportunity_id: opportunityId,
      tutor_id: tutorId,
      tutee_id: oppData.tutee_id,
      subject_name: subjName,
      subject_type: subjType,
      subject_grade: subjGrade,
      language: oppData.language || "English",
      location: oppData.location_preference,
      additional_notes: oppData.additional_notes,
      opportunity_snapshot: opportunitySnapshot,
      status: "pending_tutee_scheduling",
    } as any)
    .select();
  if (!jobIns.data || jobIns.data.length === 0) {
    return serverError("Failed to create job");
  }

  // Get tutor and (if permitted) tutee information for email notification
  let tutorInfo: any = null;
  try {
    const r = await supabase
      .from("tutors")
      .select("first_name, last_name")
      .eq("id", tutorId)
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
      .eq("id", oppData.tutee_id)
      .maybeSingle();
    tuteeInfo = r.data;
  } catch {
    tuteeInfo = null;
  }

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

  // The created job serves as the reservation for this opportunity.
  return json({ job: jobIns.data[0] }, 201);
}
