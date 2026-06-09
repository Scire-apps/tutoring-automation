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
    const schoolId = adminData ? (adminData as any).school_id : null;

    const { data: reqRow } = await a.supabase
      .from("certification_requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle();
    if (!reqRow) {
      return json({ error: "Request not found" }, 404);
    }

    if (schoolId) {
      const { data: tutorRow } = await a.supabase
        .from("tutors")
        .select("school_id")
        .eq("id", (reqRow as any).tutor_id)
        .maybeSingle();
      if (!tutorRow || (tutorRow as any).school_id !== schoolId) {
        return json({ error: "not_in_admin_school_scope" }, 403);
      }
    }

    await a.supabase
      .from("certification_requests")
      .delete()
      .eq("id", requestId);
    return json({ message: "Certification request deleted" }, 200);
  } catch (e) {
    console.error("Error deleting certification request:", e);
    return serverError();
  }
}
