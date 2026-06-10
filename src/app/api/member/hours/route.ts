import { requireActiveMember } from "@/lib/auth";
import { json, parseListParams, serverError } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * GET /api/member/hours — the caller's volunteer-hours ledger (§7.2). Returns
 * `{ total_hours, items, total, limit, offset }`: `total_hours` is the SUM over
 * the ENTIRE ledger (no cached counter), while `items` is the paginated, newest-
 * first list of award/adjustment rows. RLS scopes to `profile_id = self`.
 */
export async function GET(req: Request) {
  const auth = await requireActiveMember(req);
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;
  const { limit, offset } = parseListParams(new URL(req.url));

  // Whole-ledger SUM for the headline total.
  const sumP = supabase
    .from("volunteer_hours_ledger")
    .select("hours")
    .eq("profile_id", user.id);

  // Paginated rows with the session's subject for the "session link" column.
  const itemsP = supabase
    .from("volunteer_hours_ledger")
    .select(
      "id, kind, hours, note, session_id, created_at, session:sessions ( id, org_subject_id, subject:org_subjects!sessions_subject_fk ( name ) )",
      { count: "exact" },
    )
    .eq("profile_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const [sum, items] = await Promise.all([sumP, itemsP]);
  if (sum.error || items.error) return serverError("server_error", "Failed to load hours");

  const totalHours = (sum.data ?? []).reduce((acc, r) => acc + Number(r.hours ?? 0), 0);

  type LedgerJoin = {
    id: number;
    kind: string;
    hours: number;
    note: string | null;
    session_id: string | null;
    created_at: string;
    session: { id: string; subject: { name: string } | null } | null;
  };

  const rows = (items.data as unknown as LedgerJoin[]) ?? [];
  return json({
    total_hours: Math.round(totalHours * 100) / 100,
    items: rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      hours: Number(r.hours),
      note: r.note,
      session_id: r.session_id,
      subject_name: r.session?.subject?.name ?? null,
      created_at: r.created_at,
    })),
    total: items.count ?? 0,
    limit,
    offset,
  });
}
