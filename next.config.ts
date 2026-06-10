import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Types are validated at build time (the codebase is type-clean). ESLint runs too;
  // remaining items are non-blocking `no-explicit-any`/unused-var warnings.
  async headers() {
    // Keep the admin surface out of search indexes and strip referrers leaving it.
    // The admin sign-in page is unlinked and never appears in robots.txt or the
    // sitemap; these headers are belt-and-suspenders for the 404-secrecy posture.
    const adminHeaders = [
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
      { key: "Referrer-Policy", value: "no-referrer" },
    ];
    return [
      { source: "/admin-login", headers: adminHeaders },
      { source: "/admin/:path*", headers: adminHeaders },
    ];
  },
};

export default nextConfig;
