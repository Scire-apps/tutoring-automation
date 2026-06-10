/**
 * Zod schemas for `/api/admin/*` request bodies (§6.4 / §7.2). Admins operate
 * across orgs (RLS grants cross-org rights via `private.is_admin()`), so unlike
 * the manage group these schemas DO carry `org_id` where a target org must be
 * named (org subjects, manager invite). Notes that surface to a member bind to
 * `profiles.status_note`; reasons are required where the §6.4 verb demands one.
 */
import { z } from "zod";

/** A slug fragment matching the organizations CHECK `^[a-z0-9]+(-[a-z0-9]+)*$`. */
const slug = z
  .string()
  .trim()
  .min(1)
  .max(63)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens");

const orgName = z.string().trim().min(1, "Name is required").max(120);

/**
 * Create an organization (§6.4). `slug` is optional (derived from the name when
 * omitted); `seed_subject_ids` selects which template rows survive — `'all'`
 * keeps every copied row, an id array soft-deactivates the unchecked ones after
 * the copy-all RPC. The RPC itself always copies the full template.
 */
export const createOrgSchema = z.object({
  name: orgName,
  slug: slug.optional(),
  seed_subject_ids: z
    .union([z.literal("all"), z.array(z.string().uuid()).max(1000)])
    .optional()
    .default("all"),
});
export type CreateOrgBody = z.infer<typeof createOrgSchema>;

/** Rename / re-slug an org (§6.4). A collision with an ACTIVE org's slug → 409. */
export const patchOrgSchema = z
  .object({
    name: orgName.optional(),
    slug: slug.optional(),
  })
  .refine((v) => v.name !== undefined || v.slug !== undefined, {
    message: "Provide a name or slug to update",
  });
export type PatchOrgBody = z.infer<typeof patchOrgSchema>;

/** A note that surfaces to the member on their gate card via `status_note`. */
const memberNote = z.string().trim().max(500).optional().nullable();

/** Admit a pending member (§6.4). No body required. */
export const admitSchema = z.object({}).optional();

/** Approve a pending manager (§6.4). No body required. */
export const approveSchema = z.object({}).optional();

/** Reject a pending member/manager (§6.4). `note` → status_note (account retained). */
export const rejectSchema = z.object({ note: memberNote });
export type RejectBody = z.infer<typeof rejectSchema>;

/** Suspend an active member/manager (§6.4). `note` → status_note. */
export const suspendSchema = z.object({ note: memberNote });
export type SuspendBody = z.infer<typeof suspendSchema>;

/** Restore a suspended/rejected account (§6.4). status_note clears on restore. */
export const restoreSchema = z.object({}).optional();

/**
 * Signed hours adjustment for any member (§6.4). `delta_hours` is signed nonzero,
 * step 0.25, magnitude ≤ 24 (the ledger CHECK); `note` REQUIRED. Negative = a
 * correction (the balance guard blocks driving the member's total negative).
 */
export const adjustHoursSchema = z.object({
  delta_hours: z
    .number()
    .refine((h) => h !== 0, "Adjustment cannot be zero")
    .refine((h) => Math.abs(h) <= 24, "Adjustment magnitude cannot exceed 24")
    .refine((h) => Math.abs(h * 4 - Math.round(h * 4)) < 1e-9, {
      message: "Hours must be in steps of 0.25",
    }),
  note: z.string().trim().min(1, "A reason is required").max(500),
});
export type AdjustHoursBody = z.infer<typeof adjustHoursSchema>;

/**
 * Invite a manager (§6.4). Admin-only in v1, one org per invite. `inviteUserByEmail`
 * sets `kind:'manager'` + names + org_id in user_metadata so the trigger creates a
 * PENDING manager; the route then service-flips it to active + activated_by.
 */
export const inviteManagerSchema = z.object({
  kind: z.literal("manager"),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(254),
  first_name: z.string().trim().min(1, "First name is required").max(80),
  last_name: z.string().trim().min(1, "Last name is required").max(80),
  org_id: z.string().uuid(),
});
export type InviteManagerBody = z.infer<typeof inviteManagerSchema>;

const SUBJECT_GRADE = z.number().int().min(1).max(13).nullable().optional();

/**
 * Create an org subject as an admin (§6.4). `org_id` names the target org (admin
 * works cross-org). The triple is name + optional category + grade.
 */
export const createSubjectSchema = z.object({
  org_id: z.string().uuid(),
  name: z.string().trim().min(1, "Name is required").max(120),
  category: z.string().trim().min(1).max(80).nullable().optional(),
  grade_level: SUBJECT_GRADE,
});
export type CreateSubjectBody = z.infer<typeof createSubjectSchema>;

/** Edit an org subject (§6.4): rename/recategorize/regrade and/or toggle active. */
export const patchSubjectSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  category: z.string().trim().min(1).max(80).nullable().optional(),
  grade_level: SUBJECT_GRADE,
  active: z.boolean().optional(),
});
export type PatchSubjectBody = z.infer<typeof patchSubjectSchema>;

/** Decide a pending subject-approval as an admin override (§6.4). */
export const decideApprovalSchema = z.object({
  action: z.enum(["approve", "reject"]),
  note: z.string().trim().max(500).optional().nullable(),
});
export type DecideApprovalBody = z.infer<typeof decideApprovalSchema>;

/** A reason-required session intervention (cancel; §6.4). */
export const reasonSchema = z.object({
  reason: z.string().trim().min(1, "A reason is required").max(500),
});
export type ReasonBody = z.infer<typeof reasonSchema>;

/**
 * Verify a completed/needs_changes session as an admin (§6.4). Mirrors the
 * manager verify shape: `awarded_hours` ≥ 0.25 step 0.25, ≤ 24 (the table CHECK
 * enforces > 0). The admin verb uses `awarded_hours` (§7.2) rather than `hours`.
 */
export const verifySchema = z.object({
  awarded_hours: z
    .number()
    .min(0.25, "Award at least 0.25 hours")
    .max(24, "Hours cannot exceed 24")
    .refine((h) => Math.abs(h * 4 - Math.round(h * 4)) < 1e-9, {
      message: "Hours must be in steps of 0.25",
    }),
  note: z.string().trim().max(500).optional().nullable(),
});
export type VerifyBody = z.infer<typeof verifySchema>;

/** Create a default subject-template row (§6.4). Applies to NEW orgs only. */
export const createTemplateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  category: z.string().trim().min(1).max(80).nullable().optional(),
  grade_level: SUBJECT_GRADE,
});
export type CreateTemplateBody = z.infer<typeof createTemplateSchema>;

/** Edit a default subject-template row (§6.4). */
export const patchTemplateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    category: z.string().trim().min(1).max(80).nullable().optional(),
    grade_level: SUBJECT_GRADE,
  })
  .refine((v) => v.name !== undefined || v.category !== undefined || v.grade_level !== undefined, {
    message: "Provide a field to update",
  });
export type PatchTemplateBody = z.infer<typeof patchTemplateSchema>;

/**
 * Derive a URL-safe slug from a free-text org name (the dialog default when no
 * slug is supplied). Lowercases, strips diacritics, collapses non-alphanumerics
 * to single hyphens, trims hyphens. Falls back to "org" for an all-symbol name.
 */
export function slugify(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return base || "org";
}
