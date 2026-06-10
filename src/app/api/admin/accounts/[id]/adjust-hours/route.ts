import { after } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { json, conflict, notFound, serverError } from "@/lib/http";
import { parseBody } from "@/lib/validation";
import { adjustHoursSchema } from "@/lib/admin/schemas";
import { readAccount } from "@/lib/admin/accounts";
import { resolveRecipient } from "@/lib/admin/recipients";
import { adjustmentNotice, siteUrl } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/accounts/[id]/adjust-hours {delta_hours, note} — a manual signed
 * adjustment to a member's volunteer hours (§6.4). INSERT of a kind='adjustment'
 * ledger row in the member's OWN org (awarded_by = the admin; the balance guard
 * blocks driving the total below zero → 409). Awards never come through here.
 * Targets a MEMBER (409 `wrong_kind` otherwise). The member is emailed; the
 * ledger_audit trigger records `hours.adjusted`.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;
  const { id } = await ctx.params;

  const parsed = await parseBody(req, adjustHoursSchema);
  if (!parsed.ok) return parsed.response;
  const { delta_hours, note } = parsed.data;

  const account = await readAccount(supabase, id);
  if (!account) return notFound("not_found", "Account not found");
  if (account.kind !== "member") {
    return conflict("wrong_kind", "Only members have a volunteer-hours ledger", { kind: account.kind });
  }
  if (!account.org_id) return serverError("server_error", "Member has no organization");

  const { data, error } = await supabase
    .from("volunteer_hours_ledger")
    .insert({
      org_id: account.org_id,
      profile_id: id,
      session_id: null,
      kind: "adjustment",
      hours: delta_hours,
      note,
      awarded_by: user.id,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    if (/balance/i.test(error.message) || error.code === "P0001") {
      return conflict("invalid_state", "That adjustment would drive the member's hours below zero");
    }
    return serverError("server_error", error.message);
  }
  if (!data) return serverError("server_error", "Failed to record the adjustment");

  const recipient = await resolveRecipient(supabase, id);
  if (recipient) {
    after(() =>
      adjustmentNotice(recipient, delta_hours, note, { org_id: account.org_id, hoursUrl: `${siteUrl()}/member/dashboard` }),
    );
  }

  return json({ id: data.id, profile_id: id, kind: "adjustment" as const, hours: delta_hours, note }, 201);
}
