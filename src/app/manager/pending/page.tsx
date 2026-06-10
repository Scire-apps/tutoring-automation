"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";

import { BRAND } from "@/lib/brand";
import { getMe } from "@/services/api";
import { useAuth } from "@/app/providers";
import { PageBackdrop } from "@/components/page-backdrop";
import { AccountStatusCard } from "@/components/account-status-card";
import { Button } from "@/components/ui/button";

const POLL_MS = 60_000;

/**
 * The pending-manager gate (§8.3 / §5.2) — a standalone page OUTSIDE the manager
 * (panel) shell: no nav/header, a single centered modal-styled card with the
 * EXACT locked copy. Org name comes from `GET /api/auth/me` (fallback "your
 * organization"); the email is a mailto.
 *
 * Polls `/api/auth/me` every 60s + on window focus. On a status flip to active it
 * re-mints the JWT routing-hint claims (`refreshClaims`) BEFORE routing, so the
 * proxy's getClaims() sees the fresh status and lets the manager into the panel.
 * An already-active manager who lands here is bounced straight to the dashboard.
 */
export default function ManagerPendingPage() {
  const router = useRouter();
  const { signOut, refreshClaims } = useAuth();
  const [orgName, setOrgName] = useState<string | null>(null);

  // Guard so the activation routing fires once.
  const routedRef = useRef(false);

  const route = useCallback(
    async (active: boolean) => {
      if (!active || routedRef.current) return;
      routedRef.current = true;
      // Re-mint claims so the proxy admits the now-active manager, then route.
      await refreshClaims();
      router.replace("/manager/dashboard");
    },
    [refreshClaims, router],
  );

  const poll = useCallback(async () => {
    try {
      const me = await getMe();
      setOrgName(me.profile.org?.name ?? null);
      if (me.profile.kind !== "manager") {
        // Not (or no longer) a manager — hand off to the canonical home.
        if (!routedRef.current) {
          routedRef.current = true;
          await refreshClaims();
          router.replace("/auth/login");
        }
        return;
      }
      await route(me.profile.status === "active");
    } catch {
      // Transient; the next poll retries.
    }
  }, [route, refreshClaims, router]);

  // Poll on mount, every 60s, and on window focus (subscribe to external systems).
  // `poll` sets state only AFTER its await, never synchronously during render.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async (post-await) poll + external subscriptions
    void poll();
    const id = setInterval(poll, POLL_MS);
    const onFocus = () => void poll();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [poll]);

  async function handleSignOut() {
    await signOut();
    router.push("/auth/login");
  }

  const org = orgName ?? "your organization";

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <PageBackdrop />
      <AccountStatusCard
        icon={ShieldAlert}
        tone="amber"
        heading="Manager account pending activation"
        body={
          <p>
            Please contact the Scire Team to activate your Manager account for
            organization {org}. Their contact email is{" "}
            <a
              href={`mailto:${BRAND.contactEmail}`}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {BRAND.contactEmail}
            </a>
            .
          </p>
        }
        actions={
          <>
            <Button asChild>
              <a href={`mailto:${BRAND.contactEmail}`}>Email the Scire Team</a>
            </Button>
            <Button variant="ghost" onClick={handleSignOut}>
              Sign out
            </Button>
          </>
        }
      />
    </main>
  );
}
