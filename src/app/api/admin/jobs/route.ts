import { json, serverError } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const a = await requireAdmin(req);
  if (!a.ok) return a.response;
  try {
    const { data: adminData } = await a.supabase
      .from("admins")
      .select("school_id")
      .eq("auth_id", a.userId)
      .maybeSingle();
    const schoolId = adminData ? (adminData as any).school_id : null;

    const query = a.supabase
      .from("tutoring_jobs")
      .select(
        "id, tutor_id, tutee_id, subject_name, subject_type, subject_grade, language, scheduled_time, duration_minutes, created_at"
      )
      .order("created_at", { ascending: false });

    if (schoolId) {
      let tutorIds: string[] = [];
      let tuteeIds: string[] = [];
      try {
        const { data: tutors } = await a.supabase
          .from("tutors")
          .select("id")
          .eq("school_id", schoolId);
        tutorIds = (tutors || []).map((t: any) => t.id);
      } catch {
        tutorIds = [];
      }
      try {
        const { data: tutees } = await a.supabase
          .from("tutees")
          .select("id")
          .eq("school_id", schoolId);
        tuteeIds = (tutees || []).map((t: any) => t.id);
      } catch {
        tuteeIds = [];
      }

      const { data: jobsByTutors } = await a.supabase
        .from("tutoring_jobs")
        .select("*")
        .in("tutor_id", tutorIds.length ? tutorIds : ["00000000-0000-0000-0000-000000000000"])
        .order("created_at", { ascending: false });
      const { data: jobsByTutees } = await a.supabase
        .from("tutoring_jobs")
        .select("*")
        .in("tutee_id", tuteeIds.length ? tuteeIds : ["00000000-0000-0000-0000-000000000000"])
        .order("created_at", { ascending: false });

      const seen = new Set<string>();
      const merged: any[] = [];
      for (const res of [jobsByTutors || [], jobsByTutees || []]) {
        for (const row of res as any[]) {
          if (!seen.has(row.id)) {
            seen.add(row.id);
            merged.push(row);
          }
        }
      }
      return json({ jobs: merged }, 200);
    }

    let limit: number;
    try {
      const raw = new URL(req.url).searchParams.get("limit");
      limit = parseInt(raw || "200", 10);
      if (Number.isNaN(limit)) limit = 200;
    } catch {
      limit = 200;
    }
    limit = Math.max(1, Math.min(limit, 500));

    const { data } = await query.limit(limit);
    return json({ jobs: data || [] }, 200);
  } catch (e) {
    console.error("Error listing jobs for admin:", e);
    return serverError();
  }
}
