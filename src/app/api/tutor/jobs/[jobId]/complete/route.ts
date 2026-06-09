import { json } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import type { TablesInsert } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/tutor/jobs/[jobId]/complete
 * Faithful port of jobs.py complete_job.
 *
 * Tutor marks a job as completed; moves it to awaiting_verification_jobs.
 *  - Requires an existing recording link in session_recordings (else 400)
 *  - Denormalizes tutor/tutee names into the awaiting row
 *  - Deletes communications (best-effort) and the active job afterward.
 */
export async function POST(req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await ctx.params;

  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const supabase = auth.supabase;

  // Ensure requester is the assigned tutor
  const jobRes = await supabase
    .from("tutoring_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();
  if (!jobRes.data) {
    return json({ error: "Job not found" }, 404);
  }

  const tutorRes = await supabase
    .from("tutors")
    .select("id, volunteer_hours")
    .eq("auth_id", auth.userId)
    .maybeSingle();
  if (!tutorRes.data || tutorRes.data.id !== jobRes.data.tutor_id) {
    return json({ error: "Forbidden" }, 403);
  }

  // Require existing recording link
  const rec = await supabase
    .from("session_recordings")
    .select("id, recording_url")
    .eq("job_id", jobId)
    .maybeSingle();
  if (!rec.data || !rec.data.recording_url) {
    return json(
      { error: "recording_required", details: "Please upload the session recording link before completing." },
      400
    );
  }

  try {
    const job: Record<string, any> = jobRes.data;

    // Fetch tutor/tutee names for denormalized storage (best-effort)
    let tutorName: string | null = null;
    let tuteeName: string | null = null;
    try {
      const tRow = await supabase
        .from("tutors")
        .select("first_name, last_name")
        .eq("id", job.tutor_id)
        .maybeSingle();
      if (tRow.data) {
        tutorName = `${tRow.data.first_name || ""} ${tRow.data.last_name || ""}`.trim();
      }
    } catch {
      // ignore
    }
    try {
      const teRow = await supabase
        .from("tutees")
        .select("first_name, last_name")
        .eq("id", job.tutee_id)
        .maybeSingle();
      if (teRow.data) {
        tuteeName = `${teRow.data.first_name || ""} ${teRow.data.last_name || ""}`.trim();
      }
    } catch {
      // ignore
    }

    const snap = job.opportunity_snapshot && typeof job.opportunity_snapshot === "object" ? job.opportunity_snapshot : {};

    const awaitingRow: Record<string, any> = {
      id: job.id,
      opportunity_id: job.opportunity_id,
      tutor_id: job.tutor_id,
      tutee_id: job.tutee_id,
      // store names directly in the awaiting table
      tutor_name: tutorName,
      tutee_name: tuteeName,
      subject_name: job.subject_name,
      subject_type: job.subject_type,
      subject_grade: job.subject_grade,
      language: job.language || (snap as any).language || "English",
      tutee_availability: job.tutee_availability,
      desired_duration_minutes: job.desired_duration_minutes,
      scheduled_time: job.scheduled_time,
      duration_minutes: job.duration_minutes,
      // keep identifiers inside snapshot for admin verification logic
      opportunity_snapshot: {
        ...(snap as Record<string, any>),
        tutor_id: job.tutor_id,
        tutee_id: job.tutee_id,
      },
      location: job.location,
      status: "awaiting_admin_verification",
    };

    const ins = await supabase
      .from("awaiting_verification_jobs")
      .insert(awaitingRow as TablesInsert<"awaiting_verification_jobs">)
      .select();
    if (!ins.data || ins.data.length === 0) {
      return json({ error: "failed_to_move_to_awaiting_verification" }, 500);
    }

    // Remove communications and delete active job
    await supabase.from("communications").delete().eq("job_id", jobId);
    await supabase.from("tutoring_jobs").delete().eq("id", jobId);

    return json({ message: "Job marked as completed and moved to awaiting verification" }, 200);
  } catch (e) {
    return json({ error: "failed_to_complete_job", details: String(e) }, 500);
  }
}
