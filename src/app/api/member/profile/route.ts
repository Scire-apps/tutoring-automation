import { requireUser } from "@/lib/auth";
import { json, forbidden, serverError, badRequest } from "@/lib/http";
import { parseBody } from "@/lib/validation";
import { profileSchema } from "@/lib/member/schemas";
import type { MeProfile } from "@/types/api";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/member/profile — edit own profile (§4.9 / §7.2). Uses `requireUser`
 * (NOT requireActiveMember): a member may edit their profile at ANY status — this
 * plus `GET /api/auth/me` are the only calls allowed while non-active. Editable
 * fields: first/last name, grade (9–12 or null), pronouns; the profiles_guard
 * trigger blocks everything else (kind/org/status are immutable for self). Non-
 * members → 403 `forbidden`. Returns the updated `MeProfile`.
 */
export async function PATCH(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const { supabase, user, profile } = auth;

  if (profile.kind !== "member") {
    return forbidden("forbidden", "Only members can edit this profile");
  }

  const parsed = await parseBody(req, profileSchema);
  if (!parsed.ok) return parsed.response;

  // Build a patch with only the provided keys (undefined keys are not sent).
  const patch: Record<string, unknown> = {};
  if (parsed.data.first_name !== undefined) patch.first_name = parsed.data.first_name;
  if (parsed.data.last_name !== undefined) patch.last_name = parsed.data.last_name;
  if (parsed.data.grade !== undefined) patch.grade = parsed.data.grade;
  if (parsed.data.pronouns !== undefined) patch.pronouns = parsed.data.pronouns;

  if (Object.keys(patch).length === 0) {
    return badRequest("validation_error", "No fields to update");
  }

  const { data: updated, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", user.id)
    .select("id, kind, status, first_name, last_name, grade, pronouns, status_note, created_at, org_id")
    .maybeSingle();

  if (error) return serverError("server_error", error.message);
  if (!updated) return serverError("server_error", "Profile update failed");

  // Resolve the org for the MeProfile shape (members always have an org).
  let org: MeProfile["org"] = null;
  if (updated.org_id) {
    const { data: orgRow } = await supabase
      .from("organizations")
      .select("id, name")
      .eq("id", updated.org_id)
      .maybeSingle();
    if (orgRow) org = { id: orgRow.id, name: orgRow.name };
  }

  const body: MeProfile = {
    id: updated.id,
    kind: updated.kind,
    status: updated.status,
    org,
    first_name: updated.first_name,
    last_name: updated.last_name,
    grade: updated.grade,
    pronouns: updated.pronouns,
    status_note: updated.status_note,
    created_at: updated.created_at,
  };

  return json(body);
}
