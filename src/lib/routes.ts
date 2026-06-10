/**
 * Routing hints carried by the JWT custom claims (§3.2) — `user_kind` /
 * `user_status`. These are the ONLY claims the router cares about and are
 * routing hints only (never trusted for authz). Loose strings + nullable so the
 * proxy/confirm can pass `getClaims()` output straight through, and the auth
 * pages can pass `{ user_kind: profile.kind, user_status: profile.status }`.
 */
export type RouteHints = {
  user_kind?: string | null;
  user_status?: string | null;
};

/**
 * Canonical post-auth landing path for a set of routing hints — the single
 * source of truth shared by the proxy, the auth pages, and `/auth/confirm`
 * (§3.4, §8).
 *
 *   admin            → /admin/dashboard
 *   manager active   → /manager/dashboard
 *   manager (other)  → /manager/pending     (locked-modal gate page)
 *   member (any)     → /member/dashboard     (status-gated in the page itself)
 *
 * Members always land on their dashboard regardless of status — there is no
 * separate /member/pending route; the dashboard renders the gate card. An
 * absent/unknown kind falls through to the member dashboard (the broadest tier,
 * which self-gates), so a missing claim never dead-ends a signed-in user.
 */
export function homeFor(hints: RouteHints | null | undefined): string {
  const kind = hints?.user_kind ?? null;
  const status = hints?.user_status ?? null;
  if (kind === "admin") return "/admin/dashboard";
  if (kind === "manager") {
    return status === "active" ? "/manager/dashboard" : "/manager/pending";
  }
  return "/member/dashboard";
}
