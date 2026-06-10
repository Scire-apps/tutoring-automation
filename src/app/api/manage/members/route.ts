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
  // Admissions queue wants oldest-first; the directory defaults newest-first.
  const oldestFirst = url.searchParams.get("order") === "oldest";

  let query = supabase
    .from("profiles")
    .select("*", { count: "exact" })
    .eq("org_id", orgId)
    .eq("kind", "member")
    .eq("status", status)
    .order("created_at", { ascending: oldestFirst })
    .order("id", { ascending: oldestFirst })
    .range(offset, offset + limit - 1);

  if (q) {
    const safe = q.replace(/[%,()]/g, " ");
    query = query.or(`first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,email.ilike.%${safe}%`);
  }

  const { data, error, count } = await query;
  if (error) return serverError("server_error", "Failed to load members");

  const rows = (data as ProfileRow[]) ?? [];
  const ids = rows.map((r) => r.id);

  // Aggregate approved-subjects + hours + open requests + active sessions for
  // just this page (small, fixed N). Open requests = the member's own `open`
  // sessions; active sessions = in-flight rows where they are either party.
  const empty = Promise.resolve({ data: [], error: null });
  const [approvalsRes, ledgerRes, openReqRes, activeSessRes] = await Promise.all([
    ids.length
      ? supabase.from("subject_approvals").select("profile_id").eq("org_id", orgId).eq("status", "approved").in("profile_id", ids)
      : empty,
    ids.length
      ? supabase.from("volunteer_hours_ledger").select("profile_id, hours").eq("org_id", orgId).in("profile_id", ids)
      : empty,
    ids.length
      ? supabase.from("sessions").select("requester_id").eq("org_id", orgId).eq("status", "open").in("requester_id", ids)
      : empty,
    ids.length
      ? supabase
          .from("sessions")
          .select("requester_id, tutor_id")
          .eq("org_id", orgId)
          .in("status", ["claimed", "availability_set", "scheduled"])
      : empty,
  ]);

  if (approvalsRes.error || ledgerRes.error || openReqRes.error || activeSessRes.error) {
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
  const idSet = new Set(ids);
  const openReqByMember = new Map<string, number>();
  for (const s of openReqRes.data ?? []) {
    openReqByMember.set(s.requester_id, (openReqByMember.get(s.requester_id) ?? 0) + 1);
  }
  const activeByMember = new Map<string, number>();
  for (const s of (activeSessRes.data as Array<{ requester_id: string; tutor_id: string | null }>) ?? []) {
    for (const pid of [s.requester_id, s.tutor_id]) {
      if (pid && idSet.has(pid)) activeByMember.set(pid, (activeByMember.get(pid) ?? 0) + 1);
    }
  }

  const items: ManageMemberDTO[] = rows.map((p) =>
    toManageMemberDTO(p, {
      approved_subjects: approvedByMember.get(p.id) ?? 0,
      hours_total: hoursByMember.get(p.id) ?? 0,
      open_requests: openReqByMember.get(p.id) ?? 0,
      active_sessions: activeByMember.get(p.id) ?? 0,
    }),
  );

  return listResponse(items, count ?? 0, { limit, offset });
}
