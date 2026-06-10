/**
 * Cross-org account helpers for `/api/admin/accounts/*` (§6.4). The admin's
 * RLS-bound client sees every profile (`private.is_admin()`), so these reads are
 * NOT org-scoped — an account is found by id alone. The unified namespace spans
 * members, managers, and admins; routes enforce the kind a verb requires (409
 * `wrong_kind` on mismatch).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { ACCOUNT_SELECT, type ProfileWithOrg } from "@/lib/admin/dtos";

type AccountKind = Database["public"]["Enums"]["account_kind"];

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
