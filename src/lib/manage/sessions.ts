/**
 * Shared session-administration helpers for `/api/manage/sessions/*` (§5.8).
 * RLS scopes every read/write to the manager's org (`managed_org`), so an
 * out-of-org id reads back null → 404.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { MANAGE_SESSION_SELECT, type SessionWithJoins } from "@/lib/manage/dtos";

/** Read a single session (with subject + both parties) by id, RLS-bound. */
export async function readManageSession(
  supabase: SupabaseClient<Database>,
  orgId: string,
  id: string,
): Promise<SessionWithJoins | null> {
  const { data } = await supabase
    .from("sessions")
    .select(MANAGE_SESSION_SELECT)
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  return (data as unknown as SessionWithJoins) ?? null;
}
