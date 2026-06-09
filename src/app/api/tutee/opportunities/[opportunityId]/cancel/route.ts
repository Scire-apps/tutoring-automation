export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "@/lib/http";
import { requireAuth } from "@/lib/auth";

/**
 * POST /api/tutee/opportunities/[opportunityId]/cancel
 * Faithful port of Flask cancel_tutee_opportunity.
 * Allows a tutee to cancel (hard delete) their own OPEN tutoring request.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ opportunityId: string }> }
) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { opportunityId } = await ctx.params;
  const supabase = auth.supabase;

  try {
    // Identify tutee
    const tuteeRes = await supabase
      .from("tutees")
      .select("id")
      .eq("auth_id", auth.userId)
      .maybeSingle();

    if (!tuteeRes.data) {
      return json({ error: "Tutee profile not found" }, 404);
    }
    const tuteeId = (tuteeRes.data as any).id;

    // Ensure opportunity belongs to this tutee and is open
    const opp = await supabase
      .from("tutoring_opportunities")
      .select("id, tutee_id, status")
      .eq("id", opportunityId)
      .maybeSingle();

    if (!opp.data || (opp.data as any).tutee_id !== tuteeId) {
      return json({ error: "Opportunity not found" }, 404);
    }
    if ((opp.data as any).status !== "open") {
      return json(
        {
          error: "cannot_cancel_non_open",
          details: `Current status: ${(opp.data as any).status}`,
        },
        400
      );
    }

    // Hard delete the opportunity
    const delRes = await supabase
      .from("tutoring_opportunities")
      .delete()
      .eq("id", opportunityId)
      .select();

    if (delRes.data === null) {
      return json({ error: "failed_to_delete" }, 500);
    }
    return json({ message: "Opportunity deleted", id: opportunityId }, 200);
  } catch (e: any) {
    return json({ error: "cancel_failed", details: String(e?.message ?? e) }, 500);
  }
}
