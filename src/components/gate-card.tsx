import { Hourglass, ShieldX, ShieldAlert } from "lucide-react";

import type { AccountStatus } from "@/types/api";
import { BRAND } from "@/lib/brand";
import { AccountStatusCard } from "@/components/account-status-card";

/**
 * The member dashboard gate card (§4.4) for the three non-active states. Renders
 * the EXACT locked copy per status:
 *   - pending   → "You're almost in" (hourglass/amber), org-name interpolated
 *   - rejected  → red card surfacing the manager's status_note
 *   - suspended → amber card surfacing the status_note
 *
 * The actions (Refresh status / Sign out) are supplied by the dashboard, which
 * owns the `/api/auth/me` refetch + sign-out wiring. There is NO /member/pending
 * route — this card IS the gate, rendered inside the member layout shell.
 */
export function GateCard({
  status,
  orgName,
  statusNote,
  actions,
}: {
  status: Exclude<AccountStatus, "active">;
  orgName: string | null;
  statusNote: string | null;
  actions?: React.ReactNode;
}) {
  const org = orgName ?? "your organization";

  if (status === "pending") {
    return (
      <AccountStatusCard
        icon={Hourglass}
        tone="amber"
        heading="You're almost in"
        body={
          <p>
            Your email is verified. A manager at {org} now needs to admit your
            account before you can request or give tutoring. We&apos;ll email you
            when you&apos;re in. Questions? Email{" "}
            <a
              href={`mailto:${BRAND.contactEmail}`}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {BRAND.contactEmail}
            </a>
            .
          </p>
        }
        actions={actions}
      />
    );
  }

  if (status === "rejected") {
    return (
      <AccountStatusCard
        icon={ShieldX}
        tone="red"
        heading="Your account wasn't approved"
        body={
          <div className="space-y-2">
            <p>
              A manager at {org} did not approve your account for {BRAND.name}.
            </p>
            {statusNote ? (
              <p className="rounded-md bg-red-50 px-3 py-2 text-left text-red-800">
                {statusNote}
              </p>
            ) : null}
            <p>
              Questions? Email{" "}
              <a
                href={`mailto:${BRAND.contactEmail}`}
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                {BRAND.contactEmail}
              </a>
              .
            </p>
          </div>
        }
        actions={actions}
      />
    );
  }

  // suspended
  return (
    <AccountStatusCard
      icon={ShieldAlert}
      tone="amber"
      heading="Your account is suspended"
      body={
        <div className="space-y-2">
          <p>
            Your access to {org} on {BRAND.name} is paused. A manager can restore
            it.
          </p>
          {statusNote ? (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-left text-amber-800">
              {statusNote}
            </p>
          ) : null}
          <p>
            Questions? Email{" "}
            <a
              href={`mailto:${BRAND.contactEmail}`}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {BRAND.contactEmail}
            </a>
            .
          </p>
        </div>
      }
      actions={actions}
    />
  );
}
