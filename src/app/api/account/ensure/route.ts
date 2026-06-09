export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json, readJson } from "@/lib/http";
import { requireAuth } from "@/lib/auth";

// POST /api/account/ensure — auth.py: ensure_account
// Ensure a tutor OR tutee row exists for the current user, without creating
// cross-role records. Idempotent.
export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const supabase = auth.supabase;

  const payload = await readJson<Record<string, unknown>>(req);
  const requestedType = payload["account_type"]; // 'tutor' | 'tutee'
  const firstName = payload["first_name"];
  const lastName = payload["last_name"];
  const schoolId = payload["school_id"];
  const email = auth.email;
  const authId = auth.userId;

  if (requestedType !== "tutor" && requestedType !== "tutee") {
    return json({ error: "account_type is required" }, 400);
  }

  // Detect existing role bindings
  let existingRole: "admin" | "tutor" | "tutee" | null = null;
  try {
    const { data } = await supabase
      .from("admins")
      .select("id")
      .eq("auth_id", authId)
      .maybeSingle();
    if (data) existingRole = "admin";
  } catch {
    /* ignore */
  }
  if (existingRole !== "admin") {
    try {
      const { data } = await supabase
        .from("tutors")
        .select("id")
        .eq("auth_id", authId)
        .maybeSingle();
      if (data) existingRole = "tutor";
    } catch {
      /* ignore */
    }
    if (existingRole !== "tutor") {
      try {
        const { data } = await supabase
          .from("tutees")
          .select("id")
          .eq("auth_id", authId)
          .maybeSingle();
        if (data) existingRole = "tutee";
      } catch {
        /* ignore */
      }
    }
  }

  // Admins: do not create a tutor/tutee implicitly
  if (existingRole === "admin") {
    return json({ status: "admin_exists" });
  }

  // If user already has a role, force the operation to that role to avoid cross-creation
  const effectiveType =
    existingRole === "tutor" || existingRole === "tutee" ? existingRole : (requestedType as "tutor" | "tutee");
  const table = effectiveType === "tutor" ? "tutors" : "tutees";

  // Check exists first
  try {
    const { data } = await supabase
      .from(table)
      .select("id")
      .eq("auth_id", authId)
      .maybeSingle();
    if (data) {
      return json({ status: "exists", id: (data as { id: string }).id });
    }
  } catch {
    // continue to create/update
  }

  // Build data for insert/update
  const data: Record<string, unknown> = {
    auth_id: authId,
    email: email,
    first_name: (typeof firstName === "string" && firstName) || "",
    last_name: (typeof lastName === "string" && lastName) || "",
    school_id: schoolId ?? null,
  };
  if (effectiveType === "tutor") {
    data.status = "active";
    data.volunteer_hours = 0;
  } else {
    // Tutee-specific optional fields
    try {
      const grade = payload["grade"];
      const pr = payload["pronouns"];
      const subs = payload["subjects"];
      if (typeof grade === "string" && ["9", "10", "11", "12"].includes(grade)) {
        data.grade = grade;
      }
      if (typeof pr === "string" && pr.trim()) {
        data.pronouns = pr.trim();
      }
      if (Array.isArray(subs)) {
        data.subjects = subs;
      }
    } catch {
      /* ignore */
    }
  }

  // Try insert, on conflict perform update
  try {
    const { data: insData, error } = await supabase
      .from(table)
      .insert(data as never)
      .select();
    if (error) throw error;
    if (insData && insData.length > 0) {
      return json({ status: "created", id: (insData[0] as { id: string }).id }, 201);
    }
  } catch {
    // Likely unique violation (auth_id/email). Try update by auth_id
    try {
      const { data: updData, error: updError } = await supabase
        .from(table)
        .update(data as never)
        .eq("auth_id", authId)
        .select();
      if (updError) throw updError;
      if (updData && updData.length > 0) {
        return json({ status: "updated", id: (updData[0] as { id: string }).id });
      }
    } catch (e2) {
      return json(
        { error: "failed to ensure account", details: e2 instanceof Error ? e2.message : String(e2) },
        500
      );
    }
  }

  // If we reached here, select again to confirm
  const { data: finalData } = await supabase
    .from(table)
    .select("id")
    .eq("auth_id", authId)
    .maybeSingle();
  if (finalData) {
    return json({ status: "exists", id: (finalData as { id: string }).id });
  }
  return json({ error: "failed to create account" }, 500);
}
