import { json, badRequest, readJson } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import { validateAvailabilityShape, isValidDesiredDuration } from "@/lib/domain";
import { sendTutorSchedulingNotification, siteUrl } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/tutee/jobs/[jobId]/availability
 * Faithful port of tutee.py set_tutee_availability.
 *
 * Body: {
 *   availability: { "YYYY-MM-DD": ["HH:MM-HH:MM", ...], ... },
 *   desired_duration_minutes: 60|90|120|150|180
 * }
 * Sets tutee_availability + desired_duration_minutes, moves status to
 * 'pending_tutor_scheduling', then emails the tutor (best-effort).
 */
export async function POST(req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await ctx.params;

  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const supabase = auth.supabase;

  const payload = await readJson<Record<string, any>>(req);
  const availability = payload.availability;
  const rawDesired = payload.desired_duration_minutes;

  // 1. availability must be an object of date->time ranges
  if (typeof availability !== "object" || availability === null || Array.isArray(availability)) {
    return json({ error: "availability must be an object of date->time ranges" }, 400);
  }

  // 2. coerce desired_duration_minutes to integer (mirrors Flask int()/str().strip())
  let desiredDuration = Number(rawDesired);
  if (!Number.isInteger(desiredDuration)) {
    const coerced = Number(String(rawDesired).trim());
    if (!Number.isInteger(coerced)) {
      return json({ error: "desired_duration_minutes must be provided (60..180)" }, 400);
    }
    desiredDuration = coerced;
  }

  // 3. must be a multiple of 30 between 60 and 180 inclusive
  if (!isValidDesiredDuration(desiredDuration)) {
    return json(
      { error: "desired_duration_minutes_invalid", details: "Must be a multiple of 30 between 60 and 180" },
      400
    );
  }

  // 4. identify tutee
  const tuteeRes = await supabase
    .from("tutees")
    .select("id")
    .eq("auth_id", auth.userId)
    .maybeSingle();
  if (!tuteeRes.data) {
    return json({ error: "Tutee profile not found" }, 404);
  }
  const tuteeId = tuteeRes.data.id;

  // 5. ensure job belongs to tutee
  const jobRes = await supabase
    .from("tutoring_jobs")
    .select("id, tutee_id, status")
    .eq("id", jobId)
    .maybeSingle();
  if (!jobRes.data || jobRes.data.tutee_id !== tuteeId) {
    return json({ error: "Job not found" }, 404);
  }

  // 6. status must be pending scheduling
  const status = jobRes.data.status;
  if (status !== "pending_tutee_scheduling" && status !== "pending_tutor_scheduling") {
    return json({ error: `Job status must be pending scheduling. Current: ${status}` }, 400);
  }

  // 7. validate availability structure / HH:MM format
  const shape = validateAvailabilityShape(availability);
  if (!shape.ok) {
    return badRequest(shape.error);
  }

  // 8. persist
  const upd = await supabase
    .from("tutoring_jobs")
    .update({
      tutee_availability: availability,
      desired_duration_minutes: desiredDuration,
      status: "pending_tutor_scheduling",
    })
    .eq("id", jobId)
    .select();
  if (!upd.data || upd.data.length === 0) {
    return json({ error: "Failed to save availability" }, 500);
  }

  // 9. email tutor (best-effort; never fail the endpoint)
  try {
    const jobDetails = await supabase
      .from("tutoring_jobs")
      .select("tutor_id, subject_name")
      .eq("id", jobId)
      .limit(1);
    if (jobDetails.data && jobDetails.data.length > 0) {
      const row = jobDetails.data[0] || {};
      const tutorIdVal = (row as any).tutor_id;
      const subjectName = (row as any).subject_name;

      const tutorInfo = tutorIdVal
        ? await supabase
            .from("tutors")
            .select("email, first_name, last_name")
            .eq("id", tutorIdVal)
            .limit(1)
        : { data: [] as any[] };
      const tuteeInfo = await supabase
        .from("tutees")
        .select("first_name, last_name")
        .eq("id", tuteeId)
        .limit(1);

      if (tutorInfo.data && tutorInfo.data.length > 0 && tuteeInfo.data && tuteeInfo.data.length > 0) {
        const tutorRow = tutorInfo.data[0] as any;
        const tuteeRow = tuteeInfo.data[0] as any;
        const tutorName = `${tutorRow.first_name || ""} ${tutorRow.last_name || ""}`.trim();
        const tuteeName = `${tuteeRow.first_name || ""} ${tuteeRow.last_name || ""}`.trim();
        const tutorEmail = tutorRow.email;

        const dashboardUrl = `${siteUrl()}/tutor/dashboard`;
        await sendTutorSchedulingNotification(tutorEmail, tutorName, tuteeName, subjectName, dashboardUrl);
      }
    }
  } catch {
    // Never fail the endpoint due to email/lookup issues
  }

  return json({ message: "Availability saved", job: upd.data[0] }, 200);
}
