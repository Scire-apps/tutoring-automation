import { requireAdmin } from "@/lib/auth";
import { listResponse, parseListParams, serverError } from "@/lib/http";
import { ADMIN_APPROVAL_SELECT, toAdminApprovalDTO, type ApprovalWithJoins } from "@/lib/admin/dtos";
import type { Database } from "@/types/database";

type ApprovalStatus = Database["public"]["Enums"]["approval_status"];

export const dynamic = "force-dynamic";

const STATUSES: ApprovalStatus[] = ["pending", "approved", "rejected", "withdrawn", "revoked"];

/**
 * GET /api/admin/subject-approvals ?org_id&status&limit&offset — the cross-org
 * subject-approval queue (§6.4), an admin override of the manager review. Filters
 * by org and status (default pending); newest-first, paginated. Each row carries
 * org, member, subject, and decision provenance. requireAdmin gates.
 */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { supabase } = auth;
  const url = new URL(req.url);
  const { limit, offset } = parseListParams(url);

  const orgId = url.searchParams.get("org_id");
  const statusParam = url.searchParams.get("status");
  const status = STATUSES.includes(statusParam as ApprovalStatus) ? (statusParam as ApprovalStatus) : "pending";

  let query = supabase
    .from("subject_approvals")
    .select(ADMIN_APPROVAL_SELECT, { count: "exact" })
    .eq("status", status)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (orgId) query = query.eq("org_id", orgId);

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) return serverError("server_error", "Failed to load subject approvals");

  const items = ((data as unknown as ApprovalWithJoins[]) ?? []).map(toAdminApprovalDTO);
  return listResponse(items, count ?? 0, { limit, offset });
}
