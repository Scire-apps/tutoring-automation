import { redirect } from "next/navigation";

import type { MeProfile, OrgRef } from "@/types/api";
import { getServerProfile } from "@/lib/auth";
import { createRSCClient } from "@/lib/supabase/server";
import { homeFor } from "@/lib/routes";
import { MemberLayout } from "@/components/member-layout";
import { Toaster } from "@/components/ui/sonner";

/**
 * Member zone layout (§4.1). The single guard for all `/member/**` pages — the
 * per-page useEffect redirects of the legacy dashboards are gone.
 *
 * Server-side gating (no-flash): read the profile through the cookie session.
 *   - no session / unprovisioned → /auth/login
 *   - not a member               → that kind's home (homeFor)
 *   - member (ANY status)        → render the shell; the dashboard self-gates on
 *                                  status (§4.4). There is NO /member/pending route.
 *
 * The proxy already routes here; this is the authoritative server re-check. The
 * client `<MemberLayout>` then keeps the profile + counts live (admission flips).
 */
export default async function MemberZoneLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerProfile();
  if (!session) {
    redirect("/auth/login");
  }
  const { profile } = session;

  if (profile.kind !== "member") {
    redirect(
      homeFor({ user_kind: profile.kind, user_status: profile.status }),
    );
  }

  // Resolve the org name for the shell subtitle (RLS lets a member read their
  // own org). Best-effort: the shell renders fine without it.
  let org: OrgRef | null = null;
  if (profile.org_id) {
    const supabase = await createRSCClient();
    const { data } = await supabase
      .from("organizations")
      .select("id, name")
      .eq("id", profile.org_id)
      .maybeSingle();
    if (data) org = { id: data.id, name: data.name };
  }

  const initialProfile: MeProfile = {
    id: profile.id,
    kind: profile.kind,
    status: profile.status,
    org,
    first_name: profile.first_name,
    last_name: profile.last_name,
    grade: profile.grade,
    pronouns: profile.pronouns,
    status_note: profile.status_note,
    created_at: profile.created_at,
  };

  return (
    <MemberLayout initialProfile={initialProfile}>
      {children}
      {/* Single Toaster for the whole member zone (toasts fire from the flow
          pages, the recording modal, and the complete button). */}
      <Toaster />
    </MemberLayout>
  );
}
