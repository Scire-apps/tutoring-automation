import { requireActiveMember } from "@/lib/auth";
import { json, conflict, notFound, serverError } from "@/lib/http";
import { parseBody } from "@/lib/validation";
import { subjectApprovalSchema } from "@/lib/member/schemas";
import { APPROVAL_SELECT, toMemberApprovalDTO, type ApprovalWithSubject } from "@/lib/member/approval-dto";

export const dynamic = "force-dynamic";

/**
 * GET /api/member/subject-approvals — the caller's approval rows across all five
 * states (pending|approved|rejected|withdrawn|revoked), subject-hydrated (§4.8).
 * RLS scopes to `profile_id = self`.
 */
export async function GET(req: Request) {
  const auth = await requireActiveMember(req);
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const { data, error } = await supabase
    .from("subject_approvals")
    .select(APPROVAL_SELECT)
    .eq("profile_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return serverError("server_error", "Failed to load approvals");
  return json({ items: ((data as unknown as ApprovalWithSubject[]) ?? []).map(toMemberApprovalDTO) });
}

/**
 * POST /api/member/subject-approvals — request approval to tutor a subject
 * (§7.2). The same-row model (UNIQUE(profile_id, org_subject_id)) governs:
 *   - already pending or approved → 409 `invalid_state` (no duplicate request);
 *   - previously rejected or withdrawn → flip THAT row back to `pending` with
 *     fresh evidence and cleared decision fields (a re-request);
 *   - revoked → 409 `invalid_state` (revoked is terminal for the member; only a
 *     manager can re-grant);
 *   - no row yet → INSERT a fresh pending request.
 * The subject must exist in the caller's active catalog. No email — the manager
 * is notified through their queue, not a transactional send.
 */
export async function POST(req: Request) {
  const auth = await requireActiveMember(req);
  if (!auth.ok) return auth.response;
  const { supabase, user, orgId } = auth;

  const parsed = await parseBody(req, subjectApprovalSchema);
  if (!parsed.ok) return parsed.response;
  const { org_subject_id, evidence } = parsed.data;

  // Subject must be a real, active subject in the caller's org.
  const { data: subject } = await supabase
    .from("org_subjects")
    .select("id")
    .eq("id", org_subject_id)
    .eq("org_id", orgId)
    .eq("active", true)
    .maybeSingle();
  if (!subject) return notFound("not_found", "Subject not found in your organization");

  // Existing row for this (member, subject)?
  const { data: existing } = await supabase
    .from("subject_approvals")
    .select("id, status")
    .eq("profile_id", user.id)
    .eq("org_subject_id", org_subject_id)
    .maybeSingle();

  if (existing) {
    if (existing.status === "pending" || existing.status === "approved") {
      return conflict("invalid_state", `You already have a ${existing.status} request for this subject`, {
        status: existing.status,
      });
    }
    if (existing.status === "revoked") {
      return conflict("invalid_state", "This approval was revoked by a manager and cannot be re-requested", {
        status: "revoked",
      });
    }
    // rejected | withdrawn → re-request the same row.
    const { data: updated, error: updErr } = await supabase
      .from("subject_approvals")
      .update({ status: "pending", evidence, decision_note: null, decided_by: null, decided_at: null })
      .eq("id", existing.id)
      .eq("status", existing.status)
      .select(APPROVAL_SELECT)
      .maybeSingle();
    if (updErr) return conflict("invalid_state", updErr.message);
    if (!updated) return conflict("invalid_state", "Request could not be resubmitted");
    return json(toMemberApprovalDTO(updated as unknown as ApprovalWithSubject), 200);
  }

  // No row yet — create a fresh pending request.
  const { data: inserted, error: insErr } = await supabase
    .from("subject_approvals")
    .insert({
      org_id: orgId,
      profile_id: user.id,
      org_subject_id,
      status: "pending",
      evidence,
      direct_grant: false,
    })
    .select(APPROVAL_SELECT)
    .maybeSingle();

  if (insErr) {
    // Unique-violation racing a concurrent create.
    if (insErr.code === "23505") {
      return conflict("invalid_state", "You already have a request for this subject");
    }
    return serverError("server_error", insErr.message);
  }
  if (!inserted) return serverError("server_error", "Failed to create request");

  return json(toMemberApprovalDTO(inserted as unknown as ApprovalWithSubject), 201);
}
