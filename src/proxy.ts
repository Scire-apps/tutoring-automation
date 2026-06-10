import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { homeFor } from "@/lib/routes";

/**
 * Edge proxy (Next 16 successor to `middleware.ts`). UX-only routing — NOT a
 * security boundary. Identity comes exclusively from the JWT custom claims via
 * `getClaims()` (asymmetric JWT → local JWKS verification, zero network/DB per
 * request). Every zone layout and every `/api/**` route re-verifies fresh
 * against `profiles`; claims here are routing hints only (§3.2, §3.4).
 *
 * Redirect matrix (§3.4, canonical):
 *  - homeFor: admin → /admin/dashboard; manager active → /manager/dashboard else
 *    /manager/pending; member → /member/dashboard (any status).
 *  - unauthed /member/** or /manager/** → /auth/login?next=…
 *  - /admin/** with no session OR non-admin claims → REWRITE to 404 (never a
 *    redirect — indistinguishable from a nonexistent route; no /admin-login leak).
 *  - non-active manager: ONLY /manager/pending passes (the gate page renders the
 *    locked modal / status cards).
 *  - /admin-login: the proxy NEVER redirects here (an authed-admin redirect would
 *    infinite-loop aal1-with-factor admins; the page self-routes on mount).
 *  - authed users leave /auth/** for their home EXCEPT reset-password /
 *    accept-invite / confirm.
 *  - authed `/` → home.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Identity via claims ONLY — no getUser()/getSession() round-trips, no /api or DB.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims ?? null;
  const kind = (claims?.user_kind as string | undefined) ?? null;
  const status = (claims?.user_status as string | undefined) ?? null;
  const isAuthed = !!claims;
  // Normalized routing hints (the only claims the router cares about).
  const routeHints = isAuthed ? { user_kind: kind, user_status: status } : null;

  const { pathname } = request.nextUrl;
  // Zone match = the bare root or any descendant (matcher uses :path* = zero-or-more).
  const inZone = (zone: string) => pathname === zone || pathname.startsWith(`${zone}/`);

  const notFound = () => NextResponse.rewrite(new URL("/404", request.url), { status: 404 });
  const redirect = (to: string) => NextResponse.redirect(new URL(to, request.url));
  const loginWithNext = () =>
    redirect(`/auth/login?next=${encodeURIComponent(pathname + request.nextUrl.search)}`);

  // ── /admin-login — the proxy NEVER redirects here (self-routing page). ──
  // Checked before /admin so the shared "admin" prefix never captures it.
  if (pathname === "/admin-login") {
    return response;
  }

  // ── /admin/** — secret surface. Unauthorized → 404 rewrite (never redirect). ──
  if (inZone("/admin")) {
    if (!isAuthed || kind !== "admin") return notFound();
    return response;
  }

  // ── /auth/** — authed users leave for home, with carve-outs. ──
  if (inZone("/auth")) {
    if (isAuthed) {
      const passable =
        pathname.startsWith("/auth/reset-password") ||
        pathname.startsWith("/auth/accept-invite") ||
        pathname.startsWith("/auth/confirm");
      if (!passable) return redirect(homeFor(routeHints));
    }
    return response;
  }

  // ── /member/** ──
  if (inZone("/member")) {
    if (!isAuthed) return loginWithNext();
    if (kind !== "member") return redirect(homeFor(routeHints));
    // members reach the dashboard at ANY status (gate states render there).
    return response;
  }

  // ── /manager/** ──
  if (inZone("/manager")) {
    if (!isAuthed) return loginWithNext();
    if (kind !== "manager") return redirect(homeFor(routeHints));
    if (status !== "active") {
      // Non-active managers may ONLY see /manager/pending (the gate page).
      if (pathname !== "/manager/pending") return redirect("/manager/pending");
    }
    return response;
  }

  // ── `/` — authed users go to their home. ──
  if (pathname === "/") {
    if (isAuthed) return redirect(homeFor(routeHints));
    return response;
  }

  return response;
}

export const config = {
  matcher: ["/", "/member/:path*", "/manager/:path*", "/admin/:path*", "/admin-login", "/auth/:path*"],
};
