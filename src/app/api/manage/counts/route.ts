import { requireActiveManager } from "@/lib/auth";
import { json, serverError } from "@/lib/http";
import { computeCounts } from "@/lib/manage/counts";

export const dynamic = "force-dynamic";

/**
 * GET /api/manage/counts — the five nav badges (§5.3): pending admissions,
 * pending subject-approval requests, the verification queue, pending peer
 * managers, open help. org_id is server-derived from the manager's profile.
 */
export async function GET(req: Request) {
  const auth = await requireActiveManager(req);
  if (!auth.ok) return auth.response;
  try {
    const counts = await computeCounts(auth.supabase, auth.orgId);
    return json(counts);
  } catch {
    return serverError("server_error", "Failed to load counts");
  }
}
