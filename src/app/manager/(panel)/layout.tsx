import { redirect } from "next/navigation";

import type { MeProfile, OrgRef } from "@/types/api";
import { getServerProfile } from "@/lib/auth";
import { createRSCClient } from "@/lib/supabase/server";
import { homeFor } from "@/lib/routes";
import { ManagerShell } from "@/components/manager-shell";
import { ManagerSuspendedCard } from "@/components/manager-suspended-card";
import { Toaster } from "@/components/ui/sonner";

/**
 * Manager panel layout (§5.1, §5.2) — the single guard for every
 * `/manager/(panel)/**` page. Server-side gating (no-flash) via the cookie
 * session:
 *   - no session / unprovisioned → /auth/login
 *   - kind ≠ manager             → that kind's home (homeFor)
 *   - pending manager            → /manager/pending (the locked-modal gate page,
 *                                   which lives OUTSIDE this (panel) group)
 *   - suspended / rejected       → the suspended card + Sign out (no panel)
 *   - active manager             → render the shell
 *
 * The proxy already routes here; this is the authoritative server re-check. The
 * client `<ManagerShell>` then keeps the badge counts live. Every `/api/manage/*`
 * handler re-verifies with requireActiveManager, so a status flip bites at the
 * data layer immediately regardless of chrome staleness.
 */
export default async function ManagerPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerProfile();
  if (!session) {
    redirect("/auth/login");
  }
  const { profile } = session;

  if (profile.kind !== "manager") {
    redirect(homeFor({ user_kind: profile.kind, user_status: profile.status }));
  }

  if (profile.status === "pending") {
    redirect("/manager/pending");
  }

  // Resolve the org name for the shell / suspended card (RLS lets a manager read
  // their own org). Best-effort: the chrome renders fine without it.
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

  if (profile.status !== "active") {
    // suspended (or rejected) — no panel access.
    return <ManagerSuspendedCard orgName={org?.name ?? null} />;
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
    <ManagerShell initialProfile={initialProfile}>
      {children}
      {/* Single Toaster for the whole manager zone. */}
      <Toaster />
    </ManagerShell>
  );
}
