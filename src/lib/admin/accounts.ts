/**
 * Cross-org account helpers for `/api/admin/accounts/*` (§6.4). The admin's
 * RLS-bound client sees every profile (`private.is_admin()`), so these reads are
 * NOT org-scoped — an account is found by id alone. The unified namespace spans
 * members, managers, and admins; routes enforce the kind a verb requires (409
 * `wrong_kind` on mismatch).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { ACCOUNT_SELECT, type ProfileWithOrg, type AccountAggregates } from "@/lib/admin/dtos";

type AccountKind = Database["public"]["Enums"]["account_kind"];

/** Sessions that count as "active" for the per-account aggregate (non-terminal, post-open). */
const ACTIVE_SESSION_STATUSES: Database["public"]["Enums"]["session_status"][] = [
  "claimed",
  "availability_set",
  "scheduled",
];

/** Read a single account (any kind) with its org by id, RLS-bound (admin sees all). */
export async function readAccount(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<ProfileWithOrg | null> {
  const { data } = await supabase.from("profiles").select(ACCOUNT_SELECT).eq("id", id).maybeSingle();
  return (data as unknown as ProfileWithOrg) ?? null;
}

/** A plain profile read by id (no org join) — for guards that only need kind/status/org_id. */
export async function readProfile(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<Database["public"]["Tables"]["profiles"]["Row"] | null> {
  const { data } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  return (data as Database["public"]["Tables"]["profiles"]["Row"]) ?? null;
}

/** The display name + email for a kind (used in 409 wrong_kind copy + emails). */
export const kindLabel: Record<AccountKind, string> = {
  member: "member",
  manager: "manager",
  admin: "admin",
};

/** Ledger SUM for one account (the single source of a member's total — no counter). */
export async function accountHoursTotal(
  supabase: SupabaseClient<Database>,
  profileId: string,
): Promise<number> {
  const { data } = await supabase.from("volunteer_hours_ledger").select("hours").eq("profile_id", profileId);
  const sum = (data ?? []).reduce((acc, r) => acc + Number(r.hours ?? 0), 0);
  return Math.round(sum * 100) / 100;
}

/**
 * The four per-account aggregates (`total_hours`, approved subjects, open
 * requests, active sessions) for a set of profile ids, in four RLS-bound reads
 * tallied in-app (PostgREST has no GROUP BY). Bounded by the caller's page size.
 * Returns a map id → aggregates (every requested id present, zero-filled).
 */
export async function accountAggregatesFor(
  supabase: SupabaseClient<Database>,
  profileIds: string[],
): Promise<Map<string, AccountAggregates>> {
  const map = new Map<string, AccountAggregates>();
  for (const id of profileIds) {
    map.set(id, { total_hours: 0, approved_subjects_count: 0, open_requests_count: 0, active_sessions_count: 0 });
  }
  if (!profileIds.length) return map;

  const [ledger, approvals, openRequests, activeSessions] = await Promise.all([
    supabase.from("volunteer_hours_ledger").select("profile_id, hours").in("profile_id", profileIds),
    supabase.from("subject_approvals").select("profile_id").in("profile_id", profileIds).eq("status", "approved"),
    supabase.from("sessions").select("requester_id").in("requester_id", profileIds).eq("status", "open"),
    supabase
      .from("sessions")
      .select("requester_id, tutor_id")
      .or(`requester_id.in.(${profileIds.join(",")}),tutor_id.in.(${profileIds.join(",")})`)
      .in("status", ACTIVE_SESSION_STATUSES),
  ]);

  for (const r of (ledger.data as Array<{ profile_id: string; hours: number | string }>) ?? []) {
    const a = map.get(r.profile_id);
    if (a) a.total_hours += Number(r.hours ?? 0);
  }
  for (const a of map.values()) a.total_hours = Math.round(a.total_hours * 100) / 100;

  for (const r of (approvals.data as Array<{ profile_id: string }>) ?? []) {
    const a = map.get(r.profile_id);
    if (a) a.approved_subjects_count += 1;
  }
  for (const r of (openRequests.data as Array<{ requester_id: string }>) ?? []) {
    const a = map.get(r.requester_id);
    if (a) a.open_requests_count += 1;
  }
  for (const r of (activeSessions.data as Array<{ requester_id: string; tutor_id: string | null }>) ?? []) {
    // A session can touch the same person only once as requester XOR tutor here.
    const a = map.get(r.requester_id) ?? (r.tutor_id ? map.get(r.tutor_id) : undefined);
    if (a) a.active_sessions_count += 1;
  }
  return map;
}
