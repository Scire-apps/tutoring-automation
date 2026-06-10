import { notFound, redirect } from "next/navigation";

import type { MeProfile } from "@/types/api";
import { getServerProfile } from "@/lib/auth";
import { createRSCClient } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin-shell";
import { Toaster } from "@/components/ui/sonner";

/**
 * Build the env badge label (§6.3): `VERCEL_ENV` + a short commit SHA, e.g.
 * "preview · a1b2c3d". Returns null in production so the badge is hidden there.
 */
function envLabel(): string | null {
  const env = process.env.VERCEL_ENV ?? (process.env.NODE_ENV === "production" ? "production" : "development");
  if (env === "production") return null;
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  const shortSha = sha ? sha.slice(0, 7) : null;
  return shortSha ? `${env} · ${shortSha}` : env;
}

/**
 * Admin panel layout (§6.2 / §6.3) — the authoritative server guard for every
 * `/admin/**` page. Mirrors `requireAdmin` v2:
 *   - no session / unprovisioned / kind ≠ admin / status ≠ active → notFound()
 *     (the 404-rewrite secrecy posture — never redirect toward /admin-login or
 *     /auth/login, both of which leak the surface's existence).
 *   - admin WITH a verified TOTP factor but only aal1 → redirect to /admin-login
 *     so the conditional-TOTP challenge completes (the flow self-heals even if a
 *     mid-login refresh fired the proxy's authed-admin path early).
 *   - admin at aal2, OR admin with no verified factor → render the shell.
 *
 * The proxy already 404-rewrites unauthorized /admin/** — this is the fresh DB +
 * AAL re-check; every /api/admin/* handler re-verifies again per request.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerProfile();
  if (!session) notFound();

  const { profile } = session;
  if (profile.kind !== "admin" || profile.status !== "active") notFound();

  // §6.2 AAL rule: (no verified TOTP factor) OR (aal2). Read the assurance level
  // from the cookie session; an aal1 admin WITH a verified factor is bounced back
  // to /admin-login to finish the challenge.
  const supabase = await createRSCClient();
  const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const currentLevel = aalData?.currentLevel ?? null;
  if (currentLevel !== "aal2") {
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const hasVerifiedTotp = (factors?.totp ?? []).some((f) => f.status === "verified");
    if (hasVerifiedTotp) redirect("/admin-login");
  }

  const initialProfile: MeProfile = {
    id: profile.id,
    kind: profile.kind,
    status: profile.status,
    org: null, // admins have no org (CHECK: kind='admin' ⇒ org_id IS NULL).
    first_name: profile.first_name,
    last_name: profile.last_name,
    grade: profile.grade,
    pronouns: profile.pronouns,
    status_note: profile.status_note,
    created_at: profile.created_at,
  };

  return (
    <AdminShell initialProfile={initialProfile} envLabel={envLabel()}>
      {children}
      {/* Single Toaster for the whole admin zone. */}
      <Toaster />
    </AdminShell>
  );
}
