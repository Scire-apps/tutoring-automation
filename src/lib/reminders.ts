/**
 * Session reminder job — DEMOLITION STUB.
 *
 * The legacy Flask-ported implementation queried dropped legacy tables and the
 * old per-role reminder emails. It is intentionally inert during the rebuild:
 * the org-aware reminder pass (reading `sessions` joined to the new `profiles`
 * / `org_subjects` schema and sending the Scire session-reminder template) is
 * rebuilt in the member slice (§7.8). Until then this returns 0 so the cron
 * route stays a green, authorized no-op.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export async function sendSessionReminders(
  _supabase: SupabaseClient<Database>,
): Promise<number> {
  return 0;
}
