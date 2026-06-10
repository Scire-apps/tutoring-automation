"use client";

/**
 * Typed client for the `/api/public/*` group (§7.9). Anon-safe calls used by the
 * landing + auth pages (org dropdowns, health). Consumes `core.ts`; the org list
 * is memoized client-side (the route is also edge-cached).
 */
import { get } from "./core";
import type { PublicOrgsResponse, PublicStatusResponse } from "@/types/api";

/** `GET /api/public/orgs` — active orgs `{ items:[{id,name}] }` for signup/login dropdowns. */
export const listOrgs = () => get<PublicOrgsResponse>("/api/public/orgs", { ttl: 600_000 });

/** `GET /api/public/status` — public service health. */
export const getPublicStatus = () => get<PublicStatusResponse>("/api/public/status");
