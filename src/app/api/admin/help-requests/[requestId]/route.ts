import { json, serverError } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ requestId: string }> }
) {
  const a = await requireAdmin(req);
  if (!a.ok) return a.response;
  const { requestId } = await ctx.params;
  try {
    const { data: adminData } = await a.supabase
      .from("admins")
      .select("school_id")
      .eq("auth_id", a.userId)
      .maybeSingle();
    const adminSchoolId = adminData ? (adminData as any).school_id : null;

    const { data: row } = await a.supabase
      .from("help_questions")
      .select("school_id")
      .eq("id", requestId)
      .maybeSingle();
    if (!row) {
      return json({ error: "not_found" }, 404);
    }
    if (adminSchoolId && (row as any).school_id !== adminSchoolId) {
      return json({ error: "not_in_admin_school_scope" }, 403);
    }

    await a.supabase.from("help_questions").delete().eq("id", requestId);
    return json({ message: "resolved" }, 200);
  } catch (e) {
    console.error("Error deleting help request:", e);
    return serverError();
  }
}
