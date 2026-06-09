import { json, serverError } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const a = await requireAdmin(req);
  if (!a.ok) return a.response;
  try {
    const { data } = await a.supabase
      .from("awaiting_verification_jobs")
      .select(
        "id, tutor_name, tutee_name, subject_name, subject_type, subject_grade, language, scheduled_time, duration_minutes, created_at, opportunity_snapshot"
      )
      .order("created_at", { ascending: false })
      .limit(200);
    return json({ jobs: data || [] }, 200);
  } catch (e) {
    console.error("Error listing awaiting verification jobs:", e);
    return serverError();
  }
}
