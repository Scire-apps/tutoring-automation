import { requireUser } from "@/lib/auth";
import { json, unauthorized } from "@/lib/http";
import type { MeResponse } from "@/types/api";

/**
 * GET /api/auth/me — THE identity endpoint (§7.2). requireUser-only: serves a
 * 200 for EVERY status (pending/active/suspended/rejected) because it is the
 * admission-poll target and the source the client reads to render gate cards.
 *
 * - One PK SELECT on profiles + org join.
 * - Invalid/absent token → 401 `unauthenticated` (fixes the role-null-with-200 bug).
 * - Token valid but profile missing → 500 `profile_missing` (passed through from
 *   requireUser — a provisioning defect, not an auth denial).
 */
export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) {
    // Normalize the 401 family to the documented `unauthenticated` code; let the
    // 500 profile_missing response pass through unchanged.
    if (auth.response.status === 401) {
      return unauthorized("unauthenticated", "Authentication required");
    }
    return auth.response;
  }

  const { user, profile, supabase } = auth;

  let org: { id: string; name: string } | null = null;
  if (profile.org_id) {
    const { data: orgRow } = await supabase
      .from("organizations")
      .select("id, name")
      .eq("id", profile.org_id)
      .single();
    if (orgRow) org = { id: orgRow.id, name: orgRow.name };
  }

  const body: MeResponse = {
    user: { id: user.id, email: user.email },
    profile: {
      id: profile.id,
      kind: profile.kind,
      status: profile.status,
      org,
      first_name: profile.first_name,
      last_name: profile.last_name,
      grade: profile.grade,
      pronouns: profile.pronouns,
      status_note: profile.status_note,
      created_at: profile.created_at,
    },
  };

  return json(body);
}
