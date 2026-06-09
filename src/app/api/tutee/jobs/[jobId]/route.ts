import { json, notFound } from "@/lib/http";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/tutee/jobs/[jobId]
 * Faithful port of tutee.py get_tutee_job.
 * Fetch a job that belongs to the authenticated tutee (for scheduling UI).
 */
export async function GET(req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await ctx.params;

  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const supabase = auth.supabase;

  const tuteeRes = await supabase
    .from("tutees")
    .select("id")
    .eq("auth_id", auth.userId)
    .maybeSingle();
  if (!tuteeRes.data) {
    return json({ error: "Tutee profile not found" }, 404);
  }
  const tuteeId = tuteeRes.data.id;

  const jobRes = await supabase
    .from("tutoring_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("tutee_id", tuteeId)
    .maybeSingle();
  if (!jobRes.data) {
    return notFound("Job not found");
  }

  const job: Record<string, any> = { ...jobRes.data };
  if (job.opportunity_snapshot) {
    job.tutoring_opportunity = job.opportunity_snapshot;
  }

  // Attach tutor basic info for display (best-effort)
  try {
    if (job.tutor_id) {
      const tutorRes = await supabase
        .from("tutors")
        .select("id, email, first_name, last_name")
        .eq("id", job.tutor_id)
        .maybeSingle();
      if (tutorRes.data) {
        job.tutor = tutorRes.data;
      }
    }
  } catch {
    // ignore
  }

  return json({ job }, 200);
}
