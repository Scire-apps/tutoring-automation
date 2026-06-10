import { requireAdmin } from "@/lib/auth";
import { json, serverError } from "@/lib/http";
import { ADMIN_AUDIT_SELECT, toAdminAuditDTO, type AuditWithJoins } from "@/lib/admin/dtos";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/overview — the platform dashboard aggregate (§6.3 / §6.4):
 *   - stats: org totals (active/archived), account totals by kind, pending
 *     managers (the contact-Scire back-office), open + awaiting-verification
 *     sessions, total verified hours across the platform;
 *   - recent_audit: the last 10 audit entries (org-named, human-readable).
 * Cross-org by design (RLS grants admin all rows via `private.is_admin()`).
 */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { supabase } = auth;
  const head = { count: "exact" as const, head: true };

  try {
    const [
      orgsActive,
      orgsArchived,
      members,
      managers,
      admins,
      pendingMembers,
      pendingManagers,
      openSessions,
      awaitingVerification,
      awardRows,
      auditRes,
    ] = await Promise.all([
      supabase.from("organizations").select("id", head).is("archived_at", null),
      supabase.from("organizations").select("id", head).not("archived_at", "is", null),
      supabase.from("profiles").select("id", head).eq("kind", "member"),
      supabase.from("profiles").select("id", head).eq("kind", "manager"),
      supabase.from("profiles").select("id", head).eq("kind", "admin"),
      supabase.from("profiles").select("id", head).eq("kind", "member").eq("status", "pending"),
      supabase.from("profiles").select("id", head).eq("kind", "manager").eq("status", "pending"),
      supabase.from("sessions").select("id", head).eq("status", "open"),
      supabase.from("sessions").select("id", head).in("status", ["completed", "needs_changes"]),
      supabase.from("volunteer_hours_ledger").select("hours").eq("kind", "award"),
      supabase.from("audit_log").select(ADMIN_AUDIT_SELECT).order("id", { ascending: false }).limit(10),
    ]);

    if (awardRows.error || auditRes.error) return serverError("server_error", "Failed to load overview");

    const totalHoursAwarded = (awardRows.data ?? []).reduce((sum, r) => sum + Number(r.hours ?? 0), 0);
    const recentAudit = ((auditRes.data as unknown as AuditWithJoins[]) ?? []).map(toAdminAuditDTO);

    return json({
      stats: {
        orgs_active: orgsActive.count ?? 0,
        orgs_archived: orgsArchived.count ?? 0,
        members_total: members.count ?? 0,
        managers_total: managers.count ?? 0,
        admins_total: admins.count ?? 0,
        pending_members: pendingMembers.count ?? 0,
        pending_managers: pendingManagers.count ?? 0,
        open_sessions: openSessions.count ?? 0,
        awaiting_verification: awaitingVerification.count ?? 0,
        total_hours_awarded: Math.round(totalHoursAwarded * 100) / 100,
      },
      recent_audit: recentAudit,
    });
  } catch {
    return serverError("server_error", "Failed to load overview");
  }
}
