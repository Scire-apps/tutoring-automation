import { requireActiveManager } from "@/lib/auth";
import { listResponse, parseListParams, serverError } from "@/lib/http";
import type { Database } from "@/types/database";

type HelpRow = Database["public"]["Tables"]["help_requests"]["Row"];
type HelpStatus = Database["public"]["Enums"]["help_status"];

export const dynamic = "force-dynamic";

type HelpDTO = {
  id: string;
  member: { id: string; first_name: string; last_name: string } | null;
  urgency: Database["public"]["Enums"]["urgency_level"];
  description: string;
  status: HelpStatus;
  resolved_by_name: string | null;
  resolved_at: string | null;
  created_at: string;
};

const HELP_SELECT = `
  *,
  member:profiles!help_requests_profile_id_fkey ( id, first_name, last_name ),
  resolver:profiles!help_requests_resolved_by_fkey ( first_name, last_name )
` as const;

type HelpWithMember = HelpRow & {
  member: { id: string; first_name: string; last_name: string } | null;
  resolver: { first_name: string; last_name: string } | null;
};

/**
 * GET /api/manage/help-requests ?status&limit&offset — the org help queue (§5.13).
 * Defaults to `open` (the active queue); `?status=resolved` is the history tab.
 * Newest first. org_id is server-derived; RLS (`managed_org`) scopes the read.
 */
export async function GET(req: Request) {
  const auth = await requireActiveManager(req);
  if (!auth.ok) return auth.response;
  const { supabase, orgId } = auth;
  const url = new URL(req.url);
  const { limit, offset } = parseListParams(url);

  const statusParam = url.searchParams.get("status");
  const status: HelpStatus = statusParam === "resolved" ? "resolved" : "open";

  const { data, error, count } = await supabase
    .from("help_requests")
    .select(HELP_SELECT, { count: "exact" })
    .eq("org_id", orgId)
    .eq("status", status)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return serverError("server_error", "Failed to load help requests");

  const items: HelpDTO[] = ((data as unknown as HelpWithMember[]) ?? []).map((r) => ({
    id: r.id,
    member: r.member,
    urgency: r.urgency,
    description: r.description,
    status: r.status,
    resolved_by_name: r.resolver ? `${r.resolver.first_name} ${r.resolver.last_name}`.trim() || null : null,
    resolved_at: r.resolved_at,
    created_at: r.created_at,
  }));

  return listResponse(items, count ?? 0, { limit, offset });
}
