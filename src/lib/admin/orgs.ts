/**
 * Org-administration helpers for `/api/admin/orgs/*` (§6.3 / §6.4). Membership
 * counts for the orgs list/detail are computed with one grouped read over
 * profiles (admin sees every row via `private.is_admin()`); the per-org stats
 * page fans out a wider count set. Org creation goes through the
 * `create_organization` RPC on the admin's OWN client so the audit trigger
 * records the real actor.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { OrgCounts } from "@/lib/admin/dtos";

type AccountKind = Database["public"]["Enums"]["account_kind"];
type AccountStatus = Database["public"]["Enums"]["account_status"];

const EMPTY_COUNTS: OrgCounts = { members: 0, managers: 0, pending: 0 };

/**
 * Membership counts for a set of org ids in ONE profiles read (kind + status per
 * row, tallied in-app — PostgREST has no GROUP BY). members = active members;
 * managers = active managers; pending = pending members + pending managers.
 * Returns a map id → counts (every requested id present, zero-filled).
 */
export async function orgCountsFor(
  supabase: SupabaseClient<Database>,
  orgIds: string[],
): Promise<Map<string, OrgCounts>> {
  const map = new Map<string, OrgCounts>();
  for (const id of orgIds) map.set(id, { ...EMPTY_COUNTS });
  if (!orgIds.length) return map;

  const { data } = await supabase
    .from("profiles")
    .select("org_id, kind, status")
    .in("org_id", orgIds);

  for (const row of (data as Array<{ org_id: string | null; kind: AccountKind; status: AccountStatus }>) ?? []) {
    if (!row.org_id) continue;
    const c = map.get(row.org_id);
    if (!c) continue;
    if (row.status === "pending") c.pending += 1;
    else if (row.status === "active" && row.kind === "member") c.members += 1;
    else if (row.status === "active" && row.kind === "manager") c.managers += 1;
  }
  return map;
}

/** Counts for a single org (convenience over `orgCountsFor`). */
export async function orgCounts(
  supabase: SupabaseClient<Database>,
  orgId: string,
): Promise<OrgCounts> {
  const map = await orgCountsFor(supabase, [orgId]);
  return map.get(orgId) ?? { ...EMPTY_COUNTS };
}

/** Read an org row by id, RLS-bound (admin reads archived + active). */
export async function readOrg(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<Database["public"]["Tables"]["organizations"]["Row"] | null> {
  const { data } = await supabase.from("organizations").select("*").eq("id", id).maybeSingle();
  return (data as Database["public"]["Tables"]["organizations"]["Row"]) ?? null;
}

/**
 * Whether `slug` collides with a DIFFERENT non-archived org (the partial unique
 * index only spans active orgs; restore/rename must re-check). Returns true on
 * collision. `excludeId` lets a rename ignore the org's own row.
 */
export async function activeSlugTaken(
  supabase: SupabaseClient<Database>,
  slug: string,
  excludeId?: string,
): Promise<boolean> {
  let query = supabase
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .is("archived_at", null);
  if (excludeId) query = query.neq("id", excludeId);
  const { data } = await query.limit(1);
  return (data?.length ?? 0) > 0;
}

/** Whether `name` collides with a DIFFERENT org (name is globally UNIQUE). */
export async function nameTaken(
  supabase: SupabaseClient<Database>,
  name: string,
  excludeId?: string,
): Promise<boolean> {
  let query = supabase.from("organizations").select("id").eq("name", name);
  if (excludeId) query = query.neq("id", excludeId);
  const { data } = await query.limit(1);
  return (data?.length ?? 0) > 0;
}
