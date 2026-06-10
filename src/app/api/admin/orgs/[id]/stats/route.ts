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
    managersActive,
    managersPending,
    openSessions,
    scheduledSessions,
    awaitingVerification,
    subjectsActive,
    awardRows,
  ] = await Promise.all([
    supabase.from("profiles").select("id", head).eq("org_id", id).eq("kind", "member").eq("status", "active"),
    supabase.from("profiles").select("id", head).eq("org_id", id).eq("kind", "member").eq("status", "pending"),
    supabase.from("profiles").select("id", head).eq("org_id", id).eq("kind", "manager").eq("status", "active"),
    supabase.from("profiles").select("id", head).eq("org_id", id).eq("kind", "manager").eq("status", "pending"),
    supabase.from("sessions").select("id", head).eq("org_id", id).eq("status", "open"),
    supabase.from("sessions").select("id", head).eq("org_id", id).eq("status", "scheduled"),
    supabase.from("sessions").select("id", head).eq("org_id", id).in("status", ["completed", "needs_changes"]),
    supabase.from("org_subjects").select("id", head).eq("org_id", id).eq("active", true),
    supabase.from("volunteer_hours_ledger").select("hours").eq("org_id", id).eq("kind", "award"),
  ]);

  if (awardRows.error) return serverError("server_error", "Failed to load organization stats");

  const totalHoursAwarded = (awardRows.data ?? []).reduce((sum, r) => sum + Number(r.hours ?? 0), 0);

  const stats: AdminOrgStats = {
    active_members: membersActive.count ?? 0,
    pending_members: membersPending.count ?? 0,
    active_managers: managersActive.count ?? 0,
    pending_managers: managersPending.count ?? 0,
    open_requests: openSessions.count ?? 0,
    scheduled: scheduledSessions.count ?? 0,
    awaiting_verification: awaitingVerification.count ?? 0,
    hours_awarded: Math.round(totalHoursAwarded * 100) / 100,
    subjects_active: subjectsActive.count ?? 0,
  };
  return json(stats);
}
