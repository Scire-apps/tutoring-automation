import { after } from "next/server";
import { requireActiveManager } from "@/lib/auth";
import { json, conflict, notFound, serverError } from "@/lib/http";
import { logAudit } from "@/lib/log";

export const dynamic = "force-dynamic";

/**
 * POST /api/manage/help-requests/[id]/resolve — soft-resolve an open help request
 * (§5.13). Guarded UPDATE open→resolved, stamping resolved_by/at (no row
 * deletion; a Resolved history tab keeps them). help_requests has no audit trigger
 * so a `help.resolved` audit row is written explicitly. No email. org_id is
 * server-derived; RLS (`managed_org`) authorizes the write.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActiveManager(req);
  if (!auth.ok) return auth.response;
  const { supabase, user, orgId } = auth;
  const { id } = await ctx.params;

  const { data: before } = await supabase
    .from("help_requests")
    .select("id, status")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!before) return notFound("not_found", "Help request not found");
  if (before.status !== "open") {
    return conflict("invalid_state", "This request is already resolved", { status: before.status });
  }

  const { data: updated, error } = await supabase
    .from("help_requests")
    .update({ status: "resolved", resolved_by: user.id, resolved_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", orgId)
    .eq("status", "open")
    .select("id")
    .maybeSingle();

  if (error) return serverError("server_error", error.message);
  if (!updated) {
    const { data: current } = await supabase
      .from("help_requests")
      .select("status")
      .eq("id", id)
      .eq("org_id", orgId)
      .maybeSingle();
    if (!current) return notFound("not_found", "Help request not found");
    return conflict("invalid_state", "This request could not be resolved", { status: current.status });
  }

  after(() =>
    logAudit({
      action: "help.resolved",
      actor_id: user.id,
      actor_kind: "manager",
      org_id: orgId,
      target_table: "help_requests",
      target_id: id,
    }),
  );

  return json({ id, status: "resolved" as const });
}
