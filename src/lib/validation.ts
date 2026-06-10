import type { NextResponse } from "next/server";
import type { ZodType, ZodError } from "zod";
import { readJson, validationError } from "@/lib/http";

/** Discriminated result of `parseBody` — mirrors the guard return idiom. */
export type ParseOk<T> = { ok: true; data: T };
export type ParseFail = { ok: false; response: NextResponse };

/**
 * Shape a `ZodError` into the `details` payload for a 400 `validation_error`:
 * a flat list of `{ path, message }` so clients can surface field-level errors
 * without depending on zod internals.
 */
function issueList(error: ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((i) => ({
    path: i.path.join("."),
    message: i.message,
  }));
}

/**
 * Parse and validate a JSON request body against a zod schema.
 *
 *   const parsed = await parseBody(req, BodySchema);
 *   if (!parsed.ok) return parsed.response;   // 400 validation_error
 *   // use parsed.data (typed)
 *
 * On failure returns a 400 `{ error: "validation_error", details: [...] }`.
 */
export async function parseBody<T>(
  req: Request,
  schema: ZodType<T>,
): Promise<ParseOk<T> | ParseFail> {
  const raw = await readJson(req);
  const result = schema.safeParse(raw);
  if (!result.success) {
    return { ok: false, response: validationError(issueList(result.error)) };
  }
  return { ok: true, data: result.data };
}

/**
 * Validate an already-parsed value (e.g. query params assembled into an object)
 * against a schema, returning the same discriminated union as `parseBody`.
 */
export function parseValue<T>(
  value: unknown,
  schema: ZodType<T>,
): ParseOk<T> | ParseFail {
  const result = schema.safeParse(value);
  if (!result.success) {
    return { ok: false, response: validationError(issueList(result.error)) };
  }
  return { ok: true, data: result.data };
}
