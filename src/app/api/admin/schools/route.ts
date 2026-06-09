import { json, serverError } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const a = await requireAdmin(req);
  if (!a.ok) return a.response;
  try {
    const { data } = await a.supabase
      .from("schools")
      .select("*")
      .order("name");
    return json({ schools: data || [] }, 200);
  } catch (e) {
    console.error("Error listing schools:", e);
    return serverError();
  }
}
