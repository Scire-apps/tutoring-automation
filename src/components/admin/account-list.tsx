"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import type { AccountStatus } from "@/types/api";
import {
  admitAccount,
  approveAccount,
  rejectAccount,
  restoreAccount,
  suspendAccount,
  deleteAccount,
  listAccounts,
  personName,
  type AdminAccount,
  type ListAccountsParams,
} from "@/services/api/admin";
import { AccountStatusChip } from "@/components/manager/account-status-chip";
import { AccountActionDialog } from "@/components/admin/account-dialogs";
import { Pagination } from "@/components/manager/pagination";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PAGE_SIZE = 25;

type DialogState =
  | { kind: "admit" | "approve" | "reject" | "suspend" | "restore" | "delete"; account: AdminAccount }
  | null;

/**
 * A reusable paginated accounts list with per-row admin actions. Powers BOTH the
 * global Members/Managers pages and the org-detail Members/Managers tabs (the
 * caller fixes `org_id` and `kind` via `baseParams`). Search is debounced; a
 * status filter is shown unless the caller pins one. Mutations refetch + toast.
 *
 * Actions are state-legal per account: pending member → Admit/Reject/Delete;
 * pending manager → Approve/Reject/Delete; active → Suspend; suspended/rejected →
 * Restore (+ Delete while rejected). Admins are read-only (no actions rendered).
 */
export function AccountList({
  baseParams,
  /** When set, the status filter is hidden and pinned to this value. */
  pinnedStatus,
  /** Extra controls rendered on the toolbar row (e.g. an org filter, Invite button). */
  toolbarExtra,
  /** Empty-state copy when there are no rows and no active search. */
  emptyLabel = "No accounts yet.",
}: {
  baseParams: ListAccountsParams;
  pinnedStatus?: AccountStatus;
  toolbarExtra?: React.ReactNode;
  emptyLabel?: string;
}) {
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<AccountStatus | "all">(pinnedStatus ?? "all");
  const [offset, setOffset] = useState(0);
  const [reloadToken, setReloadToken] = useState(0);

  const [data, setData] = useState<{ items: AdminAccount[]; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);

  // Debounce the search box.
  useEffect(() => {
    const id = setTimeout(() => {
      setQ(qInput.trim());
      setOffset(0);
    }, 300);
    return () => clearTimeout(id);
  }, [qInput]);

  // Stable key for the baseParams object so the load effect doesn't refire on
  // every render from a fresh object identity.
  const baseKey = JSON.stringify(baseParams);
  const effectiveStatus = pinnedStatus ?? status;

  // Fetch on every filter/page change. Loading starts true; refetches keep the
  // previous rows visible (stale-while-revalidate) — the spinner only shows on
  // first paint (`loading && !data`), so no synchronous setLoading(true) is
  // needed (which the set-state-in-effect rule rightly forbids).
  useEffect(() => {
    let ignore = false;
    listAccounts({
      ...baseParams,
      status: effectiveStatus === "all" ? undefined : effectiveStatus,
      q: q || undefined,
      limit: PAGE_SIZE,
      offset,
    })
      .then((res) => {
        if (ignore) return;
        setData({ items: res.items, total: res.total });
        setError(null);
      })
      .catch((e: unknown) => {
        if (ignore) return;
        setError(e instanceof Error ? e.message || "Couldn't load accounts." : "Couldn't load accounts.");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseKey, effectiveStatus, q, offset, reloadToken]);

  const reload = () => setReloadToken((t) => t + 1);

  const accounts = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            className="pl-8"
            placeholder="Search by name or email"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
          />
        </div>

        {!pinnedStatus ? (
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v as AccountStatus | "all");
              setOffset(0);
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Any status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        ) : null}

        {toolbarExtra}
      </div>

      {loading && !data ? (
        <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading accounts…
        </div>
      ) : error && !data ? (
        <p className="py-12 text-sm text-destructive">{error}</p>
      ) : accounts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {q ? "No accounts match your search." : emptyLabel}
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y">
            {accounts.map((a) => (
              <AccountRow
                key={a.id}
                account={a}
                showOrg={!baseParams.org_id}
                onAction={(kind) => setDialog({ kind, account: a })}
              />
            ))}
          </ul>
        </Card>
      )}

      <Pagination total={total} limit={PAGE_SIZE} offset={offset} onOffsetChange={setOffset} />

      <ActionDialogs dialog={dialog} onClose={() => setDialog(null)} onDone={reload} />
    </div>
  );
}

/* ----------------------------------------------------------------- Row --- */

type RowAction = "admit" | "approve" | "reject" | "suspend" | "restore" | "delete";

function AccountRow({
  account,
  showOrg,
  onAction,
}: {
  account: AdminAccount;
  showOrg: boolean;
  onAction: (kind: RowAction) => void;
}) {
  const isManager = account.kind === "manager";
  const isAdmin = account.kind === "admin";

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <Link href={`/admin/members/${account.id}`} className="min-w-0 flex-1 group">
        <p className="flex items-center gap-2 font-medium text-foreground group-hover:underline">
          <span className="truncate">{personName(account)}</span>
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {account.email}
          {showOrg && account.org ? <> · {account.org.name}</> : null}
          {account.kind === "member" && account.total_hours > 0 ? (
            <> · {account.total_hours}h</>
          ) : null}
        </p>
      </Link>

      <AccountStatusChip status={account.status} />

      {!isAdmin ? (
        <div className="flex shrink-0 items-center gap-1.5">
          {account.status === "pending" ? (
            <>
              {isManager ? (
                <Button size="sm" onClick={() => onAction("approve")}>
                  Approve
                </Button>
              ) : (
                <Button size="sm" onClick={() => onAction("admit")}>
                  Admit
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => onAction("reject")}>
                Reject
              </Button>
            </>
          ) : null}
          {account.status === "active" ? (
            <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => onAction("suspend")}>
              Suspend
            </Button>
          ) : null}
          {account.status === "suspended" || account.status === "rejected" ? (
            <Button size="sm" variant="outline" onClick={() => onAction("restore")}>
              Restore
            </Button>
          ) : null}
          {account.status === "pending" || account.status === "rejected" ? (
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => onAction("delete")}
            >
              Delete
            </Button>
          ) : null}
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">Read-only</span>
      )}

      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </li>
  );
}

/* -------------------------------------------------------------- Dialogs --- */

function ActionDialogs({
  dialog,
  onClose,
  onDone,
}: {
  dialog: DialogState;
  onClose: () => void;
  onDone: () => void;
}) {
  const account = dialog?.account ?? null;
  const name = account ? personName(account) : "this account";
  const kindWord = account?.kind === "manager" ? "manager" : "member";

  async function run(fn: () => Promise<unknown>, success: string) {
    await fn();
    toast.success(success);
    onDone();
  }

  return (
    <>
      <AccountActionDialog
        open={dialog?.kind === "admit"}
        onOpenChange={(o) => (!o ? onClose() : undefined)}
        title={`Admit ${name}?`}
        description="They gain full member access: requesting and giving tutoring for approved subjects."
        confirmLabel="Admit member"
        onConfirm={async () => {
          if (!account) return;
          await run(() => admitAccount(account.id), `${name} admitted.`);
        }}
      />

      <AccountActionDialog
        open={dialog?.kind === "approve"}
        onOpenChange={(o) => (!o ? onClose() : undefined)}
        title={`Activate ${name}?`}
        description="They gain full manager access to their organization and are emailed."
        confirmLabel="Activate manager"
        onConfirm={async () => {
          if (!account) return;
          await run(() => approveAccount(account.id), `${name} activated.`);
        }}
      />

      <AccountActionDialog
        open={dialog?.kind === "reject"}
        onOpenChange={(o) => (!o ? onClose() : undefined)}
        title={`Reject ${name}?`}
        description={`They keep their account but stay inactive. The note is shown to the ${kindWord}.`}
        confirmLabel={`Reject ${kindWord}`}
        destructive
        showNote
        onConfirm={async (note) => {
          if (!account) return;
          await run(() => rejectAccount(account.id, { note: note || undefined }), `${name} rejected.`);
        }}
      />

      <AccountActionDialog
        open={dialog?.kind === "suspend"}
        onOpenChange={(o) => (!o ? onClose() : undefined)}
        title={`Suspend ${name}?`}
        description={`They lose access until restored. Their account and history are kept. The note is shown to the ${kindWord}.`}
        confirmLabel={`Suspend ${kindWord}`}
        destructive
        showNote
        onConfirm={async (note) => {
          if (!account) return;
          await run(() => suspendAccount(account.id, { note: note || undefined }), `${name} suspended.`);
        }}
      />

      <AccountActionDialog
        open={dialog?.kind === "restore"}
        onOpenChange={(o) => (!o ? onClose() : undefined)}
        title={`Restore ${name}?`}
        description="Their access is reinstated immediately."
        confirmLabel={`Restore ${kindWord}`}
        onConfirm={async () => {
          if (!account) return;
          await run(() => restoreAccount(account.id), `${name} restored.`);
        }}
      />

      <AccountActionDialog
        open={dialog?.kind === "delete"}
        onOpenChange={(o) => (!o ? onClose() : undefined)}
        title={`Delete ${name}?`}
        description="This permanently deletes the account and frees their email for re-invite. Only pending or rejected accounts can be deleted."
        confirmLabel="Delete account"
        destructive
        onConfirm={async () => {
          if (!account) return;
          await run(() => deleteAccount(account.id), `${name} deleted.`);
        }}
      />
    </>
  );
}
