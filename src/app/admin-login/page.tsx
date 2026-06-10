import type { Metadata } from "next";

import { AdminLoginForm } from "./admin-login-form";

/**
 * `/admin-login` (§6.1) — the secret, never-linked admin sign-in. Generic title
 * ("Scire", NOT "Admin …") and `robots: { index: false, follow: false }` so the
 * page is non-indexable; it is also omitted from robots.txt + sitemap and carries
 * `X-Robots-Tag: noindex` / `Referrer-Policy: no-referrer` via next.config.ts
 * headers() (devC's config slice). The proxy NEVER redirects here — the page
 * self-routes on mount via mfa.getAuthenticatorAssuranceLevel().
 */
export const metadata: Metadata = {
  title: "Scire",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return <AdminLoginForm />;
}
