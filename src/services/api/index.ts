"use client";

/**
 * Barrel for the client API layer (§7.9). Re-exports the core `request`/verbs and
 * `ApiError`, plus the foundational typed calls owned by the server-core slice
 * (identity + public). Slices 3–5 add `member.ts` / `manage.ts` / `admin.ts` and
 * widen this barrel.
 */
export {
  request,
  get,
  post,
  patch,
  put,
  del,
  invalidate,
  ApiError,
  type RequestOptions,
} from "./core";

import { get } from "./core";
import type { MeResponse, PublicOrgsResponse, PublicStatusResponse } from "@/types/api";

/** `GET /api/auth/me` — the identity endpoint; safe to call at any account status. */
export const getMe = () => get<MeResponse>("/api/auth/me");

/** `GET /api/public/orgs` — active orgs for signup/login dropdowns. */
export const listOrgs = () => get<PublicOrgsResponse>("/api/public/orgs", { ttl: 600_000 });

/** `GET /api/public/status` — public health check. */
export const getPublicStatus = () => get<PublicStatusResponse>("/api/public/status");
