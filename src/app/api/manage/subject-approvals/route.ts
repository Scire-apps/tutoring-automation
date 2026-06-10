import { after } from "next/server";
import { requireActiveManager } from "@/lib/auth";
import { json, listResponse, parseListParams, conflict, notFound, serverError } from "@/lib/http";
import { parseBody } from "@/lib/validation";
import { directGrantSchema } from "@/lib/manage/schemas";
import { readOrgProfile } from "@/lib/manage/members";
import { readApproval } from "@/lib/manage/approvals";
import {
  MANAGE_APPROVAL_SELECT,
  toManageApprovalDTO,
  type ApprovalWithJoins,
} from "@/lib/manage/dtos";
import { resolveRecipient } from "@/lib/manage/recipients";
import { approvalDecision } from "@/lib/email";
import type { Database } from "@/types/database";

type ApprovalStatus = Database["public"]["Enums"]["approval_status"];

export const dynamic = "force-dynamic";

const STATUS_VALUES: ApprovalStatus[] = ["pending", "approved", "rejected", "withdrawn", "revoked"];

/**
 * GET /api/manage/subject-approvals ?status&subject_id&member_id — the org's
 * approval queue/records (§5.6). Defaults to pending (the review queue). Filters
 * by subject and member. org_id is server-derived; RLS (`managed_org`) scopes it.
 */
export async function GET(req: Request) {
  const auth = await requireActiveManager(req);
  if (!auth.ok) return auth.response;
  const { supabase, orgId } = auth;
  const url = new URL(req.url);
  const { limit, offset } = parseListParams(url);

  const statusParam = url.searchParams.get("status");
  const status = STATUS_VALUES.includes(statusParam as ApprovalStatus)
    ? (statusParam as ApprovalStatus)
    : "pending";
  const subjectId = url.searchParams.get("subject_id");
  const memberId = url.searchParams.get("member_id");

  let query = supabase
    .from("subject_approvals")
    .select(MANAGE_APPROVAL_SELECT, { count: "exact" })
    .eq("org_id", orgId)
    .eq("status", status)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit - 1);

  if (subjectId) query = query.eq("org_subject_id", subjectId);
  if (memberId) query = query.eq("profile_id", memberId);

  const { data, error, count } = await query;
  if (error) return serverError("server_error", "Failed to load approvals");

  const items = ((data as unknown as ApprovalWithJoins[]) ?? []).map(toManageApprovalDTO);
  return listResponse(items, count ?? 0, { limit, offset });
}

/**
 * POST /api/manage/subject-approvals — direct-grant a subject to a member (§5.6).
 * One row per (member, subject): if no row exists it is INSERTed approved; if a
 * non-approved row exists it is flipped to approved (the same-row model). A
 * member must be the target (the approvals guard blocks granting to a non-member).
 * evidence stays NULL on direct grants; the approvals_audit trigger records
 * `subject_approval.granted`/`.approved`; an approval email fires.
 */
export async function POST(req: Request) {
  const auth = await requireActiveManager(req);
  if (!auth.ok) return auth.response;
  const { supabase, user, orgId } = auth;

  const parsed = await parseBody(req, directGrantSchema);
  if (!parsed.ok) return parsed.response;
  const { member_id, org_subject_id } = parsed.data;
  const note = parsed.data.note ?? null;

  // The member must exist in the org (and be a member — the guard re-checks too).
  const member = await readOrgProfile(supabase, orgId, member_id, "member");
  if (!member) return notFound("not_found", "Member not found");

  // The subject must belong to the org (cross-org grant is impossible structurally).
  const { data: subject } = await supabase
    .from("org_subjects")
    .select("id, name, category, grade_level")
    .eq("id", org_subject_id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!subject) return notFound("not_found", "Subject not found");

  // Same-row model: reuse an existing (member, subject) row if present.
  const { data: existing } = await supabase
    .from("subject_approvals")
    .select("id, status, direct_grant")
    .eq("org_id", orgId)
    .eq("profile_id", member_id)
    .eq("org_subject_id", org_subject_id)
    .maybeSingle();

  if (existing?.status === "approved") {
    return conflict("invalid_state", "This member is already approved for that subject", {
      status: existing.status,
    });
  }

  const nowIso = new Date().toISOString();
  // The evidence CHECK requires a non-null value on any decided (non-pending)
  // row, so a direct grant carries a sentinel; the UI keys off `direct_grant`
  // (not evidence) to render "Granted by a manager".
  const DIRECT_GRANT_EVIDENCE = "Granted directly by a manager";
  let approvalId: string;

  if (existing) {
    // Flip the existing row to an approved direct grant.
    const { data: upd, error: updErr } = await supabase
      .from("subject_approvals")
      .update({
        status: "approved",
        direct_grant: true,
        evidence: DIRECT_GRANT_EVIDENCE,
        decision_note: note,
        decided_by: user.id,
        decided_at: nowIso,
      })
      .eq("id", existing.id)
      .eq("org_id", orgId)
      .select("id")
      .maybeSingle();
    if (updErr) return serverError("server_error", updErr.message);
    if (!upd) return serverError("server_error", "Failed to grant the approval");
    approvalId = upd.id;
  } else {
    const { data: ins, error: insErr } = await supabase
      .from("subject_approvals")
      .insert({
        org_id: orgId,
        profile_id: member_id,
        org_subject_id,
        status: "approved",
        direct_grant: true,
        evidence: DIRECT_GRANT_EVIDENCE,
        decision_note: note,
        decided_by: user.id,
        decided_at: nowIso,
      })
      .select("id")
      .maybeSingle();
    if (insErr) return serverError("server_error", insErr.message);
    if (!ins) return serverError("server_error", "Failed to grant the approval");
    approvalId = ins.id;
  }

  // Notify the member they're approved.
  const recipient = await resolveRecipient(supabase, member_id);
  if (recipient) {
    after(() => approvalDecision(recipient, subject.name, "approved", note, { org_id: orgId }));
  }

  const row = await readApproval(supabase, orgId, approvalId);
  if (!row) return serverError("server_error", "Granted but the approval could not be reloaded");
  return json(toManageApprovalDTO(row), 201);
}
