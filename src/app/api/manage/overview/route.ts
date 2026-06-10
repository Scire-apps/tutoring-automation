import { requireActiveManager } from "@/lib/auth";
import { json, serverError } from "@/lib/http";
import { AUDIT_SELECT, toAuditEntryDTO, type AuditWithActor } from "@/lib/manage/dtos";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export const dynamic = "force-dynamic";

type AttentionItem = { id: string; title: string; subtitle?: string | null };

const personName = (p: { first_name: string; last_name: string } | null): string =>
  p ? `${p.first_name} ${p.last_name}`.trim() : "Someone";

const subjectLabel = (s: { name: string; category: string | null; grade_level: number | null } | null): string => {
  if (!s) return "a subject";
  const bits = [s.name];
  if (s.category) bits.push(s.category);
  if (s.grade_level != null) bits.push(`Grade ${s.grade_level}`);
  return bits.join(" · ");
};

/** Top-5 pending admissions (oldest first — the queue order). */
async function admissions(supabase: SupabaseClient<Database>, orgId: string): Promise<AttentionItem[]> {
  const { data } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, created_at")
    .eq("org_id", orgId)
    .eq("kind", "member")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(5);
  return (data ?? []).map((p) => ({ id: p.id, title: personName(p), subtitle: "Awaiting admission" }));
}

/** Top-5 pending subject-approval requests. */
async function approvals(supabase: SupabaseClient<Database>, orgId: string): Promise<AttentionItem[]> {
  const { data } = await supabase
    .from("subject_approvals")
    .select(
      `id, created_at,
       member:profiles!subject_approvals_profile_fk ( first_name, last_name ),
       subject:org_subjects!subject_approvals_subject_fk ( name, category, grade_level )`,
    )
    .eq("org_id", orgId)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(5);
  type Row = {
    id: string;
    member: { first_name: string; last_name: string } | null;
    subject: { name: string; category: string | null; grade_level: number | null } | null;
  };
  return ((data as unknown as Row[]) ?? []).map((r) => ({
    id: r.id,
    title: personName(r.member),
    subtitle: subjectLabel(r.subject),
  }));
}

/** Top-5 sessions awaiting verification (completed + needs_changes, oldest first). */
async function verification(supabase: SupabaseClient<Database>, orgId: string): Promise<AttentionItem[]> {
  const { data } = await supabase
    .from("sessions")
    .select(
      `id, created_at,
       subject:org_subjects!sessions_subject_fk ( name, category, grade_level ),
       tutor:profiles!sessions_tutor_fk ( first_name, last_name )`,
    )
    .eq("org_id", orgId)
    .in("status", ["completed", "needs_changes"])
    .order("created_at", { ascending: true })
    .limit(5);
  type Row = {
    id: string;
    subject: { name: string; category: string | null; grade_level: number | null } | null;
    tutor: { first_name: string; last_name: string } | null;
  };
  return ((data as unknown as Row[]) ?? []).map((r) => ({
    id: r.id,
    title: subjectLabel(r.subject),
    subtitle: `Tutored by ${personName(r.tutor)}`,
  }));
}

/** Top-5 pending peer managers. */
async function managers(supabase: SupabaseClient<Database>, orgId: string): Promise<AttentionItem[]> {
  const { data } = await supabase
    .from("profiles")
    .select("id, first_name, last_name")
    .eq("org_id", orgId)
    .eq("kind", "manager")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(5);
  return (data ?? []).map((p) => ({ id: p.id, title: personName(p), subtitle: "Awaiting activation" }));
}

/** Top-5 open help requests (oldest first). */
async function help(supabase: SupabaseClient<Database>, orgId: string): Promise<AttentionItem[]> {
  const { data } = await supabase
    .from("help_requests")
    .select("id, description, member:profiles!help_requests_profile_id_fkey ( first_name, last_name )")
    .eq("org_id", orgId)
    .eq("status", "open")
    .order("created_at", { ascending: true })
    .limit(5);
  type Row = { id: string; description: string; member: { first_name: string; last_name: string } | null };
  return ((data as unknown as Row[]) ?? []).map((r) => ({
    id: r.id,
    title: personName(r.member),
    subtitle: r.description,
  }));
}

/**
 * GET /api/manage/overview — the dashboard aggregate (§5.4):
 *   - stats: active members, pending admissions, open requests, scheduled,
 *     awaiting verification, total hours awarded (ledger SUM of award rows);
 *   - attention: top-5 rows per queue for the inline-action strips;
 *   - recent_audit: the last 10 audit entries, human-readable.
 * org_id is server-derived; every read is RLS-bound to the org.
 */
export async function GET(req: Request) {
  const auth = await requireActiveManager(req);
  if (!auth.ok) return auth.response;
  const { supabase, orgId } = auth;
  const head = { count: "exact" as const, head: true };

  try {
    const [
      activeMembers,
      pendingAdmissions,
      openRequests,
      scheduled,
      awaitingVerification,
      awardRows,
      auditRes,
      admissionsList,
      approvalsList,
      verificationList,
      managersList,
      helpList,
    ] = await Promise.all([
      supabase.from("profiles").select("id", head).eq("org_id", orgId).eq("kind", "member").eq("status", "active"),
      supabase.from("profiles").select("id", head).eq("org_id", orgId).eq("kind", "member").eq("status", "pending"),
      supabase.from("sessions").select("id", head).eq("org_id", orgId).eq("status", "open"),
      supabase.from("sessions").select("id", head).eq("org_id", orgId).eq("status", "scheduled"),
      supabase.from("sessions").select("id", head).eq("org_id", orgId).in("status", ["completed", "needs_changes"]),
      supabase.from("volunteer_hours_ledger").select("hours").eq("org_id", orgId).eq("kind", "award"),
      supabase.from("audit_log").select(AUDIT_SELECT).eq("org_id", orgId).order("id", { ascending: false }).limit(10),
      admissions(supabase, orgId),
      approvals(supabase, orgId),
      verification(supabase, orgId),
      managers(supabase, orgId),
      help(supabase, orgId),
    ]);

    if (awardRows.error || auditRes.error) return serverError("server_error", "Failed to load overview");

    const totalHoursAwarded = (awardRows.data ?? []).reduce((sum, r) => sum + Number(r.hours ?? 0), 0);
    const recentAudit = ((auditRes.data as unknown as AuditWithActor[]) ?? []).map(toAuditEntryDTO);

    return json({
      stats: {
        active_members: activeMembers.count ?? 0,
        pending_admissions: pendingAdmissions.count ?? 0,
        open_requests: openRequests.count ?? 0,
        scheduled: scheduled.count ?? 0,
        awaiting_verification: awaitingVerification.count ?? 0,
        total_hours_awarded: Math.round(totalHoursAwarded * 100) / 100,
      },
      attention: {
        admissions: admissionsList,
        approvals: approvalsList,
        verification: verificationList,
        managers: managersList,
        help: helpList,
      },
      recent_audit: recentAudit,
    });
  } catch {
    return serverError("server_error", "Failed to load overview");
  }
}
