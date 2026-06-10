import { requireActiveMember } from "@/lib/auth";
import { json, serverError } from "@/lib/http";
import { parseBody } from "@/lib/validation";
import { helpSchema } from "@/lib/member/schemas";

export const dynamic = "force-dynamic";

/**
 * POST /api/member/help — ask the org's managers for help (§4.9 / §7.2). ACTIVE
 * members only (the RLS INSERT policy requires `active_member_org`). Lands in the
 * manager help queue (§5.13) — no transactional email. Returns the created row.
 */
export async function POST(req: Request) {
  const auth = await requireActiveMember(req);
  if (!auth.ok) return auth.response;
  const { supabase, user, orgId } = auth;

  const parsed = await parseBody(req, helpSchema);
  if (!parsed.ok) return parsed.response;
  const { urgency, description } = parsed.data;

  const { data, error } = await supabase
    .from("help_requests")
    .insert({
      org_id: orgId,
      profile_id: user.id,
      urgency: urgency ?? "normal",
      description,
      status: "open",
    })
    .select("id, urgency, description, status, created_at")
    .maybeSingle();

  if (error) return serverError("server_error", error.message);
  if (!data) return serverError("server_error", "Failed to submit your request");

  return json(data, 201);
}
