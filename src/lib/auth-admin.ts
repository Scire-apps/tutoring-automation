import { createServiceClient } from "@/lib/supabase/server";

/**
 * Thin, server-only wrapper over Supabase `auth.admin.*` (§2.6 d). This is the
 * SOLE sanctioned path to the GoTrue admin API; raw `createServiceClient()` must
 * never appear inside route handlers for these operations. Callers are always
 * `requireAdmin`-gated routes (invite a manager, delete a junk pending/rejected
 * account, reset a factor).
 *
 * Never import from client code; the secret key must never reach the browser.
 */

type InviteManagerInput = {
  email: string;
  first_name: string;
  last_name: string;
  org_id: string;
  /** Absolute URL the invite acceptance link should redirect to (e.g. /auth/confirm). */
  redirectTo?: string;
};

/**
 * Invite a manager by email. Sets `kind:'manager'` + names + org_id in
 * user_metadata so `handle_new_user` provisions a PENDING manager profile; the
 * admin route then service-flips it to active (§3.3 invite interop).
 */
export async function inviteManager(input: InviteManagerInput) {
  const supabase = createServiceClient();
  return supabase.auth.admin.inviteUserByEmail(input.email, {
    data: {
      kind: "manager",
      first_name: input.first_name,
      last_name: input.last_name,
      org_id: input.org_id,
    },
    redirectTo: input.redirectTo,
  });
}

/**
 * Hard-delete an auth user (cascades the profile row). Load-bearing: frees the
 * email for re-invite (§6.4). Admin routes gate this to pending|rejected only.
 */
export async function deleteAuthUser(userId: string) {
  const supabase = createServiceClient();
  return supabase.auth.admin.deleteUser(userId);
}

/**
 * Fetch a GoTrue user by id (service-role). Used by admin flows that need the
 * auth-side record (e.g. confirm an invite landed).
 */
export async function getAuthUser(userId: string) {
  const supabase = createServiceClient();
  return supabase.auth.admin.getUserById(userId);
}
