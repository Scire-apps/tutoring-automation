import { after } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { json, conflict, notFound, serverError } from "@/lib/http";
import { parseBody } from "@/lib/validation";
import { inviteManagerSchema } from "@/lib/admin/schemas";
import { inviteManager } from "@/lib/auth-admin";
import { orgNameFor } from "@/lib/admin/recipients";
import { managerActivated, siteUrl } from "@/lib/email";
import { logAudit } from "@/lib/log";

export const dynamic = "force-dynamic";

/** The exact §6.4 copy for an email that already belongs to an account. */
const EMAIL_TAKEN_COPY =
  "This email belongs to a pending/rejected member account — delete it first, then invite";

/**
 * POST /api/admin/accounts/invite {kind:'manager', email, first_name, last_name, org_id}
 * — invite a manager (§6.4). Admin-only in v1, one org per invite. Flow:
 *   1. the target org must exist and be ACTIVE (no invites into an archived org);
 *   2. 409 if the email already has a profile (exact §6.4 copy — delete first);
 *   3. `inviteUserByEmail` sets {kind:'manager', org_id, names} in user_metadata
 *      with redirectTo /auth/confirm?next=/auth/accept-invite, so `handle_new_user`
 *      provisions a PENDING manager profile;
 *   4. the route then flips that profile to active + activated_by using the
 *      ADMIN'S OWN RLS-bound client (§2.6: only `inviteUserByEmail` itself is
 *      service-role) — the profiles_guard admin branch permits the flip and the
 *      profiles_audit trigger records the REAL admin as actor — then emails an
 *      activation notice and writes the `manager.invite` audit row (§6.4).
 */
export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const parsed = await parseBody(req, inviteManagerSchema);
  if (!parsed.ok) return parsed.response;
  const { email, first_name, last_name, org_id } = parsed.data;

  // 1) The org must exist and be active (invites into an archived org are refused).
  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, archived_at")
    .eq("id", org_id)
    .maybeSingle();
  if (!org) return notFound("not_found", "Organization not found");
  if (org.archived_at != null) {
    return conflict("invalid_state", "Cannot invite a manager to an archived organization");
  }

  // 2) The email must be free. profiles.email is UNIQUE (lowercased) — a hit means
  //    an account already claims it; the operator must delete it first.
  const { data: existing } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();
  if (existing) {
    return conflict("wrong_kind", EMAIL_TAKEN_COPY);
  }

  // 3) Invite (service-role). The trigger creates a PENDING manager profile.
  const { data: invited, error: inviteError } = await inviteManager({
    email,
    first_name,
    last_name,
    org_id,
    redirectTo: `${siteUrl()}/auth/confirm?next=/auth/accept-invite`,
  });
  if (inviteError) {
    // GoTrue reports an already-registered email here too (race / no profile row).
    if (/already|registered|exist/i.test(inviteError.message)) {
      return conflict("wrong_kind", EMAIL_TAKEN_COPY);
    }
    return serverError("server_error", inviteError.message);
  }
  const newUserId = invited?.user?.id;
  if (!newUserId) return serverError("server_error", "Invite did not return a user");

  // 4) Promote the trigger-created pending profile → active + activated_by via the
  //    admin's RLS-bound client (§2.6) — guard + policy admin branches permit it,
  //    and the audit trigger attributes the activation to the real admin.
  const { error: promoteError } = await supabase
    .from("profiles")
    .update({ status: "active", activated_at: new Date().toISOString(), activated_by: user.id })
    .eq("id", newUserId)
    .eq("kind", "manager");
  if (promoteError) return serverError("server_error", `Invited but activation failed: ${promoteError.message}`);

  after(() =>
    logAudit({
      action: "manager.invite",
      actor_id: user.id,
      actor_kind: "admin",
      org_id,
      target_table: "profiles",
      target_id: newUserId,
      metadata: { email, inviter: user.id },
    }),
  );

  const orgName = await orgNameFor(supabase, org_id);
  after(() =>
    managerActivated({ email, name: first_name, id: newUserId }, orgName, "activated", null, {
      org_id,
      dashboardUrl: `${siteUrl()}/manager/dashboard`,
    }),
  );

  return json({ id: newUserId, email, kind: "manager" as const, status: "active" as const, org_id }, 201);
}
