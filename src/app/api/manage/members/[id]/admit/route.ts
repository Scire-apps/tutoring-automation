import { after } from "next/server";
import { requireActiveManager } from "@/lib/auth";
import { json, conflict, notFound, serverError } from "@/lib/http";
import { readOrgProfile, orgNameFor } from "@/lib/manage/members";
import { accountStatusChanged, siteUrl } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * POST /api/manage/members/[id]/admit — admit a pending member (§5.5).
 * Guarded UPDATE pending→active (0 rows → re-read → 404/409). status_note is
 * CLEARED on admit; activated_at/by are stamped. The profiles_audit trigger
 * records `member.activated`; an admission email fires after the row returns.
 * org_id is server-derived; the profiles guard authorizes the manager.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActiveManager(req);
  if (!auth.ok) return auth.response;
  const { supabase, user, orgId } = auth;
  const { id } = await ctx.params;

  const before = await readOrgProfile(supabase, orgId, id, "member");
  if (!before) return notFound("not_found", "Member not found");
  if (before.status !== "pending") {
    return conflict("invalid_state", "Only a pending member can be admitted", { status: before.status });
  }

  const { data: updated, error } = await supabase
    .from("profiles")
    .update({
      status: "active",
      status_note: null,
      activated_at: new Date().toISOString(),
      activated_by: user.id,
    })
    .eq("id", id)
    .eq("org_id", orgId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) return serverError("server_error", error.message);
  if (!updated) {
    const current = await readOrgProfile(supabase, orgId, id, "member");
    if (!current) return notFound("not_found", "Member not found");
    return conflict("invalid_state", "The member could not be admitted", { status: current.status });
  }

  const orgName = await orgNameFor(supabase, orgId);
  const recipient = { email: before.email, name: before.first_name, id: before.id };
  after(() =>
    accountStatusChanged(recipient, orgName, "active", "admitted", null, {
      org_id: orgId,
      dashboardUrl: `${siteUrl()}/member/dashboard`,
    }),
  );

  return json({ id, status: "active" as const });
}
