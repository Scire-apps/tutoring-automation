/**
 * Cross-org session/approval read helpers for `/api/admin/*` (§6.4). The admin's
 * RLS-bound client sees every row (`private.is_admin()`), so these reads are NOT
 * org-scoped — found by id alone. The same guarded-UPDATE transition machinery as
 * the manage group applies, just without the org filter (the §6.4 "org check
 * bypassed" rule); the sessions_guard trigger still enforces transition legality.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  ADMIN_SESSION_SELECT,
  ADMIN_APPROVAL_SELECT,
  type SessionWithJoins,
  type ApprovalWithJoins,
} from "@/lib/admin/dtos";

/** Read a single session (with org + subject + both parties) by id, RLS-bound. */
export async function readAdminSession(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<SessionWithJoins | null> {
  const { data } = await supabase.from("sessions").select(ADMIN_SESSION_SELECT).eq("id", id).maybeSingle();
  return (data as unknown as SessionWithJoins) ?? null;
}

/** Read a single subject-approval row (no joins) by id — for the status pre-check. */
export async function readAdminApproval(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<Database["public"]["Tables"]["subject_approvals"]["Row"] | null> {
  const { data } = await supabase.from("subject_approvals").select("*").eq("id", id).maybeSingle();
  return (data as Database["public"]["Tables"]["subject_approvals"]["Row"]) ?? null;
}

/** Read a single subject-approval (with org + subject + member + decider) by id. */
export async function readAdminApprovalWithJoins(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<ApprovalWithJoins | null> {
  const { data } = await supabase.from("subject_approvals").select(ADMIN_APPROVAL_SELECT).eq("id", id).maybeSingle();
  return (data as unknown as ApprovalWithJoins) ?? null;
}
