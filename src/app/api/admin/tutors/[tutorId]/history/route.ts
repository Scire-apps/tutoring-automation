import { json, serverError } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ tutorId: string }> }
) {
  const a = await requireAdmin(req);
  if (!a.ok) return a.response;
  const { tutorId } = await ctx.params;
  try {
    const { data } = await a.supabase
      .from("past_jobs")
      .select(
        "id, subject_name, subject_type, subject_grade, scheduled_time, duration_minutes, awarded_volunteer_hours, created_at"
      )
      .eq("tutor_id", tutorId)
      .order("created_at", { ascending: false })
      .limit(200);
    return json({ jobs: data || [] }, 200);
  } catch (e) {
    console.error("Error fetching tutor history:", e);
    return serverError();
  }
}
