import { requireActiveManager } from "@/lib/auth";
import { badRequest, serverError } from "@/lib/http";
import { computeMemberTotals } from "@/lib/manage/hours";
import type { Database } from "@/types/database";

type LedgerRow = Database["public"]["Tables"]["volunteer_hours_ledger"]["Row"];

/** Ledger select for the CSV: embeds member email + both party names. */
const LEDGER_EXPORT_SELECT = `
  id, created_at, kind, hours, session_id, note,
  member:profiles!volunteer_hours_ledger_profile_fk ( first_name, last_name, email ),
  awarder:profiles!volunteer_hours_ledger_awarded_by_fkey ( first_name, last_name )
` as const;

type LedgerExportRow = Pick<LedgerRow, "id" | "created_at" | "kind" | "hours" | "session_id" | "note"> & {
  member: { first_name: string; last_name: string; email: string } | null;
  awarder: { first_name: string; last_name: string } | null;
};

export const dynamic = "force-dynamic";

/** RFC-4180 cell escaping: quote when the value holds a comma, quote, or newline. */
function csvCell(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvRow(cells: Array<string | number | null | undefined>): string {
  return cells.map(csvCell).join(",");
}

function personName(p: { first_name: string; last_name: string } | null): string {
  return p ? `${p.first_name} ${p.last_name}`.trim() : "";
}

/**
 * GET /api/manage/hours/export ?type=totals|ledger — CSV export of volunteer
 * hours (§5.10), the product's core school-reporting value. `totals` = per-member
 * totals; `ledger` = the full append-only ledger. Returns text/csv with a
 * Content-Disposition attachment filename. org_id is server-derived; RLS scopes
 * every read to the org.
 */
export async function GET(req: Request) {
  const auth = await requireActiveManager(req);
  if (!auth.ok) return auth.response;
  const { supabase, orgId } = auth;
  const url = new URL(req.url);
  const type = url.searchParams.get("type");

  if (type !== "totals" && type !== "ledger") {
    return badRequest("validation_error", "type must be 'totals' or 'ledger'");
  }

  const stamp = new Date().toISOString().slice(0, 10);
  let body: string;

  try {
    if (type === "totals") {
      const totals = await computeMemberTotals(supabase, orgId, null);
      const lines = [csvRow(["First name", "Last name", "Email", "Total hours"])];
      for (const t of totals) lines.push(csvRow([t.first_name, t.last_name, t.email, t.total_hours]));
      body = lines.join("\r\n");
    } else {
      const { data, error } = await supabase
        .from("volunteer_hours_ledger")
        .select(LEDGER_EXPORT_SELECT)
        .eq("org_id", orgId)
        .order("id", { ascending: false });
      if (error) return serverError("server_error", "Failed to export the ledger");
      const rows = (data as unknown as LedgerExportRow[]) ?? [];
      const lines = [csvRow(["Date", "Member", "Email", "Kind", "Hours", "Session ID", "Awarded by", "Note"])];
      for (const r of rows) {
        lines.push(
          csvRow([
            r.created_at,
            personName(r.member),
            r.member?.email ?? "",
            r.kind,
            Number(r.hours),
            r.session_id ?? "",
            personName(r.awarder),
            r.note ?? "",
          ]),
        );
      }
      body = lines.join("\r\n");
    }
  } catch {
    return serverError("server_error", "Failed to export hours");
  }

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="scire-hours-${type}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
