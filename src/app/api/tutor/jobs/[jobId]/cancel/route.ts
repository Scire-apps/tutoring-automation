import { json } from "@/lib/http";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/tutor/jobs/[jobId]/cancel
 * Faithful port of jobs.py cancel_job.
 *
 * Tutor cancels a job and returns it to the opportunities board:
 *  - Recreates an OPEN opportunity (from snapshot when available, else job fields)
 *  - Deletes communications (best-effort), then deletes the job row.
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
    .select("id")
    .eq("auth_id", auth.userId)
    .maybeSingle();
  if (!tutorRes.data || tutorRes.data.id !== jobRes.data.tutor_id) {
    return json({ error: "Forbidden" }, 403);
  }

  const job: Record<string, any> = jobRes.data;

  // Build new opportunity from snapshot or job fields
  const snapRaw = job.opportunity_snapshot;
  const snap: Record<string, any> = snapRaw && typeof snapRaw === "object" && !Array.isArray(snapRaw) ? snapRaw : {};
  const isSnapObj = snapRaw && typeof snapRaw === "object" && !Array.isArray(snapRaw);

  const oppInsert: Record<string, any> = {
    tutee_id: job.tutee_id || snap.tutee_id,
    subject_name: job.subject_name || snap.subject_name,
    subject_type: job.subject_type || snap.subject_type,
    subject_grade: String(job.subject_grade || snap.subject_grade || ""),
    language: job.language || (isSnapObj ? snap.language : null) || "English",
    availability: null,
    location_preference: job.location || (isSnapObj ? snap.location_preference : null),
    additional_notes: snap.additional_notes,
    status: "open",
    priority: (isSnapObj ? snap.priority : null) || "normal",
  };

  // Minimal required fields must be present
  if (!oppInsert.tutee_id || !oppInsert.subject_name || !oppInsert.subject_type || !oppInsert.subject_grade) {
    return json(
      { error: "cannot_recreate_opportunity", details: "Missing required fields to recreate opportunity" },
      500
    );
  }

  const newOpp = await supabase.from("tutoring_opportunities").insert(oppInsert).select();
  if (!newOpp.data || newOpp.data.length === 0) {
    return json({ error: "failed_to_recreate_opportunity" }, 500);
  }

  // Remove communications associated with this job (best-effort; RLS may forbid)
  try {
    await supabase.from("communications").delete().eq("job_id", jobId);
  } catch {
    // ignore
  }

  // Remove the job row entirely
  await supabase.from("tutoring_jobs").delete().eq("id", jobId);

  return json({ message: "Job cancelled", opportunity: newOpp.data[0] }, 200);
}
