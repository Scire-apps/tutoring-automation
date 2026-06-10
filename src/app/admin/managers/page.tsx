"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";

import {
  listOrgs,
  inviteManager,
  type AdminOrg,
} from "@/services/api/admin";
import { AccountList } from "@/components/admin/account-list";
import { InviteManagerDialog } from "@/components/admin/account-dialogs";
import { Button } from "@/components/ui/button";

/**
 * Managers (global) — §6.3. The back-office of the "contact the Scire Team" modal:
 * an org's FIRST manager is activated here (later managers are approvable in-org).
 * A status-filterable cross-org table (org column shown) with per-row Approve /
 * Reject / Suspend / Restore, plus the Invite-manager dialog (email + name + org
 * picker). The pending queue is the default view; widen with the status filter.
 */
export default function AdminManagersPage() {
  const [orgs, setOrgs] = useState<AdminOrg[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  // Load the active orgs once for the invite picker (page through to gather all).
  const loadOrgs = useCallback(async () => {
    try {
      const first = await listOrgs({ status: "active", limit: 100, offset: 0 });
      const all = [...first.items];
      let offset = first.items.length;
      while (offset < first.total && first.items.length > 0) {
        const next = await listOrgs({ status: "active", limit: 100, offset });
        all.push(...next.items);
        offset += next.items.length;
        if (next.items.length === 0) break;
      }
      setOrgs(all);
    } catch {
      // The picker is best-effort; the table still works.
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async (post-await) data fetch
    void loadOrgs();
  }, [loadOrgs]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <ShieldCheck className="size-6 text-blue-600" aria-hidden="true" />
            Managers
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Activate an organization&apos;s first manager, or invite a new one. Pending requests
            across every org appear here.
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus className="size-4" aria-hidden="true" />
          Invite manager
        </Button>
      </header>

      <AccountList
        key={reloadToken}
        baseParams={{ kind: "manager" }}
        emptyLabel="No manager accounts yet."
      />

      <InviteManagerDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        orgOptions={orgs.map((o) => ({ id: o.id, name: o.name }))}
        onConfirm={async (input) => {
          await inviteManager(input);
          toast.success("Invitation sent.");
          setReloadToken((t) => t + 1);
        }}
      />
    </div>
  );
}
