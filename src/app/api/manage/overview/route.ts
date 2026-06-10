import { requireActiveManager } from "@/lib/auth";
import { json, serverError } from "@/lib/http";
import { computeCounts } from "@/lib/manage/counts";
import { AUDIT_SELECT, toAuditEntryDTO, type AuditWithActor } from "@/lib/manage/dtos";

export const dynamic = "force-dynamic";

/**
 * GET /api/manage/overview — the dashboard aggregate (§5.4 / §7.2 slimmed):
 *   - counts: the five "needs attention" numbers (shared with GET counts);
 *   - hours_awarded_total: org-wide SUM of award ledger rows;
 *   - recent_audit: the last 10 audit entries in the manager's org, human-readable.
 * org_id is server-derived; every read is RLS-bound to the org.
 */
export async function GET(req: Request) {
  const auth = await requireActiveManager(req);
  if (!auth.ok) return auth.response;
  const { supabase, orgId } = auth;

  try {
    const [counts, awardRows, auditRes] = await Promise.all([
      computeCounts(supabase, orgId),
      supabase
        .from("volunteer_hours_ledger")
        .select("hours")
        .eq("org_id", orgId)
        .eq("kind", "award"),
      supabase
        .from("audit_log")
        .select(AUDIT_SELECT)
        .eq("org_id", orgId)
        .order("id", { ascending: false })
        .limit(10),
    ]);

    if (awardRows.error || auditRes.error) {
      return serverError("server_error", "Failed to load overview");
    }

    const hoursAwardedTotal = (awardRows.data ?? []).reduce((sum, r) => sum + Number(r.hours ?? 0), 0);
    const recentAudit = ((auditRes.data as unknown as AuditWithActor[]) ?? []).map(toAuditEntryDTO);

    return json({
      org: { id: orgId },
      counts,
      hours_awarded_total: Math.round(hoursAwardedTotal * 100) / 100,
      recent_audit: recentAudit,
    });
  } catch {
    return serverError("server_error", "Failed to load overview");
  }
}
