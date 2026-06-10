/**
 * Shared subject-approval helpers for `/api/manage/subject-approvals/*` (§5.6).
 * RLS scopes every read/write to the manager's org (`managed_org`), so an
 * out-of-org id reads back null → 404.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { MANAGE_APPROVAL_SELECT, type ApprovalWithJoins } from "@/lib/manage/dtos";

/** Read a single approval (with subject + member + decider) by id, RLS-bound. */
export async function readApproval(
  supabase: SupabaseClient<Database>,
  orgId: string,
  id: string,
): Promise<ApprovalWithJoins | null> {
  const { data } = await supabase
    .from("subject_approvals")
    .select(MANAGE_APPROVAL_SELECT)
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  return (data as unknown as ApprovalWithJoins) ?? null;
}
