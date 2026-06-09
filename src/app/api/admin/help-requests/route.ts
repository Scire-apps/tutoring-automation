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

    let query = a.supabase
      .from("help_questions")
      .select(
        "id, auth_id, role, tutor_id, tutee_id, school_id, user_first_name, user_last_name, user_email, user_grade, submitted_at, urgency, description"
      )
      .order("submitted_at", { ascending: false });
    if (schoolId) {
      query = query.eq("school_id", schoolId);
    }
    const { data } = await query.limit(100);
    return json({ help_requests: data || [] }, 200);
  } catch (e) {
    console.error("Error listing help requests:", e);
    return serverError();
  }
}
