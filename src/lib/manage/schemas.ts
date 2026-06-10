/**
 * Zod schemas for `/api/manage/*` request bodies (§5 / §7.2). org_id is NEVER a
 * body field — it is always server-derived from the manager's profile (§5.0), so
 * no schema here accepts it.
 */
import { z } from "zod";

/** A manager-visible note appended to the member's gate card via status_note. */
const memberNote = z.string().trim().max(500).optional().nullable();

/** Admit a pending member (§5.5). No body needed; tolerate an empty object. */
export const admitSchema = z.object({}).optional();

/** Reject a member (§5.5). The note binds to profiles.status_note (member-visible). */
export const rejectMemberSchema = z.object({ note: memberNote });
export type RejectMemberBody = z.infer<typeof rejectMemberSchema>;

/**
 * Suspend a member (§5.5 / §7.2). `note` → status_note; `cancel_active` (default
 * true) cascades: open requests → cancelled, active sessions → released to open.
 */
export const suspendSchema = z.object({
  note: memberNote,
  cancel_active: z.boolean().optional().default(true),
});
export type SuspendBody = z.infer<typeof suspendSchema>;

/** Restore a suspended/rejected member (§5.5). status_note clears on restore. */
export const restoreSchema = z.object({}).optional();

/** Approve a pending peer manager (§5.7). */
export const approveManagerSchema = z.object({}).optional();

/** Reject a pending peer manager (§5.7). Optional note for the email. */
export const rejectManagerSchema = z.object({
  note: z.string().trim().max(500).optional().nullable(),
});
export type RejectManagerBody = z.infer<typeof rejectManagerSchema>;

/** Direct-grant a subject approval to a member (§5.6). evidence stays NULL. */
export const directGrantSchema = z.object({
  member_id: z.string().uuid(),
  org_subject_id: z.string().uuid(),
  note: z.string().trim().max(500).optional().nullable(),
});
export type DirectGrantBody = z.infer<typeof directGrantSchema>;

/** Decide a pending subject-approval request (§5.6). */
export const decideApprovalSchema = z.object({
  action: z.enum(["approve", "reject"]),
  note: z.string().trim().max(500).optional().nullable(),
});
export type DecideApprovalBody = z.infer<typeof decideApprovalSchema>;

/** Revoke an approved subject approval (§5.6). */
export const revokeApprovalSchema = z.object({
  note: z.string().trim().max(500).optional().nullable(),
});
export type RevokeApprovalBody = z.infer<typeof revokeApprovalSchema>;

const SUBJECT_GRADE = z.number().int().min(1).max(13).nullable().optional();

/** Create an org subject (§5.11). Triple is name + optional category + grade. */
export const createSubjectSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  category: z.string().trim().min(1).max(80).nullable().optional(),
  grade_level: SUBJECT_GRADE,
});
export type CreateSubjectBody = z.infer<typeof createSubjectSchema>;

/**
 * Edit an org subject (§5.11). Rename/recategorize/regrade and/or toggle active
 * (soft-deactivate — there is NO hard delete route). All fields optional.
 */
export const patchSubjectSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  category: z.string().trim().min(1).max(80).nullable().optional(),
  grade_level: SUBJECT_GRADE,
  active: z.boolean().optional(),
});
export type PatchSubjectBody = z.infer<typeof patchSubjectSchema>;

/** A reason-required intervention (cancel / reopen / request-changes; §5.8). */
export const reasonSchema = z.object({
  reason: z.string().trim().min(1, "A reason is required").max(500),
});
export type ReasonBody = z.infer<typeof reasonSchema>;

/**
 * Verify a completed/needs_changes session (§5.9). hours ≥ 0.25 step 0.25, ≤ 24
 * (the table CHECK enforces > 0 and ≤ 24; a zero-hour outcome is a cancel, not a
 * verify). Rounded to the nearest 0.25 here so an off-grid value is rejected.
 */
export const verifySchema = z.object({
  hours: z
    .number()
    .min(0.25, "Award at least 0.25 hours")
    .max(24, "Hours cannot exceed 24")
    .refine((h) => Math.abs(h * 4 - Math.round(h * 4)) < 1e-9, {
      message: "Hours must be in steps of 0.25",
    }),
  note: z.string().trim().max(500).optional().nullable(),
});
export type VerifyBody = z.infer<typeof verifySchema>;

/** Set a session's priority (§5.8). Field edit (PATCH) — audited, no party email. */
export const prioritySchema = z.object({
  priority: z.enum(["low", "normal", "high"]),
});
export type PriorityBody = z.infer<typeof prioritySchema>;

/**
 * Manual hours adjustment (§5.10). Signed nonzero, ≤ 24 magnitude (the ledger
 * CHECK), note REQUIRED. Negative = correction (the balance guard blocks driving
 * a member negative).
 */
export const adjustmentSchema = z.object({
  member_id: z.string().uuid(),
  hours: z
    .number()
    .refine((h) => h !== 0, "Adjustment cannot be zero")
    .refine((h) => Math.abs(h) <= 24, "Adjustment magnitude cannot exceed 24")
    .refine((h) => Math.abs(h * 4 - Math.round(h * 4)) < 1e-9, {
      message: "Hours must be in steps of 0.25",
    }),
  note: z.string().trim().min(1, "A reason is required").max(500),
});
export type AdjustmentBody = z.infer<typeof adjustmentSchema>;

/**
 * Compose a manager broadcast (§5.12 / §2.7). Audience resolved server-side
 * STRICTLY within org; body is plain text (escaped + wrapped in the fixed
 * template). `member_ids` required for scope=selected; `subject_id` for
 * scope=subject.
 */
export const broadcastSchema = z
  .object({
    scope: z.enum(["all_active", "pending", "subject", "selected"]),
    subject: z.string().trim().min(1, "A subject is required").max(200),
    body: z.string().trim().min(1, "A message is required").max(10_000),
    member_ids: z.array(z.string().uuid()).max(2000).optional(),
    subject_id: z.string().uuid().optional(),
  })
  .refine((v) => v.scope !== "selected" || (v.member_ids && v.member_ids.length > 0), {
    message: "Select at least one recipient",
    path: ["member_ids"],
  })
  .refine((v) => v.scope !== "subject" || !!v.subject_id, {
    message: "Choose a subject",
    path: ["subject_id"],
  });
export type BroadcastBody = z.infer<typeof broadcastSchema>;

/** Resolve a help request (§5.13). Soft — sets status + resolved_by/at. */
export const resolveHelpSchema = z.object({}).optional();
