import { after } from "next/server";
import { requireActiveManager } from "@/lib/auth";
import { json, conflict, notFound, serverError } from "@/lib/http";
import { readOrgProfile, orgNameFor } from "@/lib/manage/members";
import { managerActivated, siteUrl } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * POST /api/manage/managers/[id]/approve — activate a pending PEER manager in MY
 * org (§5.7). Guarded UPDATE pending→active (the profiles guard permits a manager
 * to move only a PENDING peer to active/rejected; everything else RAISEs).
 * activated_at/by are stamped; the profiles_audit trigger records
 * `manager.activated`; an activation email fires after the row returns.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActiveManager(req);
  if (!auth.ok) return auth.response;
  const { supabase, user, orgId } = auth;
  const { id } = await ctx.params;

  const before = await readOrgProfile(supabase, orgId, id, "manager");
  if (!before) return notFound("not_found", "Manager not found");
  if (before.status !== "pending") {
    return conflict("invalid_state", "Only a pending manager can be approved", { status: before.status });
  }

  const { data: updated, error } = await supabase
    .from("profiles")
    .update({ status: "active", activated_at: new Date().toISOString(), activated_by: user.id })
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
    return conflict("invalid_state", "The manager could not be approved", { status: current.status });
  }

  const orgName = await orgNameFor(supabase, orgId);
  const recipient = { email: before.email, name: before.first_name, id: before.id };
  after(() =>
    managerActivated(recipient, orgName, "activated", null, {
      org_id: orgId,
      dashboardUrl: `${siteUrl()}/manager/dashboard`,
    }),
  );

  return json({ id, status: "active" as const });
}
