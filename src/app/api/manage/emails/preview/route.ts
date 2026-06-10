import { requireActiveManager } from "@/lib/auth";
import { json, badRequest } from "@/lib/http";
import { resolveBroadcastRecipients } from "@/lib/manage/emails";
import type { BroadcastBody } from "@/lib/manage/schemas";

export const dynamic = "force-dynamic";

const SCOPES = ["all_active", "pending", "subject", "selected"] as const;
type Scope = (typeof SCOPES)[number];

/**
 * GET /api/manage/emails/preview ?scope&subject_id&member_id* — the live
 * recipient-count preview for the compose audience (§5.12). Recipients are
 * resolved server-side STRICTLY within the manager's org (the same resolver the
 * POST uses), then counted. org_id is server-derived; nothing crosses orgs.
 */
export async function GET(req: Request) {
  const auth = await requireActiveManager(req);
  if (!auth.ok) return auth.response;
  const { supabase, orgId } = auth;
  const url = new URL(req.url);

  const scopeParam = url.searchParams.get("scope");
  if (!scopeParam || !SCOPES.includes(scopeParam as Scope)) {
    return badRequest("validation_error", "Unknown audience scope");
  }
  const scope = scopeParam as Scope;
  const subjectId = url.searchParams.get("subject_id") || undefined;
  const memberIds = url.searchParams.getAll("member_id");

  // Guard the scope-specific requirements (matches the POST schema's refinements).
  if (scope === "subject" && !subjectId) return json({ count: 0 });
  if (scope === "selected" && memberIds.length === 0) return json({ count: 0 });

  // Shape a body the shared resolver understands (subject/body are unused here).
  const body = {
    scope,
    subject: "preview",
    body: "preview",
    subject_id: subjectId,
    member_ids: memberIds,
  } as BroadcastBody;

  const recipients = await resolveBroadcastRecipients(supabase, orgId, body);
  const count = new Set(recipients.map((r) => r.id)).size;
  return json({ count });
}
