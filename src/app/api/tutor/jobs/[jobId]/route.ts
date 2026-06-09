import { json } from "@/lib/http";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/tutor/jobs/[jobId]
 * Faithful port of tutor.py get_job.
 *
 * Reads from active jobs; if not found, reads from awaiting_verification_jobs.
 * Always attaches tutee info when possible, and a synthetic
 * tutoring_opportunity from the snapshot.
 */
export async function GET(req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await ctx.params;

  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const supabase = auth.supabase;

  // Resolve tutor_id from auth
  const tutorRow = await supabase
    .from("tutors")
    .select("id")
    .eq("auth_id", auth.userId)
    .limit(1);
  const tutorId =
    tutorRow.data && tutorRow.data.length > 0 ? (tutorRow.data[0] as any).id : null;
  if (!tutorId) {
    return json({ error: "Tutor not found" }, 404);
  }

  let job: Record<string, any> | null = null;

  // Try active jobs without raising on empty
  const resActive = await supabase
    .from("tutoring_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("tutor_id", tutorId)
    .limit(1);
  if (resActive.data && resActive.data.length > 0) {
    job = { ...resActive.data[0] };
  }

  // Fallback to awaiting verification
  if (!job) {
    const resWait = await supabase
      .from("awaiting_verification_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("tutor_id", tutorId)
      .limit(1);
    if (resWait.data && resWait.data.length > 0) {
      job = { ...resWait.data[0] };
      // Normalize status for UI
      job.status = "awaiting_admin_verification";
    }
  }

  if (!job) {
    return json({ error: "Job not found" }, 404);
  }

  // Provide a synthetic tutoring_opportunity from snapshot for consistent UI
  const snapshot =
    job.opportunity_snapshot && typeof job.opportunity_snapshot === "object" && !Array.isArray(job.opportunity_snapshot)
      ? job.opportunity_snapshot
      : null;
  job.tutoring_opportunity = snapshot || null;

  // Determine tutee_id (direct or from snapshot) and attach tutee record
  let tuteeId = job.tutee_id;
  if (!tuteeId && snapshot) {
    try {
      const possible = (snapshot as any).tutee_id;
      if (typeof possible === "string" && possible.length >= 8) {
        tuteeId = possible;
      }
    } catch {
      tuteeId = null;
    }
  }

  if (tuteeId) {
    try {
      const tuteeRow = await supabase
        .from("tutees")
        .select("id, email, first_name, last_name, grade")
        .eq("id", tuteeId)
        .limit(1);
      if (tuteeRow.data && tuteeRow.data.length > 0) {
        job.tutee = tuteeRow.data[0];
      }
    } catch {
      // ignore
    }
  }

  return json({ job }, 200);
}
