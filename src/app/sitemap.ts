import type { MetadataRoute } from "next";

// Exactly the four public, indexable routes. Authenticated zones, the admin
// surface, and transactional auth flows are intentionally excluded.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return [
    "/",
    "/auth/register",
    "/auth/register/manager",
    "/auth/login",
  ].map((path) => ({ url: `${base}${path}`, lastModified: new Date() }));
}
