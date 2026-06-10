/**
 * Shared hours-totals aggregation for `/api/manage/hours/*` (§5.10). There is no
 * cached per-member counter (the schema dropped it), so the org totals are a SUM
 * over the ledger computed in-app — trivial at school scale. Reused by the totals
 * tab and the CSV export so they never disagree. RLS scopes the reads to the org.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type MemberHoursTotal = {
  profile_id: string;
  first_name: string;
  last_name: string;
  email: string;
  total_hours: number;
};

/**
 * Per-member hours totals for the org, sorted by total descending (ties by name).
 * Optionally filtered by a name/email substring `q`. Includes every active member
 * (a zero-hours member still appears), so the report is the full roster.
 */
export async function computeMemberTotals(
  supabase: SupabaseClient<Database>,
  orgId: string,
  q?: string | null,
): Promise<MemberHoursTotal[]> {
  const [membersRes, ledgerRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, first_name, last_name, email")
      .eq("org_id", orgId)
      .eq("kind", "member")
      .eq("status", "active"),
    supabase.from("volunteer_hours_ledger").select("profile_id, hours").eq("org_id", orgId),
  ]);

  if (membersRes.error) throw new Error(membersRes.error.message);
  if (ledgerRes.error) throw new Error(ledgerRes.error.message);

  const sumByMember = new Map<string, number>();
  for (const l of ledgerRes.data ?? []) {
    sumByMember.set(l.profile_id, (sumByMember.get(l.profile_id) ?? 0) + Number(l.hours ?? 0));
  }

  const needle = (q ?? "").trim().toLowerCase();
  const rows = (membersRes.data ?? [])
    .filter((m) => {
      if (!needle) return true;
      const hay = `${m.first_name} ${m.last_name} ${m.email}`.toLowerCase();
      return hay.includes(needle);
    })
    .map((m) => ({
      profile_id: m.id,
      first_name: m.first_name,
      last_name: m.last_name,
      email: m.email,
      total_hours: Math.round((sumByMember.get(m.id) ?? 0) * 100) / 100,
    }));

  rows.sort(
    (a, b) =>
      b.total_hours - a.total_hours ||
      `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`),
  );
  return rows;
}
