"use client";

/**
 * Client-side API core (§7.9). One `request()` over same-origin `/api/*` routes,
 * Bearer-authed from the cookie-native browser session. Errors surface as a typed
 * `ApiError` (`{ status, code, message, details }`) so callers branch on `code`.
 *
 * Caching is OPT-IN and default 0 (the legacy global-TTL maze is gone). A GET may
 * pass `{ ttl }` to memoize for that many ms; any mutation (non-GET) invalidates
 * every cached GET sharing its `/api/<group>` prefix.
 */
import { getBrowserClient } from "@/lib/supabase/client";
import type { ApiErrorBody } from "@/types/api";

/** Thrown on any non-2xx response. `code` is the stable machine error code. */
export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, code: string, message?: string, details?: unknown) {
    super(message || code);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
  /** True for `member_not_active` / `manager_not_active` (⇒ refetch /api/auth/me, re-render gate). */
  get isInactive(): boolean {
    return this.code === "member_not_active" || this.code === "manager_not_active";
  }
}

export type RequestOptions = {
  method?: string;
  /** JSON-serializable request body (sent as application/json). */
  body?: unknown;
  /** Opt-in client cache TTL in ms for GETs. Default 0 (no caching). */
  ttl?: number;
  /** Extra headers. */
  headers?: Record<string, string>;
  /** Pass an AbortSignal to cancel in-flight requests. */
  signal?: AbortSignal;
};

type CacheEntry = { ts: number; ttl: number; data: unknown };
const cache = new Map<string, CacheEntry>();

function cacheKey(path: string): string {
  return path;
}

/** Group prefix `/api/<group>` used for mutation invalidation. */
function groupPrefix(path: string): string | null {
  const m = path.match(/^(\/api\/[^/?]+)/);
  return m ? m[1] : null;
}

function invalidateGroup(path: string): void {
  const prefix = groupPrefix(path);
  if (!prefix) return;
  for (const key of Array.from(cache.keys())) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await getBrowserClient().auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Perform an API request. Resolves to the parsed JSON body (typed as `T`);
 * rejects with `ApiError` on non-2xx.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();

  if (method === "GET" && options.ttl && options.ttl > 0) {
    const hit = cache.get(cacheKey(path));
    if (hit && Date.now() - hit.ts < hit.ttl) {
      return hit.data as T;
    }
  }

  const headers: Record<string, string> = {
    ...(await authHeader()),
    ...options.headers,
  };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(path, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  // 204 / empty body
  const text = await res.text();
  const data: unknown = text ? safeJson(text) : null;

  if (!res.ok) {
    const err = (data ?? {}) as ApiErrorBody;
    throw new ApiError(res.status, err.error ?? "server_error", err.message, err.details);
  }

  if (method === "GET") {
    if (options.ttl && options.ttl > 0) {
      cache.set(cacheKey(path), { ts: Date.now(), ttl: options.ttl, data });
    }
  } else {
    // Any mutation invalidates cached GETs in the same API group.
    invalidateGroup(path);
  }

  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Convenience verbs. */
export const get = <T>(path: string, opts?: Omit<RequestOptions, "method" | "body">) =>
  request<T>(path, { ...opts, method: "GET" });

export const post = <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method">) =>
  request<T>(path, { ...opts, method: "POST", body });

export const patch = <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method">) =>
  request<T>(path, { ...opts, method: "PATCH", body });

export const put = <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method">) =>
  request<T>(path, { ...opts, method: "PUT", body });

export const del = <T>(path: string, opts?: Omit<RequestOptions, "method" | "body">) =>
  request<T>(path, { ...opts, method: "DELETE" });

/** Manually clear the entire client cache or a single API group. */
export function invalidate(group?: string): void {
  if (!group) {
    cache.clear();
    return;
  }
  for (const key of Array.from(cache.keys())) {
    if (key.startsWith(group)) cache.delete(key);
  }
}
