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

    let tuteeIds: string[] | null = null;
    if (schoolId) {
      const { data: tutees } = await a.supabase
        .from("tutees")
        .select("id")
        .eq("school_id", schoolId);
      tuteeIds = (tutees || []).map((t: any) => t.id);
    }

    let query = a.supabase
      .from("tutoring_opportunities")
      .select(
        "id, tutee_id, subject_name, subject_type, subject_grade, language, status, created_at"
      )
      .order("created_at", { ascending: false });

    if (tuteeIds && tuteeIds.length > 0) {
      query = query.in("tutee_id", tuteeIds);
    }

    let limit: number;
    try {
      const raw = new URL(req.url).searchParams.get("limit");
      limit = parseInt(raw || "50", 10);
      if (Number.isNaN(limit)) limit = 50;
    } catch {
      limit = 50;
    }
    limit = Math.max(1, Math.min(limit, 200));

    const { data } = await query.limit(limit);
    return json({ opportunities: data || [] }, 200);
  } catch (e) {
    console.error("Error listing opportunities for admin:", e);
    return serverError();
  }
}
