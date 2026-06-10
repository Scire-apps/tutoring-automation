import { requireAdmin } from "@/lib/auth";
import { json, notFound, serverError } from "@/lib/http";
import { readOrg } from "@/lib/admin/orgs";
import type { AdminOrgStats } from "@/lib/admin/dtos";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/orgs/[id]/stats — full platform stats for one org (§6.4): member
 * counts by status, manager counts, session lifecycle tallies, active subjects,
 * and total verified hours (ledger SUM of award rows). Cross-org admin read.
 * requireAdmin gates the route.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { supabase } = auth;
  const { id } = await ctx.params;

  const org = await readOrg(supabase, id);
  if (!org) return notFound("not_found", "Organization not found");

  const head = { count: "exact" as const, head: true };
  const [
    membersActive,
    membersPending,
    membersSuspended,
    membersRejected,
    managersActive,
    managersPending,
    openSessions,
    scheduledSessions,
    awaitingVerification,
    verifiedSessions,
    subjectsActive,
    awardRows,
  ] = await Promise.all([
    supabase.from("profiles").select("id", head).eq("org_id", id).eq("kind", "member").eq("status", "active"),
    supabase.from("profiles").select("id", head).eq("org_id", id).eq("kind", "member").eq("status", "pending"),
    supabase.from("profiles").select("id", head).eq("org_id", id).eq("kind", "member").eq("status", "suspended"),
    supabase.from("profiles").select("id", head).eq("org_id", id).eq("kind", "member").eq("status", "rejected"),
    supabase.from("profiles").select("id", head).eq("org_id", id).eq("kind", "manager").eq("status", "active"),
    supabase.from("profiles").select("id", head).eq("org_id", id).eq("kind", "manager").eq("status", "pending"),
    supabase.from("sessions").select("id", head).eq("org_id", id).eq("status", "open"),
    supabase.from("sessions").select("id", head).eq("org_id", id).eq("status", "scheduled"),
    supabase.from("sessions").select("id", head).eq("org_id", id).in("status", ["completed", "needs_changes"]),
    supabase.from("sessions").select("id", head).eq("org_id", id).eq("status", "verified"),
    supabase.from("org_subjects").select("id", head).eq("org_id", id).eq("active", true),
    supabase.from("volunteer_hours_ledger").select("hours").eq("org_id", id).eq("kind", "award"),
  ]);

  if (awardRows.error) return serverError("server_error", "Failed to load organization stats");

  const totalHoursAwarded = (awardRows.data ?? []).reduce((sum, r) => sum + Number(r.hours ?? 0), 0);

  const stats: AdminOrgStats = {
    members_active: membersActive.count ?? 0,
    members_pending: membersPending.count ?? 0,
    members_suspended: membersSuspended.count ?? 0,
    members_rejected: membersRejected.count ?? 0,
    managers_active: managersActive.count ?? 0,
    managers_pending: managersPending.count ?? 0,
    open_sessions: openSessions.count ?? 0,
    scheduled_sessions: scheduledSessions.count ?? 0,
    awaiting_verification: awaitingVerification.count ?? 0,
    verified_sessions: verifiedSessions.count ?? 0,
    subjects_active: subjectsActive.count ?? 0,
    total_hours_awarded: Math.round(totalHoursAwarded * 100) / 100,
  };
  return json(stats);
}
