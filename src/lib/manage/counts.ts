/**
 * Shared org-scoped badge counts for the manager panel (§5.3 / §5.4). One place
 * computes the five "needs attention" numbers so `GET overview` and
 * `GET counts` never drift. All reads are RLS-bound to the manager's org.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type ManageCounts = {
  /** Pending member admissions. */
  pending_admissions: number;
  /** Pending subject-approval requests. */
  approval_requests: number;
  /** Sessions awaiting verification (completed + needs_changes). */
  verification_queue: number;
  /** Pending peer managers awaiting activation. */
  pending_managers: number;
  /** Open help requests. */
  open_help: number;
};

/** Compute the five badge counts for an org (head-only count queries). */
export async function computeCounts(
  supabase: SupabaseClient<Database>,
  orgId: string,
): Promise<ManageCounts> {
  const head = { count: "exact" as const, head: true };
  const [members, approvals, sessions, help, managers] = await Promise.all([
    supabase
      .from("profiles")
      .select("id", head)
      .eq("org_id", orgId)
      .eq("kind", "member")
      .eq("status", "pending"),
    supabase
      .from("subject_approvals")
      .select("id", head)
      .eq("org_id", orgId)
      .eq("status", "pending"),
    supabase
      .from("sessions")
      .select("id", head)
      .eq("org_id", orgId)
      .in("status", ["completed", "needs_changes"]),
    supabase
      .from("help_requests")
      .select("id", head)
      .eq("org_id", orgId)
      .eq("status", "open"),
    supabase
      .from("profiles")
      .select("id", head)
      .eq("org_id", orgId)
      .eq("kind", "manager")
      .eq("status", "pending"),
  ]);

  return {
    pending_admissions: members.count ?? 0,
    approval_requests: approvals.count ?? 0,
    verification_queue: sessions.count ?? 0,
    pending_managers: managers.count ?? 0,
    open_help: help.count ?? 0,
  };
}
