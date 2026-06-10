/**
 * Manager-broadcast support for `/api/manage/emails` (§5.12 / §2.7). Recipients
 * are ALWAYS resolved server-side from the manager's org profiles (never request
 * bodies); the daily cap and batch grouping live here too. RLS scopes every read
 * to the org.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { BroadcastBody } from "@/lib/manage/schemas";

export type BroadcastRecipient = { id: string; email: string; first_name: string };

/** The per-org daily broadcast cap (env-tunable; §5.12 default 10). */
export function dailyCap(): number {
  const raw = Number(process.env.ORG_EMAIL_DAILY_CAP);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 10;
}

/**
 * Resolve a broadcast's audience to org member profiles (§2.7). Strictly within
 * the manager's org; `selected` intersects the requested ids with org members.
 * Pending scope targets pending members; subject scope targets members approved
 * for that subject.
 */
export async function resolveBroadcastRecipients(
  supabase: SupabaseClient<Database>,
  orgId: string,
  body: BroadcastBody,
): Promise<BroadcastRecipient[]> {
  const base = supabase
    .from("profiles")
    .select("id, email, first_name")
    .eq("org_id", orgId)
    .eq("kind", "member");

  if (body.scope === "all_active") {
    const { data } = await base.eq("status", "active");
    return (data ?? []) as BroadcastRecipient[];
  }

  if (body.scope === "pending") {
    const { data } = await base.eq("status", "pending");
    return (data ?? []) as BroadcastRecipient[];
  }

  if (body.scope === "selected") {
    const ids = body.member_ids ?? [];
    if (!ids.length) return [];
    const { data } = await base.in("id", ids);
    return (data ?? []) as BroadcastRecipient[];
  }

  // scope === "subject": members with an APPROVED approval for the subject.
  const { data: approvals } = await supabase
    .from("subject_approvals")
    .select("profile_id")
    .eq("org_id", orgId)
    .eq("org_subject_id", body.subject_id!)
    .eq("status", "approved");
  const approvedIds = [...new Set((approvals ?? []).map((a) => a.profile_id))];
  if (!approvedIds.length) return [];
  const { data } = await base.eq("status", "active").in("id", approvedIds);
  return (data ?? []) as BroadcastRecipient[];
}

/**
 * Count how many distinct broadcast BATCHES this org has sent since UTC midnight
 * (the daily-cap denominator). Counts batches, not recipients.
 */
export async function broadcastsSentToday(
  supabase: SupabaseClient<Database>,
  orgId: string,
): Promise<number> {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const { data } = await supabase
    .from("email_log")
    .select("batch_id")
    .eq("org_id", orgId)
    .eq("kind", "manager_broadcast")
    .gte("created_at", since.toISOString());
  const batches = new Set<string>();
  for (const r of data ?? []) if (r.batch_id) batches.add(r.batch_id);
  return batches.size;
}
