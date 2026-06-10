import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { createUserClient, createRSCClient } from "@/lib/supabase/server";
import { getBearerToken, unauthorized, forbidden, serverError, type ApiErrorCode } from "@/lib/http";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/** Authenticated user identity (subset of the GoTrue user). */
export type AuthUser = { id: string; email: string | null };

/**
 * Success shape shared by every guard. `supabase` is RLS-bound to the caller's
 * JWT; `profile` is a fresh per-request read of `profiles` (claims are NEVER
 * trusted for authorization — §3.2). Active-tier guards also carry `orgId`.
 */
export type UserAuth = {
  ok: true;
  user: AuthUser;
  profile: Profile;
  token: string;
  supabase: SupabaseClient<Database>;
};

export type MemberAuth = UserAuth & { orgId: string };
export type ManagerAuth = UserAuth & { orgId: string };
export type AdminAuth = UserAuth;

export type AuthFail = { ok: false; response: ReturnType<typeof forbidden> };

/** Decode a JWT payload without verifying the signature (GoTrue already verified it). */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(b64, "base64").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Authenticate a request via its `Authorization: Bearer <jwt>` header and load
 * the caller's profile (one PK SELECT). The bedrock guard for every `/api/**`
 * route — it self-guards; the proxy never protects API routes (§7.1).
 *
 *   const auth = await requireUser(req);
 *   if (!auth.ok) return auth.response;
 *   // auth.user / auth.profile / auth.token / auth.supabase
 *
 * - No token / bad token → 401 (`unauthorized` / `invalid_token`).
 * - Token valid but no profile row → 500 `profile_missing` (the provisioning
 *   trigger failed; this is a server defect, NOT a 403).
 */
export async function requireUser(req: Request): Promise<UserAuth | AuthFail> {
  const token = getBearerToken(req);
  if (!token) {
    return { ok: false, response: unauthorized("unauthorized", "No authorization header provided") };
  }
  const supabase = createUserClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.id) {
    return { ok: false, response: unauthorized("invalid_token", "Invalid or expired token") };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .single();

  if (profileError || !profile) {
    // Token authenticates but no profile exists — the AFTER INSERT trigger that
    // provisions profiles did not fire. Alertable server defect, not a denial.
    return {
      ok: false,
      response: serverError("profile_missing", "Account profile not found"),
    };
  }

  return {
    ok: true,
    user: { id: data.user.id, email: data.user.email ?? null },
    profile: profile as Profile,
    token,
    supabase,
  };
}

/** Build the canonical 403 for a non-active member/manager, carrying the status_note. */
function inactive(code: Extract<ApiErrorCode, "member_not_active" | "manager_not_active">, profile: Profile): AuthFail {
  return {
    ok: false,
    response: forbidden(code, undefined, { status: profile.status, status_note: profile.status_note }),
  };
}

/**
 * Require an ACTIVE member. Non-members → 403 `forbidden`; non-active members →
 * 403 `member_not_active` (the client reads the precise status from
 * `GET /api/auth/me`). Adds `orgId` (member queries server-scope to it).
 */
export async function requireActiveMember(req: Request): Promise<MemberAuth | AuthFail> {
  const auth = await requireUser(req);
  if (!auth.ok) return auth;
  if (auth.profile.kind !== "member") {
    return { ok: false, response: forbidden("forbidden") };
  }
  if (auth.profile.status !== "active" || !auth.profile.org_id) {
    return inactive("member_not_active", auth.profile);
  }
  return { ...auth, orgId: auth.profile.org_id };
}

/**
 * Require an ACTIVE manager. Non-managers → 403 `forbidden`; pending/suspended/
 * rejected managers → 403 `manager_not_active`. Adds `orgId` (org_id is ALWAYS
 * server-derived for `/api/manage/*`, never client input — §5.0).
 */
export async function requireActiveManager(req: Request): Promise<ManagerAuth | AuthFail> {
  const auth = await requireUser(req);
  if (!auth.ok) return auth;
  if (auth.profile.kind !== "manager") {
    return { ok: false, response: forbidden("forbidden") };
  }
  if (auth.profile.status !== "active" || !auth.profile.org_id) {
    return inactive("manager_not_active", auth.profile);
  }
  return { ...auth, orgId: auth.profile.org_id };
}

/**
 * Require an admin. Returns a plain `forbidden` for every non-admin case (no
 * admin-existence hints — §2.8). Enforces the §6.2 AAL rule: an active admin who
 * has a VERIFIED TOTP factor must be at aal2; an aal1-with-factor admin is
 * bounced so the conditional-TOTP challenge cannot be skipped.
 */
export async function requireAdmin(req: Request): Promise<AdminAuth | AuthFail> {
  const auth = await requireUser(req);
  if (!auth.ok) return auth;
  if (auth.profile.kind !== "admin" || auth.profile.status !== "active") {
    return { ok: false, response: forbidden("forbidden") };
  }

  // §6.2 AAL rule: (no verified TOTP factor) OR (aal2). Decode aal from the JWT;
  // detect a verified factor via the user-bound MFA listing.
  const claims = decodeJwtPayload(auth.token);
  const aal = typeof claims?.aal === "string" ? claims.aal : null;
  if (aal !== "aal2") {
    const { data: factors } = await auth.supabase.auth.mfa.listFactors();
    const hasVerifiedTotp = (factors?.totp ?? []).some((f) => f.status === "verified");
    if (hasVerifiedTotp) {
      return { ok: false, response: forbidden("forbidden") };
    }
  }

  return auth;
}

/**
 * Server-side profile read for zone layouts (no-flash initial render). Uses the
 * cookie-backed @supabase/ssr client rather than a Bearer token; returns null
 * when unauthenticated or unprovisioned. Live admission flips still rely on the
 * client polling `GET /api/auth/me` (§7.4).
 */
export async function getServerProfile(): Promise<{ user: AuthUser; profile: Profile } | null> {
  const supabase = await createRSCClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.id) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .single();

  if (profileError || !profile) return null;
  return {
    user: { id: data.user.id, email: data.user.email ?? null },
    profile: profile as Profile,
  };
}
