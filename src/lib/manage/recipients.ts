/**
 * Resolve transactional-email recipients for the manager panel from DB rows
 * (never request bodies, §2.7). A manager's RLS-bound client can read every
 * profile in their org (`managed_org` branch), so the same client the guard
 * returns fetches the member/manager/session-party email + display name.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type EmailRecipient = { email: string; name: string; id: string };

/**
 * Look up a profile's email + first name by id (RLS-bound). Returns null when the
 * row is invisible/absent so a missing notification never blocks a mutation.
 */
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
