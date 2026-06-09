/**
 * Single client-safe source of brand strings. Consumed by every page, layout,
 * and email template. Future real artwork drops into `public/brand/` and only
 * the brand components change — string constants stay here.
 */
export const BRAND = {
  name: "Scire",
  tagline: "Peer tutoring, organized.",
  description:
    "One account to learn and tutor — with manager-approved subjects, built-in scheduling, and verified volunteer hours.",
  contactEmail: "contact@tutoringapp.ca",
  emailFromName: "Scire",
} as const;
