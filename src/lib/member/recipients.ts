/**
 * Resolve transactional-email recipients from DB rows (never request bodies,
 * §2.7). Members can read their org-mates' profiles under RLS, so the same
 * RLS-bound client the guard returns can fetch the counterpart's email for a
 * session-transition notification.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type EmailRecipient = { email: string; name: string; id: string };

/**
 * Look up a profile's email + display name by id, returning a ready-to-send
 * `Recipient`. Returns null when the row is invisible/absent (the caller simply
 * skips that email — a missing notification never blocks a transition).
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
