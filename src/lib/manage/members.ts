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

export type MemberAggregate = {
  approved_subjects: number;
  hours_total: number;
  open_requests: number;
  active_sessions: number;
};

/**
 * Approved-subjects count + ledger SUM + activity counts for one member
 * (RLS-bound). open_requests = the member's own `open` sessions; active_sessions
 * = in-flight rows (claimed→scheduled) where the member is either party.
 */
export async function memberAggregate(
  supabase: SupabaseClient<Database>,
  orgId: string,
  memberId: string,
): Promise<MemberAggregate> {
  const ACTIVE: Database["public"]["Enums"]["session_status"][] = ["claimed", "availability_set", "scheduled"];
  const [approvals, ledger, openReq, activeSess] = await Promise.all([
    supabase
      .from("subject_approvals")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("profile_id", memberId)
      .eq("status", "approved"),
    supabase.from("volunteer_hours_ledger").select("hours").eq("org_id", orgId).eq("profile_id", memberId),
    supabase
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("requester_id", memberId)
      .eq("status", "open"),
    supabase
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .in("status", ACTIVE)
      .or(`requester_id.eq.${memberId},tutor_id.eq.${memberId}`),
  ]);
  const hours = (ledger.data ?? []).reduce((sum, r) => sum + Number(r.hours ?? 0), 0);
  return {
    approved_subjects: approvals.count ?? 0,
    hours_total: Math.round(hours * 100) / 100,
    open_requests: openReq.count ?? 0,
    active_sessions: activeSess.count ?? 0,
  };
}
