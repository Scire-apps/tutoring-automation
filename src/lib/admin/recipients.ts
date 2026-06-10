/**
 * Resolve transactional-email recipients for the admin panel from DB rows (never
 * request bodies, §2.7). An admin's RLS-bound client can read every profile
 * (`private.is_admin()`), so the same client the guard returns fetches any
 * account's email + display name across orgs.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type EmailRecipient = { email: string; name: string; id: string };

/** Look up a profile's email + first name by id (RLS-bound; admin sees all). */
export async function resolveRecipient(
  supabase: SupabaseClient<Database>,
  profileId: string | null | undefined,
): Promise<EmailRecipient | null> {
  if (!profileId) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, email, first_name")
    .eq("id", profileId)
    .maybeSingle();
  if (!data?.email) return null;
  return { email: data.email, name: data.first_name, id: data.id };
}

/** The org's display name by id (RLS-bound; admin reads all orgs). */
export async function orgNameFor(
  supabase: SupabaseClient<Database>,
  orgId: string | null | undefined,
): Promise<string> {
  if (!orgId) return "your organization";
  const { data } = await supabase.from("organizations").select("name").eq("id", orgId).maybeSingle();
  return data?.name ?? "your organization";
}
