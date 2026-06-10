import { after } from "next/server";
import { requireActiveManager } from "@/lib/auth";
import { json, conflict, notFound, serverError } from "@/lib/http";
import { readOrgProfile, orgNameFor } from "@/lib/manage/members";
import { accountStatusChanged, siteUrl } from "@/lib/email";
import type { Database } from "@/types/database";

type AccountStatus = Database["public"]["Enums"]["account_status"];

export const dynamic = "force-dynamic";

const RESTORABLE: AccountStatus[] = ["suspended", "rejected"];

/**
 * POST /api/manage/members/[id]/restore — reactivate a suspended or rejected
 * member (§5.5). Guarded UPDATE {suspended,rejected}→active; status_note is
 * CLEARED and activated_at/by re-stamped. (Restoring a rejected member is a
 * legal recovery path.) The profiles_audit trigger records `member.activated`;
 * a "restored" email fires after the row returns.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActiveManager(req);
  if (!auth.ok) return auth.response;
  const { supabase, user, orgId } = auth;
  const { id } = await ctx.params;

  const before = await readOrgProfile(supabase, orgId, id, "member");
  if (!before) return notFound("not_found", "Member not found");
  if (!RESTORABLE.includes(before.status)) {
    return conflict("invalid_state", "Only a suspended or rejected member can be restored", {
      status: before.status,
    });
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
    .in("status", RESTORABLE)
    .select("id")
    .maybeSingle();

  if (error) return serverError("server_error", error.message);
  if (!updated) {
    const current = await readOrgProfile(supabase, orgId, id, "member");
    if (!current) return notFound("not_found", "Member not found");
    return conflict("invalid_state", "The member could not be restored", { status: current.status });
  }

  const orgName = await orgNameFor(supabase, orgId);
  const recipient = { email: before.email, name: before.first_name, id: before.id };
  after(() =>
    accountStatusChanged(recipient, orgName, "active", "restored", null, {
      org_id: orgId,
      dashboardUrl: `${siteUrl()}/member/dashboard`,
    }),
  );

  return json({ id, status: "active" as const });
}
