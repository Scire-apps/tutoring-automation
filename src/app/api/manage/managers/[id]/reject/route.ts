import { after } from "next/server";
import { requireActiveManager } from "@/lib/auth";
import { json, conflict, notFound, serverError } from "@/lib/http";
import { parseBody } from "@/lib/validation";
import { rejectManagerSchema } from "@/lib/manage/schemas";
import { readOrgProfile, orgNameFor } from "@/lib/manage/members";
import { managerActivated } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * POST /api/manage/managers/[id]/reject — reject a pending PEER manager in MY
 * org (§5.7). Guarded UPDATE pending→rejected (the profiles guard permits only
 * the pending→{active,rejected} peer transitions). The optional note is stored as
 * status_note (internal) and shown in the email. The profiles_audit trigger
 * records `manager.rejected`.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActiveManager(req);
  if (!auth.ok) return auth.response;
  const { supabase, orgId } = auth;
  const { id } = await ctx.params;

  const parsed = await parseBody(req, rejectManagerSchema);
  if (!parsed.ok) return parsed.response;
  const note = parsed.data.note ?? null;

  const before = await readOrgProfile(supabase, orgId, id, "manager");
  if (!before) return notFound("not_found", "Manager not found");
  if (before.status !== "pending") {
    return conflict("invalid_state", "Only a pending manager can be rejected", { status: before.status });
  }

  const { data: updated, error } = await supabase
    .from("profiles")
    .update({ status: "rejected", status_note: note })
    .eq("id", id)
    .eq("org_id", orgId)
    .eq("kind", "manager")
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) return serverError("server_error", error.message);
  if (!updated) {
    const current = await readOrgProfile(supabase, orgId, id, "manager");
    if (!current) return notFound("not_found", "Manager not found");
    return conflict("invalid_state", "The manager could not be rejected", { status: current.status });
  }

  const orgName = await orgNameFor(supabase, orgId);
  const recipient = { email: before.email, name: before.first_name, id: before.id };
  after(() => managerActivated(recipient, orgName, "rejected", note, { org_id: orgId }));

  return json({ id, status: "rejected" as const });
}
