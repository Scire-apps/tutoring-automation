import { requireAdmin } from "@/lib/auth";
import { json, conflict, notFound, serverError } from "@/lib/http";
import { deleteAuthUser } from "@/lib/auth-admin";
import { readAccount, accountAggregatesFor } from "@/lib/admin/accounts";
import {
  toAdminAccountDTO,
  type AdminAccountApproval,
  type AdminAccountSession,
  type AdminLedgerEntry,
  type AdminAccountDetail,
  type SubjectRef,
  type PersonRef,
} from "@/lib/admin/dtos";

export const dynamic = "force-dynamic";

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

type LedgerRow = {
  id: number;
  kind: AdminLedgerEntry["kind"];
  hours: number | string;
  note: string | null;
  session_id: string | null;
  created_at: string;
  awarded_by: { first_name: string; last_name: string } | null;
};

/**
 * GET /api/admin/accounts/[id] — full account detail (§6.4): the flat account row
 * (profile + org + the four aggregates) plus the member's subject approvals, a
 * session summary (as requester AND tutor), and the ledger. Manager/admin
 * accounts simply carry empty approvals/sessions/ledger. Cross-org admin read.
 * requireAdmin gates.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { supabase } = auth;
  const { id } = await ctx.params;

  const account = await readAccount(supabase, id);
  if (!account) return notFound("not_found", "Account not found");

  const [approvalsRes, sessionsRes, ledgerRes, aggregates] = await Promise.all([
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
    supabase
      .from("volunteer_hours_ledger")
      .select(
        `id, kind, hours, note, session_id, created_at,
         awarded_by:profiles!volunteer_hours_ledger_awarded_by_fkey ( first_name, last_name )`,
      )
      .eq("profile_id", id)
      .order("id", { ascending: false }),
    accountAggregatesFor(supabase, [id]),
  ]);

  if (approvalsRes.error || sessionsRes.error || ledgerRes.error) {
    return serverError("server_error", "Failed to load account detail");
  }

  const approvals: AdminAccountApproval[] = ((approvalsRes.data as unknown as ApprovalRow[]) ?? []).map((a) => ({
    id: a.id,
    org_subject_id: a.org_subject_id,
    name: a.subject?.name ?? "Unknown subject",
    category: a.subject?.category ?? null,
    grade_level: a.subject?.grade_level ?? null,
    status: a.status,
    evidence: a.evidence,
    decision_note: a.decision_note,
    direct_grant: a.direct_grant,
    decided_at: a.decided_at,
    created_at: a.created_at,
  }));

  const sessions: AdminAccountSession[] = ((sessionsRes.data as unknown as SessionRow[]) ?? []).map((s) => {
    const role: "requester" | "tutor" = s.requester_id === id ? "requester" : "tutor";
    return {
      id: s.id,
      name: s.subject?.name ?? "Unknown subject",
      category: s.subject?.category ?? null,
      grade_level: s.subject?.grade_level ?? null,
      status: s.status,
      role,
      counterpart: role === "requester" ? s.tutor : s.requester,
      scheduled_at: s.scheduled_at,
      created_at: s.created_at,
    };
  });

  const ledger: AdminLedgerEntry[] = ((ledgerRes.data as unknown as LedgerRow[]) ?? []).map((l) => ({
    id: l.id,
    kind: l.kind,
    hours: Number(l.hours ?? 0),
    note: l.note,
    session_id: l.session_id,
    awarded_by_name: l.awarded_by ? `${l.awarded_by.first_name} ${l.awarded_by.last_name}`.trim() : null,
    created_at: l.created_at,
  }));

  const detail: AdminAccountDetail = {
    ...toAdminAccountDTO(account, aggregates.get(id)),
    approvals,
    sessions,
    ledger,
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
