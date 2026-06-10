import { NextResponse } from "next/server";

/**
 * The frozen API error envelope (§7.1): `{ error: <code>, message?, details? }`.
 * `error` is a stable machine code; `message` is human-facing; `details` carries
 * structured extras (e.g. zod issues, the current row status on a 409).
 */
export type ApiErrorCode =
  // 401
  | "unauthorized"
  | "unauthenticated"
  | "invalid_token"
  // 403
  | "forbidden"
  | "member_not_active"
  | "manager_not_active"
  | "own_request"
  | "not_approved_for_subject"
  // 404
  | "not_found"
  // 409
  | "invalid_state"
  | "already_claimed"
  | "recording_required"
  | "wrong_kind"
  | "org_not_empty"
  | "open_request_limit"
  // 400
  | "validation_error"
  // 429
  | "rate_limited"
  // 500
  | "profile_missing"
  | "server_error";

export type ApiErrorBody = {
  error: ApiErrorCode | string;
  message?: string;
  details?: unknown;
};

/**
 * JSON response helper used by every API route handler. Strongly typed over the
 * envelope so success and error bodies share one shape contract.
 */
export function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status });
}

/** Build a `{ error, message?, details? }` error response with a given status. */
export function apiError(
  status: number,
  error: ApiErrorCode | string,
  message?: string,
  details?: unknown,
): NextResponse {
  const body: ApiErrorBody = { error };
  if (message !== undefined) body.message = message;
  if (details !== undefined) body.details = details;
  return NextResponse.json(body, { status });
}

// --- Status-specific helpers (code + optional message/details) ---------------

export const badRequest = (
  error: ApiErrorCode | string = "validation_error",
  message?: string,
  details?: unknown,
) => apiError(400, error, message, details);

/** 400 validation_error carrying a zod issue list (or any structured detail). */
export const validationError = (details: unknown, message = "Invalid request body") =>
  apiError(400, "validation_error", message, details);

export const unauthorized = (
  error: ApiErrorCode | string = "unauthorized",
  message?: string,
) => apiError(401, error, message);

export const forbidden = (
  error: ApiErrorCode | string = "forbidden",
  message?: string,
  details?: unknown,
) => apiError(403, error, message, details);

export const notFound = (error: ApiErrorCode | string = "not_found", message?: string) =>
  apiError(404, error, message);

/** 409 — state conflicts (invalid_state, already_claimed, wrong_kind, …). */
export const conflict = (
  error: ApiErrorCode | string = "invalid_state",
  message?: string,
  details?: unknown,
) => apiError(409, error, message, details);

export const rateLimited = (message?: string, details?: unknown) =>
  apiError(429, "rate_limited", message, details);

export const serverError = (
  error: ApiErrorCode | string = "server_error",
  message?: string,
) => apiError(500, error, message);

/** Read the Bearer token from an incoming request's Authorization header. */
export function getBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!header) return null;
  const parts = header.split(" ");
  if (parts.length === 2 && parts[0].toLowerCase() === "bearer") return parts[1];
  return null;
}

/** Safely parse a JSON request body, returning {} on failure. */
export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    const text = await req.text();
    if (!text) return {} as T;
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

// --- Pagination (§7.1) -------------------------------------------------------

export const LIST_LIMIT_DEFAULT = 25;
export const LIST_LIMIT_MAX = 100;

export type ListParams = { limit: number; offset: number };

/**
 * Parse `?limit&offset` from a request URL. `limit` defaults to 25 and is clamped
 * to [1, 100]; `offset` defaults to 0 and is clamped to ≥ 0. Non-numeric input
 * falls back to defaults. Maps directly onto PostgREST `.range(offset, offset+limit-1)`.
 */
export function parseListParams(req: Request | URL | URLSearchParams): ListParams {
  const params =
    req instanceof URLSearchParams
      ? req
      : req instanceof URL
        ? req.searchParams
        : new URL(req.url).searchParams;

  const rawLimit = Number(params.get("limit"));
  const rawOffset = Number(params.get("offset"));

  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), LIST_LIMIT_MAX)
      : LIST_LIMIT_DEFAULT;
  const offset =
    Number.isFinite(rawOffset) && rawOffset > 0 ? Math.floor(rawOffset) : 0;

  return { limit, offset };
}

export type ListEnvelope<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

/** Build the standard paginated list envelope `{ items, total, limit, offset }`. */
export function listResponse<T>(
  items: T[],
  total: number,
  { limit, offset }: ListParams,
): NextResponse {
  const body: ListEnvelope<T> = { items, total, limit, offset };
  return NextResponse.json(body);
}
