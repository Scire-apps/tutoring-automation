import { after } from "next/server";
import { requireActiveManager } from "@/lib/auth";
import { json, conflict, notFound, serverError } from "@/lib/http";
import { parseBody } from "@/lib/validation";
import { rejectMemberSchema } from "@/lib/manage/schemas";
import { readOrgProfile, orgNameFor } from "@/lib/manage/members";
import { accountStatusChanged } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * POST /api/manage/members/[id]/reject — reject a pending member (§5.5).
 * Guarded UPDATE pending→rejected; `note` binds to status_note (member-visible on
 * their gate card via /api/auth/me). The account + auth user are RETAINED
 * (re-admit from rejected is legal). The profiles_audit trigger records
 * `member.rejected`; an email fires after the row returns.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActiveManager(req);
  if (!auth.ok) return auth.response;
  const { supabase, orgId } = auth;
  const { id } = await ctx.params;

  const parsed = await parseBody(req, rejectMemberSchema);
  if (!parsed.ok) return parsed.response;
  const note = parsed.data.note ?? null;

  const before = await readOrgProfile(supabase, orgId, id, "member");
  if (!before) return notFound("not_found", "Member not found");
  if (before.status !== "pending") {
    return conflict("invalid_state", "Only a pending member can be rejected", { status: before.status });
  }

  const { data: updated, error } = await supabase
    .from("profiles")
    .update({ status: "rejected", status_note: note })
    .eq("id", id)
    .eq("org_id", orgId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) return serverError("server_error", error.message);
  if (!updated) {
    const current = await readOrgProfile(supabase, orgId, id, "member");
    if (!current) return notFound("not_found", "Member not found");
    return conflict("invalid_state", "The member could not be rejected", { status: current.status });
  }

  const orgName = await orgNameFor(supabase, orgId);
  const recipient = { email: before.email, name: before.first_name, id: before.id };
  after(() => accountStatusChanged(recipient, orgName, "rejected", "rejected", note, { org_id: orgId }));

  return json({ id, status: "rejected" as const });
}
