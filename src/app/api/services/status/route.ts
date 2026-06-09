export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "@/lib/http";
import { requireAuth } from "@/lib/auth";

// GET /api/services/status — api.py: services_status
// DB check via schools select; email/storage just report configured.
export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  const services: Record<string, { status: string; message?: string }> = {
    database: { status: "unknown" },
    email: { status: "unknown" },
    storage: { status: "unknown" },
  };

  // Check database connection with a table readable under RLS (schools)
  try {
    const { error } = await auth.supabase.from("schools").select("id").limit(1);
    if (error) throw error;
    services.database.status = "operational";
  } catch (e) {
    services.database.status = "error";
    services.database.message = e instanceof Error ? e.message : String(e);
  }

  // Email service configuration (Mailjet, mirrors Flask's all([...]) check)
  const emailConfigured = Boolean(
    process.env.MAILJET_API_KEY && process.env.MAILJET_API_SECRET && process.env.EMAIL_FROM
  );
  services.email.status = emailConfigured ? "configured" : "not_configured";

  // Storage service configuration (Supabase provider)
  const storageConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  services.storage.status = storageConfigured ? "configured" : "not_configured";

  return json(services);
}
