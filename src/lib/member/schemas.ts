/**
 * Zod schemas for `/api/member/*` request bodies (§7.1). Domain numeric rules
 * (duration 60–180 step 30, availability shape) reuse the pure validators in
 * `lib/domain.ts` as refinements so the arithmetic stays single-sourced.
 */
import { z } from "zod";
import { isValidDesiredDuration, validateAvailabilityShape } from "@/lib/domain";

/** Create a tutoring request (§4.5). notes ≥ 10 chars; subject resolves to an org_subject_id. */
export const createSessionSchema = z.object({
  org_subject_id: z.string().uuid(),
  location_preference: z.enum(["online", "in_person"]),
  notes: z.string().trim().min(10, "Please add at least 10 characters of detail"),
  language: z.string().trim().min(1).max(80).optional().nullable(),
});
export type CreateSessionBody = z.infer<typeof createSessionSchema>;

/** Requester sets availability + duration after a claim (§4.7). */
export const availabilitySchema = z.object({
  availability: z
    .record(z.string(), z.array(z.string()))
    .refine((v) => validateAvailabilityShape(v).ok, {
      message: "availability must be an object of date -> time ranges",
    }),
  duration_minutes: z
    .number()
    .int()
    .refine(isValidDesiredDuration, "Duration must be 60, 90, 120, 150, or 180 minutes"),
});
export type AvailabilityBody = z.infer<typeof availabilitySchema>;

/**
 * Claimer schedules an exact slot (§4.7). The client passes the local date +
 * start to avoid timezone drift; `scheduled_at` is the resolved ISO instant.
 */
export const scheduleSchema = z.object({
  scheduled_at: z.string().min(1),
  /** "YYYY-MM-DD" — the availability date the slot falls on. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** "HH:MM" — the start time within that date's windows. */
  start: z.string().regex(/^\d{2}:\d{2}$/),
  duration_minutes: z
    .number()
    .int()
    .refine(isValidDesiredDuration, "Duration must be 60, 90, 120, 150, or 180 minutes"),
  location: z.string().trim().min(1).max(200).optional().nullable(),
});
export type ScheduleBody = z.infer<typeof scheduleSchema>;

/** Save / edit the recording link (§4.7). Editable in scheduled|needs_changes only. */
export const recordingSchema = z.object({
  recording_url: z.string().trim().url("Enter a valid URL"),
});
export type RecordingBody = z.infer<typeof recordingSchema>;

/** Role-aware cancel (§4.3). Reason is optional (claimer release needs none). */
export const cancelSchema = z.object({
  reason: z.string().trim().max(500).optional().nullable(),
});
export type CancelBody = z.infer<typeof cancelSchema>;

/** Request a subject approval (§4.8). evidence is required (the DB CHECK enforces it too). */
export const subjectApprovalSchema = z.object({
  org_subject_id: z.string().uuid(),
  evidence: z.string().trim().min(1, "Evidence is required").max(500),
});
export type SubjectApprovalBody = z.infer<typeof subjectApprovalSchema>;

/** Ask for help (§4.9). ACTIVE members only (RLS enforces). */
export const helpSchema = z.object({
  urgency: z.enum(["low", "normal", "high"]).optional(),
  description: z.string().trim().min(1, "Describe what you need help with").max(2000),
});
export type HelpBody = z.infer<typeof helpSchema>;

/** Edit own profile (§4.9). All fields optional; grade 9–12 or null; pronouns ≤ 40. */
export const profileSchema = z.object({
  first_name: z.string().trim().min(1).max(80).optional(),
  last_name: z.string().trim().min(1).max(80).optional(),
  grade: z.number().int().min(9).max(12).nullable().optional(),
  pronouns: z.string().trim().max(40).nullable().optional(),
});
export type ProfileBody = z.infer<typeof profileSchema>;
