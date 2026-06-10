/**
 * Shared member-administration helpers for `/api/manage/members/*` (§5.5).
 * A manager reads/updates ONLY profiles in their own org; RLS (`managed_org`
 * branch) + the profiles guard enforce that, so these helpers stay RLS-bound and
 * an out-of-org id simply reads back as null → 404.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * Read a profile by id within the manager's org, requiring a given kind. Returns
 * null when invisible/absent/wrong-kind (the route maps null → 404; the guard
 * already blocks cross-org, this is belt-and-suspenders + the kind gate).
 */
export async function readOrgProfile(
  supabase: SupabaseClient<Database>,
  orgId: string,
  id: string,
  kind: Database["public"]["Enums"]["account_kind"],
): Promise<ProfileRow | null> {
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .eq("kind", kind)
    .maybeSingle();
  return (data as ProfileRow) ?? null;
}

/** The org's display name (RLS-bound; a manager can read their own org). */
export async function orgNameFor(
  supabase: SupabaseClient<Database>,
  orgId: string,
): Promise<string> {
  const { data } = await supabase.from("organizations").select("name").eq("id", orgId).maybeSingle();
  return data?.name ?? "your organization";
}

export type MemberAggregate = { approved_subjects: number; hours_total: number };

/** Approved-subjects count + ledger SUM for one member (RLS-bound). */
export async function memberAggregate(
  supabase: SupabaseClient<Database>,
  orgId: string,
  memberId: string,
): Promise<MemberAggregate> {
  const [approvals, ledger] = await Promise.all([
    supabase
      .from("subject_approvals")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("profile_id", memberId)
      .eq("status", "approved"),
    supabase
      .from("volunteer_hours_ledger")
      .select("hours")
      .eq("org_id", orgId)
      .eq("profile_id", memberId),
  ]);
  const hours = (ledger.data ?? []).reduce((sum, r) => sum + Number(r.hours ?? 0), 0);
  return {
    approved_subjects: approvals.count ?? 0,
    hours_total: Math.round(hours * 100) / 100,
  };
}
