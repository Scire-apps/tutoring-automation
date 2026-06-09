export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json, notFound } from "@/lib/http";
import { requireAuth } from "@/lib/auth";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const supabase = auth.supabase;

  const tutorResult = await supabase
    .from("tutors")
    .select("*")
    .eq("auth_id", auth.userId)
    .maybeSingle();
  if (!tutorResult.data) {
    return notFound("Tutor profile not found");
  }

  const tutor: any = tutorResult.data;
  const approvedSubjectIds = tutor.approved_subject_ids || [];

  // Opportunities visible to tutors: all open (include tutee embed; RLS will filter)
  const opps = await supabase
    .from("tutoring_opportunities")
    .select("*, tutee:tutees(id, first_name, last_name, email, school_id, grade)")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(100);

  // Jobs belonging to this tutor
  const jobsRes = await supabase
    .from("tutoring_jobs")
    .select("*")
    .eq("tutor_id", tutor.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const jobs: any[] = jobsRes.data || [];
  // Attach synthetic tutoring_opportunity from snapshot if available
  for (const j of jobs) {
    if (j.opportunity_snapshot) {
      j.tutoring_opportunity = j.opportunity_snapshot;
    }
  }

  // Include jobs awaiting admin verification for this tutor
  try {
    const awaitingRes = await supabase
      .from("awaiting_verification_jobs")
      .select("*")
      .eq("tutor_id", tutor.id)
      .order("created_at", { ascending: false })
      .limit(100);
    for (const aw of awaitingRes.data || []) {
      const awCopy: any = { ...aw };
      // Normalize fields to look like tutoring_jobs items in UI
      awCopy.status = "awaiting_admin_verification";
      if (awCopy.opportunity_snapshot) {
        awCopy.tutoring_opportunity = awCopy.opportunity_snapshot;
      }
      jobs.push(awCopy);
    }
  } catch {
    // best-effort
  }

  // For privacy, do not attach tutee PII in bulk; clients should fetch details per job when needed

  const payload = {
    tutor,
    approved_subject_ids: approvedSubjectIds,
    opportunities: opps.data || [],
    jobs,
  };

  const resp = json(payload);
  resp.headers.set("Cache-Control", "private, max-age=3");
  return resp;
}
