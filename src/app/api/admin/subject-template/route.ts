import { after } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { json, listResponse, parseListParams, conflict, serverError } from "@/lib/http";
import { parseBody } from "@/lib/validation";
import { logAudit } from "@/lib/log";
import { createTemplateSchema } from "@/lib/admin/schemas";
import { toAdminTemplateDTO, type AdminTemplateDTO } from "@/lib/admin/dtos";
import type { Database } from "@/types/database";

type TemplateRow = Database["public"]["Tables"]["subject_templates"]["Row"];

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/subject-template ?q&limit&offset — the default subject template
 * (§6.4): the catalog copied into every NEW org at creation. Edits here affect
 * future org creations only (existing orgs keep their snapshot). Sorted by name /
 * category / grade, paginated, with optional `q` over name. requireAdmin gates.
 */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { supabase } = auth;
  const url = new URL(req.url);
  const { limit, offset } = parseListParams(url);
  const q = (url.searchParams.get("q") || "").trim();

  let query = supabase
    .from("subject_templates")
    .select("*", { count: "exact" })
    .order("name", { ascending: true })
    .order("category", { ascending: true, nullsFirst: true })
    .order("grade_level", { ascending: true, nullsFirst: true });
  if (q) query = query.ilike("name", `%${q.replace(/[%,()]/g, " ")}%`);

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) return serverError("server_error", "Failed to load the subject template");

  const items: AdminTemplateDTO[] = ((data as TemplateRow[]) ?? []).map(toAdminTemplateDTO);
  return listResponse(items, count ?? 0, { limit, offset });
}

/**
 * POST /api/admin/subject-template {name, category?, grade_level?} — add a default
 * template row (§6.4). The triple is unique (NULLS NOT DISTINCT) → duplicate is
 * 409. subject_templates has no audit trigger, so an explicit `template.created`
 * audit row is written. requireAdmin gates.
 */
export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const parsed = await parseBody(req, createTemplateSchema);
  if (!parsed.ok) return parsed.response;
  const { name } = parsed.data;
  const category = parsed.data.category ?? null;
  const grade_level = parsed.data.grade_level ?? null;

  const { data, error } = await supabase
    .from("subject_templates")
    .insert({ name, category, grade_level })
    .select("*")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") return conflict("invalid_state", "That template subject already exists");
    return serverError("server_error", error.message);
  }
  if (!data) return serverError("server_error", "Failed to create the template subject");

  const row = data as TemplateRow;
  after(() =>
    logAudit({
      action: "template.created",
      actor_id: user.id,
      actor_kind: "admin",
      target_table: "subject_templates",
      target_id: row.id,
      metadata: { name: row.name, category: row.category, grade_level: row.grade_level },
    }),
  );

  return json(toAdminTemplateDTO(row), 201);
}
