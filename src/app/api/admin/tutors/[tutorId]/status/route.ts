import { json, readJson, serverError } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ tutorId: string }> }
) {
  const a = await requireAdmin(req);
  if (!a.ok) return a.response;
  const { tutorId } = await ctx.params;
  try {
    const data = await readJson<Record<string, any>>(req);
    const status = data.status;

    if (!status || !["active", "pending", "suspended"].includes(status)) {
      return json({ error: "Invalid status" }, 400);
    }

    const { data: result } = await a.supabase
      .from("tutors")
      .update({ status })
      .eq("id", tutorId)
      .select();

    if (!result || result.length === 0) {
      return json({ error: "Tutor not found" }, 404);
    }

    return json({ message: "Tutor status updated successfully" }, 200);
  } catch (e) {
    console.error("Error updating tutor status:", e);
    return serverError();
  }
}
