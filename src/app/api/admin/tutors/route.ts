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
      .from("tutors")
      .select(
        "id, first_name, last_name, email, school_id, status, volunteer_hours, created_at, school:schools(name,domain)"
      )
      .order("created_at", { ascending: false });

    if (schoolId) {
      query = query.eq("school_id", schoolId);
    }

    let limit: number;
    try {
      const raw = new URL(req.url).searchParams.get("limit");
      limit = parseInt(raw || "100", 10);
      if (Number.isNaN(limit)) limit = 100;
    } catch {
      limit = 100;
    }
    limit = Math.max(1, Math.min(limit, 500));

    const { data } = await query.limit(limit);
    return json({ tutors: data || [] }, 200);
  } catch (e) {
    console.error("Error listing tutors for admin:", e);
    return serverError();
  }
}
