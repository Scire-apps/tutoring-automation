import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { homeFor } from "@/lib/routes";

/**
 * GET /auth/confirm — the single email-link landing handler (replaces the deleted
 * /auth/callback). Handles BOTH email-link shapes (§3.3):
 *   - `token_hash` + `type` → verifyOtp (the cross-device canonical PKCE-less flow)
 *   - `code`                → exchangeCodeForSession (PKCE fallback)
 * Sets the session cookie via @supabase/ssr, then routes:
 *   recovery → /auth/reset-password · invite → /auth/accept-invite ·
 *   otherwise a sanitized relative ?next, or homeFor(claims).
 * Any failure → /auth/login?error=verification_failed.
 */

/** Only allow same-origin relative paths; reject protocol-relative and escapes. */
function sanitizeNext(next: string | null): string | null {
  if (!next) return null;
  if (!next.startsWith("/")) return null;
  // Block //evil.com and /\evil.com (protocol-relative / backslash tricks).
  if (next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const params = url.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const code = params.get("code");
  const next = sanitizeNext(params.get("next"));

  const failure = NextResponse.redirect(
    new URL("/auth/login?error=verification_failed", request.url)
  );

  // Cookies set during verification land on this response's jar (re-targeted to the
  // resolved destination at the end). The binding never changes; only its cookies do.
  const response = failure;
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 1) Verify the link, establishing the cookie session.
  let verified = false;
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    verified = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    verified = !error;
  }

  if (!verified) {
    return failure;
  }

  // 2) Decide the destination.
  let destination: string;
  if (type === "recovery") {
    destination = "/auth/reset-password";
  } else if (type === "invite") {
    destination = "/auth/accept-invite";
  } else if (next) {
    destination = next;
  } else {
    const { data } = await supabase.auth.getClaims();
    const claims = data?.claims ?? null;
    destination = homeFor(
      claims
        ? {
            user_kind: (claims.user_kind as string | undefined) ?? null,
            user_status: (claims.user_status as string | undefined) ?? null,
          }
        : null
    );
  }

  // Re-target the (already cookie-wired) response at the resolved destination.
  const success = NextResponse.redirect(new URL(destination, request.url));
  response.cookies.getAll().forEach((c) => success.cookies.set(c));
  return success;
}
