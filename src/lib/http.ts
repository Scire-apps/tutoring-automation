import { NextResponse } from "next/server";

/**
 * JSON response helper used by every API route handler.
 * Mirrors Flask's `jsonify(body), status`.
 */
export function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status });
}

export const badRequest = (error: string, details?: string) =>
  json(details ? { error, details } : { error }, 400);

export const unauthorized = (error = "Invalid token") => json({ error }, 401);

export const forbidden = (error = "Access denied") => json({ error }, 403);

export const notFound = (error = "Not found") => json({ error }, 404);

export const serverError = (error = "Internal server error") => json({ error }, 500);

/** Read the Bearer token from an incoming request's Authorization header. */
export function getBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!header) return null;
  const parts = header.split(" ");
  if (parts.length === 2 && parts[0].toLowerCase() === "bearer") return parts[1];
  return null;
}

/** Safely parse a JSON request body, returning {} on failure (matches Flask's `request.get_json() or {}`). */
export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    const text = await req.text();
    if (!text) return {} as T;
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}
