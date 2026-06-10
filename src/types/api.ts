/**
 * Shared API DTOs and envelope types — the typed contract between server route
 * handlers and the client `services/api/*` layer. These shapes are frozen for
 * slices 3–5 (§7.10); extend, never break.
 */
import type { Database } from "@/types/database";

export type AccountKind = Database["public"]["Enums"]["account_kind"];
export type AccountStatus = Database["public"]["Enums"]["account_status"];
export type ApprovalStatus = Database["public"]["Enums"]["approval_status"];
export type SessionStatus = Database["public"]["Enums"]["session_status"];
export type PriorityLevel = Database["public"]["Enums"]["priority_level"];
export type UrgencyLevel = Database["public"]["Enums"]["urgency_level"];
export type LedgerKind = Database["public"]["Enums"]["ledger_kind"];
export type LocationPreference = Database["public"]["Enums"]["location_preference"];

// --- Error envelope (mirrors lib/http.ts) ------------------------------------

/** The frozen API error body: `{ error, message?, details? }` (§7.1). */
export type ApiErrorBody = {
  error: string;
  message?: string;
  details?: unknown;
};

// --- Pagination envelope -----------------------------------------------------

/** Standard paginated list envelope `{ items, total, limit, offset }` (§7.1). */
export type ListEnvelope<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

// --- Shared sub-DTOs ---------------------------------------------------------

/** Minimal org reference used in dropdowns and the identity payload. */
export type OrgRef = {
  id: string;
  name: string;
};

// --- /api/auth/me (§7.2) — THE identity endpoint -----------------------------

/**
 * Profile slice returned by `GET /api/auth/me`. Served for EVERY status
 * (pending/active/suspended/rejected) — it is the admission-poll target, so the
 * client reads the precise `status` + `status_note` here to render gate cards.
 */
export type MeProfile = {
  id: string;
  kind: AccountKind;
  status: AccountStatus;
  org: OrgRef | null;
  first_name: string;
  last_name: string;
  grade: number | null;
  pronouns: string | null;
  status_note: string | null;
  created_at: string;
};

export type MeResponse = {
  user: { id: string; email: string | null };
  profile: MeProfile;
};

// --- /api/public/orgs (§7.2) -------------------------------------------------

/** Anon-callable active-org list powering signup/login dropdowns. */
export type PublicOrgsResponse = {
  items: OrgRef[];
};

// --- /api/public/status & /api/admin/status ----------------------------------

export type ServiceState = "ok" | "degraded" | "down";

export type PublicStatusResponse = {
  status: ServiceState;
};
