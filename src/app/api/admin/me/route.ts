import { json, serverError } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const a = await requireAdmin(req);
  if (!a.ok) return a.response;
  try {
    const { data, error } = await a.supabase
      .from("admins")
      .select(
        "id, auth_id, email, first_name, last_name, role, school_id, school:schools(name,domain)"
      )
      .eq("auth_id", a.userId)
      .maybeSingle();
    if (error || !data) {
      return json({ error: "Admin not found" }, 404);
    }
    return json({ admin: data }, 200);
  } catch (e) {
    console.error("Error fetching admin me:", e);
    return serverError();
  }
}
