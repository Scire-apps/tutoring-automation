import { requireAdmin } from "@/lib/auth";
import { json, conflict, notFound, serverError } from "@/lib/http";
import { deleteAuthUser } from "@/lib/auth-admin";
import { readAccount, accountHoursTotal } from "@/lib/admin/accounts";
import {
  toAdminAccountDTO,
  type AdminAccountApproval,
  type AdminAccountSession,
  type AdminAccountDetail,
  type SubjectRef,
  type PersonRef,
} from "@/lib/admin/dtos";

export const dynamic = "force-dynamic";

const UNKNOWN_SUBJECT = (id: string): SubjectRef => ({ id, name: "Unknown subject", category: null, grade_level: null });

type ApprovalRow = {
  id: string;
  org_subject_id: string;
  status: AdminAccountApproval["status"];
  evidence: string | null;
  decision_note: string | null;
  direct_grant: boolean;
  decided_at: string | null;
  created_at: string;
  subject: SubjectRef | null;
};

type SessionRow = {
  id: string;
  org_subject_id: string;
  status: AdminAccountSession["status"];
  requester_id: string;
  tutor_id: string | null;
  scheduled_at: string | null;
  created_at: string;
  subject: SubjectRef | null;
  requester: PersonRef;
  tutor: PersonRef;
};

/**
 * GET /api/admin/accounts/[id] — full account detail (§6.4): profile (with org) +
 * the member's subject approvals + a session summary (as requester AND tutor) +
 * hours total (ledger SUM). Manager/admin accounts simply carry empty
 * approvals/sessions. Cross-org admin read. requireAdmin gates.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { supabase } = auth;
  const { id } = await ctx.params;

  const account = await readAccount(supabase, id);
  if (!account) return notFound("not_found", "Account not found");

  const [approvalsRes, sessionsRes, totalHours] = await Promise.all([
    supabase
      .from("subject_approvals")
      .select(
        `id, org_subject_id, status, evidence, decision_note, direct_grant, decided_at, created_at,
         subject:org_subjects!subject_approvals_subject_fk ( id, name, category, grade_level )`,
      )
      .eq("profile_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("sessions")
      .select(
        `id, org_subject_id, status, requester_id, tutor_id, scheduled_at, created_at,
         subject:org_subjects!sessions_subject_fk ( id, name, category, grade_level ),
         requester:profiles!sessions_requester_fk ( id, first_name, last_name ),
         tutor:profiles!sessions_tutor_fk ( id, first_name, last_name )`,
      )
      .or(`requester_id.eq.${id},tutor_id.eq.${id}`)
      .order("created_at", { ascending: false })
      .limit(50),
    accountHoursTotal(supabase, id),
  ]);

  if (approvalsRes.error || sessionsRes.error) {
    return serverError("server_error", "Failed to load account detail");
  }

  const approvals: AdminAccountApproval[] = ((approvalsRes.data as unknown as ApprovalRow[]) ?? []).map((a) => ({
    id: a.id,
    subject: a.subject ?? UNKNOWN_SUBJECT(a.org_subject_id),
    status: a.status,
    evidence: a.evidence,
    decision_note: a.decision_note,
    direct_grant: a.direct_grant,
    decided_at: a.decided_at,
    created_at: a.created_at,
  }));

  let sessionsTutored = 0;
  let sessionsReceived = 0;
  const sessions: AdminAccountSession[] = ((sessionsRes.data as unknown as SessionRow[]) ?? []).map((s) => {
    const role: "requester" | "tutor" = s.requester_id === id ? "requester" : "tutor";
    if (role === "tutor") sessionsTutored += 1;
    else sessionsReceived += 1;
    return {
      id: s.id,
      subject: s.subject ?? UNKNOWN_SUBJECT(s.org_subject_id),
      status: s.status,
      role,
      counterpart: role === "requester" ? s.tutor : s.requester,
      scheduled_at: s.scheduled_at,
      created_at: s.created_at,
    };
  });

  const detail: AdminAccountDetail = {
    account: toAdminAccountDTO(account),
    total_hours: totalHours,
    approvals,
    sessions,
    counts: {
      approved_subjects: approvals.filter((a) => a.status === "approved").length,
      sessions_tutored: sessionsTutored,
      sessions_received: sessionsReceived,
    },
  };
  return json(detail);
}

/**
 * DELETE /api/admin/accounts/[id] — hard-delete a pending|rejected account (§6.4).
 * Load-bearing: `auth.admin.deleteUser` FREES THE EMAIL for re-invite (the profile
 * cascades on the auth.users delete). Refused for active|suspended accounts → 409
 * `invalid_state`. The two-step mistaken-signup runbook is delete-then-invite.
 * requireAdmin gates; deletion goes through the sanctioned `lib/auth-admin` wrapper.
 */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { supabase } = auth;
  const { id } = await ctx.params;

  const account = await readAccount(supabase, id);
  if (!account) return notFound("not_found", "Account not found");
  if (account.status !== "pending" && account.status !== "rejected") {
    return conflict("invalid_state", "Only a pending or rejected account can be deleted", { status: account.status });
  }

  const { error } = await deleteAuthUser(id);
  if (error) return serverError("server_error", error.message);
  return new Response(null, { status: 204 });
}
