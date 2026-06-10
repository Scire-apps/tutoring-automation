import type { MetadataRoute } from "next";

// Allow-all. The admin surface is kept secret by being unlinked + noindex headers
// (see next.config.ts) — NOT by a Disallow line, which would advertise the path.
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${base}/sitemap.xml`,
  };
}
