"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, UserCog, Info } from "lucide-react";

import type { ManageManagerRow } from "@/services/api/manage";
import { listManagers, decideManager } from "@/services/api/manage";
import { ApiError } from "@/services/api";
import { useManagerContext } from "@/components/manager-shell";
import { AccountStatusChip } from "@/components/manager/account-status-chip";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { personName } from "@/lib/manager-format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * Managers (§5.7) — MY org only. Pending managers can be Approved (→ active +
 * email) or Rejected (→ rejected + email); the active list is READ-ONLY (managers
 * cannot suspend/remove peers — admin-only, enforced in the DB trigger). The page
 * notes "Contact the Scire team to remove a manager."
 */
export default function ManagerManagersPage() {
  const { profile, refreshCounts } = useManagerContext();
  const [rows, setRows] = useState<ManageManagerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [approveTarget, setApproveTarget] = useState<ManageManagerRow | null>(null);
  const [rejectTarget, setRejectTarget] = useState<ManageManagerRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listManagers());
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message || "Couldn't load managers." : "Couldn't load managers.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async (post-await) data fetch
    void load();
  }, [load]);

  const afterMutation = useCallback(async () => {
    await Promise.all([load(), refreshCounts()]);
  }, [load, refreshCounts]);

  const pending = rows.filter((m) => m.status === "pending");
  const active = rows.filter((m) => m.status === "active");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Managers</h1>
        <p className="text-sm text-muted-foreground">
          Managers for {profile.org?.name ?? "your organization"}.
        </p>
      </header>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {/* Pending */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Pending activation</h2>
        {loading && rows.length === 0 ? (
          <SkeletonList />
        ) : pending.length === 0 ? (
          <Card className="py-8 text-center">
            <CardContent>
              <p className="text-sm text-muted-foreground">No managers are awaiting activation.</p>
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-2">
            {pending.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-4 py-3"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                  <UserCog className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{personName(m)}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {m.email} · requested {new Date(m.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setRejectTarget(m)}>
                    Reject
                  </Button>
                  <Button size="sm" onClick={() => setApproveTarget(m)}>
                    Approve
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Active (read-only) */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Active managers</h2>
        {loading && rows.length === 0 ? (
          <SkeletonList />
        ) : active.length === 0 ? (
          <Card className="py-8 text-center">
            <CardContent>
              <p className="text-sm text-muted-foreground">No active managers yet.</p>
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-2">
            {active.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-4 py-3"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                  <ShieldCheck className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">
                    {personName(m)}
                    {m.id === profile.id ? (
                      <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>
                    ) : null}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{m.email}</p>
                </div>
                <AccountStatusChip status={m.status} />
              </li>
            ))}
          </ul>
        )}

        <Alert>
          <Info className="size-4" />
          <AlertDescription>Contact the Scire team to remove a manager.</AlertDescription>
        </Alert>
      </section>

      {/* Approve / reject confirms */}
      <ConfirmDialog
        open={approveTarget !== null}
        onOpenChange={(open) => {
          if (!open) setApproveTarget(null);
        }}
        title={approveTarget ? `Activate ${personName(approveTarget)}?` : "Activate manager?"}
        description="They gain full manager access to your organization and are emailed."
        confirmLabel="Activate manager"
        onConfirm={async () => {
          if (!approveTarget) return;
          await decideManager(approveTarget.id, { decision: "approve" });
          setApproveTarget(null);
          await afterMutation();
        }}
      />
      <ConfirmDialog
        open={rejectTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRejectTarget(null);
        }}
        title={rejectTarget ? `Reject ${personName(rejectTarget)}?` : "Reject manager?"}
        description="Their pending manager account is rejected and they are emailed."
        confirmLabel="Reject manager"
        destructive
        onConfirm={async () => {
          if (!rejectTarget) return;
          await decideManager(rejectTarget.id, { decision: "reject" });
          setRejectTarget(null);
          await afterMutation();
        }}
      />
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-2">
      {[0, 1].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-lg border bg-muted/40" />
      ))}
    </div>
  );
}
