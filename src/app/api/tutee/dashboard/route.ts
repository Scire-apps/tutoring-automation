export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "@/lib/http";
import { requireAuth } from "@/lib/auth";

/**
 * GET /api/tutee/dashboard
 * Faithful port of Flask get_tutee_dashboard.
 * Returns the authenticated tutee's profile, opportunities, and jobs.
 * 404 if no tutee profile exists for the caller.
 */
export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const supabase = auth.supabase;

  // Find tutee by auth_id
  const tuteeResult = await supabase
    .from("tutees")
    .select("*")
    .eq("auth_id", auth.userId)
    .maybeSingle();

  if (!tuteeResult.data) {
    return json({ error: "Tutee profile not found" }, 404);
  }

  const tutee = tuteeResult.data as any;

  // Load own opportunities (embedded subject fields)
  const opps = await supabase
    .from("tutoring_opportunities")
    .select("*")
    .eq("tutee_id", tutee.id)
    .order("created_at", { ascending: false })
    .limit(100);

  // Load own jobs (embedded subject fields)
  const jobs = await supabase
    .from("tutoring_jobs")
    .select("*")
    .eq("tutee_id", tutee.id)
    .order("created_at", { ascending: false })
    .limit(100);

  // Direct grade (no calculation)
  const gradeSuggestion = tutee?.grade ?? null;

  const payload = {
    tutee,
    opportunities: opps.data || [],
    jobs: jobs.data || [],
    grade_suggestion: gradeSuggestion,
  };

  const resp = json(payload);
  resp.headers.set("Cache-Control", "private, max-age=3");
  return resp;
}
