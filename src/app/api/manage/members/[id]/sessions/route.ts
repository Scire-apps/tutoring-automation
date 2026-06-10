import { requireActiveManager } from "@/lib/auth";
import { json, notFound, serverError } from "@/lib/http";
import { readOrgProfile } from "@/lib/manage/members";
import { MANAGE_SESSION_SELECT, type SessionWithJoins } from "@/lib/manage/dtos";

export const dynamic = "force-dynamic";

/**
 * GET /api/manage/members/[id]/sessions — a member's sessions as BOTH requester
 * and tutor (§5.5 Sessions tab). Each row carries the member's `role` and the
 * `counterpart` (the other party). Newest first. org_id is server-derived; RLS
 * scopes the read to the org.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActiveManager(req);
  if (!auth.ok) return auth.response;
  const { supabase, orgId } = auth;
  const { id } = await ctx.params;

  const profile = await readOrgProfile(supabase, orgId, id, "member");
  if (!profile) return notFound("not_found", "Member not found");

  const { data, error } = await supabase
    .from("sessions")
    .select(MANAGE_SESSION_SELECT)
    .eq("org_id", orgId)
    .or(`requester_id.eq.${id},tutor_id.eq.${id}`)
    .order("created_at", { ascending: false });

  if (error) return serverError("server_error", "Failed to load sessions");

  const items = ((data as unknown as SessionWithJoins[]) ?? []).map((r) => {
    const isRequester = r.requester_id === id;
    return {
      id: r.id,
      name: r.subject?.name ?? "Unknown subject",
      category: r.subject?.category ?? null,
      grade_level: r.subject?.grade_level ?? null,
      status: r.status,
      priority: r.priority,
      role: (isRequester ? "requester" : "tutor") as "requester" | "tutor",
      counterpart: isRequester ? r.tutor : r.requester,
      scheduled_at: r.scheduled_at,
      created_at: r.created_at,
    };
  });

  return json({ items });
}
