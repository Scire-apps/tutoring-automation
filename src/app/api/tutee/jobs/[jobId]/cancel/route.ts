import { json } from "@/lib/http";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/tutee/jobs/[jobId]/cancel
 * Faithful port of jobs.py cancel_job_as_tutee.
 *
 * Tutee cancels a job: strictly RLS-bound hard delete of their own
 * tutoring_jobs row. Requester must be the job's tutee.
 */
export async function POST(req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await ctx.params;

  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const supabase = auth.supabase;

  // Ensure requester is the assigned tutee
  const jobRes = await supabase
    .from("tutoring_jobs")
    .select("id, tutee_id")
    .eq("id", jobId)
    .maybeSingle();
  if (!jobRes.data) {
    return json({ error: "Job not found" }, 404);
  }

  const tuteeRes = await supabase
    .from("tutees")
    .select("id")
    .eq("auth_id", auth.userId)
    .maybeSingle();
  if (!tuteeRes.data || tuteeRes.data.id !== jobRes.data.tutee_id) {
    return json({ error: "Forbidden" }, 403);
  }

  // Perform delete using the user's RLS-bound client only
  try {
    const del = await supabase.from("tutoring_jobs").delete().eq("id", jobId);
    if (del.error) {
      return json({ error: "failed_to_delete_job", details: del.error.message }, 500);
    }
    return json({ message: "Job deleted" }, 200);
  } catch (e) {
    return json({ error: "failed_to_delete_job", details: String(e) }, 500);
  }
}
