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

    if (schoolId) {
      const { data: tutors } = await a.supabase
        .from("tutors")
        .select("id")
        .eq("school_id", schoolId);
      const tutorIds = (tutors || []).map((t: any) => t.id);
      if (tutorIds.length === 0) {
        return json({ requests: [] }, 200);
      }
      const { data: reqs } = await a.supabase
        .from("certification_requests")
        .select(
          "id, tutor_id, tutor_name, tutor_mark, subject_name, subject_type, subject_grade, created_at"
        )
        .in("tutor_id", tutorIds)
        .order("created_at", { ascending: false })
        .limit(200);
      return json({ requests: reqs || [] }, 200);
    }

    const { data: reqs } = await a.supabase
      .from("certification_requests")
      .select(
        "id, tutor_id, tutor_name, tutor_mark, subject_name, subject_type, subject_grade, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(200);
    return json({ requests: reqs || [] }, 200);
  } catch (e) {
    console.error("Error listing certification requests:", e);
    return serverError();
  }
}
