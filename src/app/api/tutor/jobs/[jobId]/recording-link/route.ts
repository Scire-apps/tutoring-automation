import { json, readJson } from "@/lib/http";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/tutor/jobs/[jobId]/recording-link
 * Faithful port of jobs.py get_recording_link.
 * Tutor fetches the existing recording link for their job (if any).
 */
export async function GET(req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await ctx.params;

  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const supabase = auth.supabase;

  const jobRes = await supabase
    .from("tutoring_jobs")
    .select("id, tutor_id")
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

  const rec = await supabase
    .from("session_recordings")
    .select("recording_url")
    .eq("job_id", jobId)
    .maybeSingle();

  return json({ recording_url: rec.data ? rec.data.recording_url : null }, 200);
}

/**
 * POST /api/tutor/jobs/[jobId]/recording-link
 * Faithful port of jobs.py upsert_recording_link.
 *
 * Body: { recording_url: string } (must start with http:// or https://)
 * Allowed only while the job exists in tutoring_jobs (pre-completion).
 * Upserts session_recordings keyed by job_id.
 */
export async function POST(req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await ctx.params;

  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const supabase = auth.supabase;

  const payload = await readJson<Record<string, any>>(req);
  const recordingUrl = String(payload.recording_url ?? "").trim();
  if (!recordingUrl || !(recordingUrl.startsWith("http://") || recordingUrl.startsWith("https://"))) {
    return json({ error: "A valid recording_url is required" }, 400);
  }

  // Ensure requester is the assigned tutor and job exists in active jobs
  const jobRes = await supabase
    .from("tutoring_jobs")
    .select("id, tutor_id")
    .eq("id", jobId)
    .maybeSingle();
  if (!jobRes.data) {
    return json({ error: "Job not found or already completed" }, 404);
  }

  const tutorRes = await supabase
    .from("tutors")
    .select("id")
    .eq("auth_id", auth.userId)
    .maybeSingle();
  if (!tutorRes.data || tutorRes.data.id !== jobRes.data.tutor_id) {
    return json({ error: "Forbidden" }, 403);
  }

  // Upsert recording link by job_id (unique job_id)
  try {
    const existing = await supabase.from("session_recordings").select("id").eq("job_id", jobId).limit(1);
    if (existing.data && existing.data.length > 0) {
      const upd = await supabase
        .from("session_recordings")
        .update({ recording_url: recordingUrl })
        .eq("job_id", jobId)
        .select();
      if (!upd.data || upd.data.length === 0) {
        return json({ error: "Failed to update recording link" }, 500);
      }
      return json({ message: "Recording link updated", recording: upd.data[0] }, 200);
    } else {
      const ins = await supabase
        .from("session_recordings")
        .insert({ job_id: jobId, recording_url: recordingUrl })
        .select();
      if (!ins.data || ins.data.length === 0) {
        return json({ error: "Failed to save recording link" }, 500);
      }
      return json({ message: "Recording link saved", recording: ins.data[0] }, 201);
    }
  } catch (e) {
    return json({ error: "recording_upsert_failed", details: String(e) }, 500);
  }
}
