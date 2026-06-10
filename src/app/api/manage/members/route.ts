import { requireActiveManager } from "@/lib/auth";
import { listResponse, parseListParams, serverError } from "@/lib/http";
import { toManageMemberDTO, type ManageMemberDTO } from "@/lib/manage/dtos";
import type { Database } from "@/types/database";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type AccountStatus = Database["public"]["Enums"]["account_status"];

export const dynamic = "force-dynamic";

const STATUS_VALUES: AccountStatus[] = ["pending", "active", "suspended", "rejected"];

/**
 * GET /api/manage/members ?status&q&limit&offset — the member directory (§5.5).
 * Paginated; filters by `status` (defaults to `active`) and a free-text `q` over
 * name/email. Each row carries approved-subjects count and hours total (SUM over
 * the ledger — there is no cached counter). org_id is server-derived; RLS scopes
 * the profiles read to the manager's org (the `managed_org` branch).
 */
export async function GET(req: Request) {
  const auth = await requireActiveManager(req);
  if (!auth.ok) return auth.response;
  const { supabase, orgId } = auth;
  const url = new URL(req.url);
  const { limit, offset } = parseListParams(url);

  const statusParam = url.searchParams.get("status");
  const status = STATUS_VALUES.includes(statusParam as AccountStatus)
    ? (statusParam as AccountStatus)
    : "active";
  const q = (url.searchParams.get("q") || "").trim();

  let query = supabase
    .from("profiles")
    .select("*", { count: "exact" })
    .eq("org_id", orgId)
    .eq("kind", "member")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit - 1);

  if (q) {
    const safe = q.replace(/[%,()]/g, " ");
    query = query.or(`first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,email.ilike.%${safe}%`);
  }

  const { data, error, count } = await query;
  if (error) return serverError("server_error", "Failed to load members");

  const rows = (data as ProfileRow[]) ?? [];
  const ids = rows.map((r) => r.id);

  // Aggregate approved-subjects + hours for just this page (small, fixed N).
  const [approvalsRes, ledgerRes] = await Promise.all([
    ids.length
      ? supabase
          .from("subject_approvals")
          .select("profile_id")
          .eq("org_id", orgId)
          .eq("status", "approved")
          .in("profile_id", ids)
      : Promise.resolve({ data: [], error: null }),
    ids.length
      ? supabase
          .from("volunteer_hours_ledger")
          .select("profile_id, hours")
          .eq("org_id", orgId)
          .in("profile_id", ids)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (approvalsRes.error || ledgerRes.error) {
    return serverError("server_error", "Failed to load member aggregates");
  }

  const approvedByMember = new Map<string, number>();
  for (const a of approvalsRes.data ?? []) {
    approvedByMember.set(a.profile_id, (approvedByMember.get(a.profile_id) ?? 0) + 1);
  }
  const hoursByMember = new Map<string, number>();
  for (const l of ledgerRes.data ?? []) {
    hoursByMember.set(l.profile_id, (hoursByMember.get(l.profile_id) ?? 0) + Number(l.hours ?? 0));
  }

  const items: ManageMemberDTO[] = rows.map((p) =>
    toManageMemberDTO(p, approvedByMember.get(p.id) ?? 0, hoursByMember.get(p.id) ?? 0),
  );

  return listResponse(items, count ?? 0, { limit, offset });
}
