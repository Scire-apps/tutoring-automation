import { requireActiveManager } from "@/lib/auth";
import { json, notFound, serverError } from "@/lib/http";
import { readOrgProfile } from "@/lib/manage/members";
import { AUDIT_SELECT, toAuditEntryDTO, type AuditWithActor } from "@/lib/manage/dtos";

export const dynamic = "force-dynamic";

/**
 * GET /api/manage/members/[id]/approvals/history — the per-subject decision
 * history for a member (§5.5), rendered from the audit timeline: every audit row
 * targeting one of the member's subject_approvals rows (the same-row model keeps
 * one row per subject, so history lives in the audit log). org_id is
 * server-derived; RLS scopes both reads to the org.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActiveManager(req);
  if (!auth.ok) return auth.response;
  const { supabase, orgId } = auth;
  const { id } = await ctx.params;

  const profile = await readOrgProfile(supabase, orgId, id, "member");
  if (!profile) return notFound("not_found", "Member not found");

  // The member's approval row ids (the audit targets).
  const { data: approvals, error: aErr } = await supabase
    .from("subject_approvals")
    .select("id")
    .eq("org_id", orgId)
    .eq("profile_id", id);
  if (aErr) return serverError("server_error", "Failed to load approval history");

  const ids = (approvals ?? []).map((r) => r.id);
  if (ids.length === 0) return json({ items: [] });

  const { data, error } = await supabase
    .from("audit_log")
    .select(AUDIT_SELECT)
    .eq("org_id", orgId)
    .eq("target_table", "subject_approvals")
    .in("target_id", ids)
    .order("id", { ascending: false });

  if (error) return serverError("server_error", "Failed to load approval history");

  const items = ((data as unknown as AuditWithActor[]) ?? []).map(toAuditEntryDTO);
  return json({ items });
}
