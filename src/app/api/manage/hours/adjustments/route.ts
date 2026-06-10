import { after } from "next/server";
import { requireActiveManager } from "@/lib/auth";
import { json, conflict, notFound, serverError } from "@/lib/http";
import { parseBody } from "@/lib/validation";
import { adjustmentSchema } from "@/lib/manage/schemas";
import { readOrgProfile } from "@/lib/manage/members";
import { resolveRecipient } from "@/lib/manage/recipients";
import { adjustmentNotice, siteUrl } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * POST /api/manage/hours/adjustments {member_id, hours, note} — a manual signed
 * adjustment to a member's volunteer hours (§5.10). INSERT of a kind='adjustment'
 * ledger row (awarded_by=self; the RLS check + balance guard enforce that a
 * negative adjustment can't drive the member's total below zero → 409). The
 * ledger_audit trigger records `hours.adjusted`; the member is emailed. Awards
 * never come through here — those are the verify trigger's job. org_id is
 * server-derived.
 */
export async function POST(req: Request) {
  const auth = await requireActiveManager(req);
  if (!auth.ok) return auth.response;
  const { supabase, user, orgId } = auth;

  const parsed = await parseBody(req, adjustmentSchema);
  if (!parsed.ok) return parsed.response;
  const { member_id, hours, note } = parsed.data;

  // The member must exist in the org (a cross-org adjustment is impossible).
  const member = await readOrgProfile(supabase, orgId, member_id, "member");
  if (!member) return notFound("not_found", "Member not found");

  const { data, error } = await supabase
    .from("volunteer_hours_ledger")
    .insert({
      org_id: orgId,
      profile_id: member_id,
      session_id: null,
      kind: "adjustment",
      hours,
      note,
      awarded_by: user.id,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    // The balance guard raises a custom EXCEPTION when the total would go negative.
    if (/balance/i.test(error.message) || error.code === "P0001") {
      return conflict("invalid_state", "That adjustment would drive the member's hours below zero");
    }
    return serverError("server_error", error.message);
  }
  if (!data) return serverError("server_error", "Failed to record the adjustment");

  const recipient = await resolveRecipient(supabase, member_id);
  if (recipient) {
    after(() =>
      adjustmentNotice(recipient, hours, note, { org_id: orgId, hoursUrl: `${siteUrl()}/member/dashboard` }),
    );
  }

  return json({ id: data.id, member_id, hours, note }, 201);
}
