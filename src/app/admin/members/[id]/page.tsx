"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Mail, Building2, GraduationCap } from "lucide-react";
import { toast } from "sonner";

import {
  getAccount,
  admitAccount,
  approveAccount,
  rejectAccount,
  suspendAccount,
  restoreAccount,
  deleteAccount,
  adjustAccountHours,
  personName,
  subjectLabel,
  type AdminAccountDetail,
} from "@/services/api/admin";
import { ApiError } from "@/services/api";
import { accountKindLabel, formatSignedHours, formatHours } from "@/lib/admin-format";
import { AccountActionDialog, AdjustHoursDialog } from "@/components/admin/account-dialogs";
import { AccountStatusChip } from "@/components/manager/account-status-chip";
import { SessionStatusChip } from "@/components/manager/session-status-chip";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/manager/tabs";
import { formatDate } from "@/components/manager/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ActionKind = "admit" | "approve" | "reject" | "suspend" | "restore" | "delete" | "adjust" | null;

/**
 * Account detail (§6.4 `GET /api/admin/accounts/[id]`) — profile + approvals +
 * sessions + ledger, with the full lifecycle actions and an hours adjustment.
 * Linked from both the members and managers lists; the action set adapts to the
 * account's kind + status. (Route lives under /admin/members/[id] but serves any
 * non-admin account.)
 */
export default function AdminAccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [account, setAccount] = useState<AdminAccountDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [dialog, setDialog] = useState<ActionKind>(null);

  const load = useCallback(async () => {
    try {
      const a = await getAccount(id);
      setAccount(a);
      setError(null);
      setNotFound(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setNotFound(true);
      setError(e instanceof ApiError ? e.message || "Couldn't load this account." : "Couldn't load this account.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async (post-await) data fetch
    void load();
  }, [load]);

  if (loading && !account) {
    return (
      <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Loading account…
      </div>
    );
  }

  if (!account) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {notFound ? "This account could not be found." : (error ?? "Couldn't load this account.")}
          </CardContent>
        </Card>
      </div>
    );
  }

  const name = personName(account);
  const kindWord = account.kind === "manager" ? "manager" : "member";
  const isMember = account.kind === "member";

  async function run(fn: () => Promise<unknown>, success: string) {
    await fn();
    toast.success(success);
    await load();
  }

  return (
    <div className="space-y-6">
      <BackLink />

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight">
            {name}
            <AccountStatusChip status={account.status} />
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Mail className="size-3.5" aria-hidden="true" />
              {account.email}
            </span>
            {account.org ? (
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="size-3.5" aria-hidden="true" />
                {account.org.name}
              </span>
            ) : null}
            <span>{accountKindLabel(account.kind)}</span>
            {isMember && (account.grade != null || account.pronouns) ? (
              <span className="inline-flex items-center gap-1.5">
                <GraduationCap className="size-3.5" aria-hidden="true" />
                {account.grade != null ? `Grade ${account.grade}` : ""}
                {account.grade != null && account.pronouns ? " · " : ""}
                {account.pronouns ?? ""}
              </span>
            ) : null}
          </div>
        </div>
      </header>

      {account.status_note ? (
        <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Note to the {kindWord}:</span>{" "}
          {account.status_note}
        </div>
      ) : null}

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base tracking-tight">Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {account.status === "pending" ? (
            <>
              {isMember ? (
                <Button onClick={() => setDialog("admit")}>Admit</Button>
              ) : (
                <Button onClick={() => setDialog("approve")}>Activate</Button>
              )}
              <Button variant="outline" onClick={() => setDialog("reject")}>
                Reject
              </Button>
            </>
          ) : null}
          {account.status === "active" ? (
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setDialog("suspend")}
            >
              Suspend
            </Button>
          ) : null}
          {account.status === "suspended" || account.status === "rejected" ? (
            <Button variant="outline" onClick={() => setDialog("restore")}>
              Restore
            </Button>
          ) : null}
          {isMember ? (
            <Button variant="outline" onClick={() => setDialog("adjust")}>
              Adjust hours
            </Button>
          ) : null}
          {account.status === "pending" || account.status === "rejected" ? (
            <Button variant="ghost" className="text-muted-foreground" onClick={() => setDialog("delete")}>
              Delete account
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {/* Member detail tabs */}
      {isMember ? (
        <Tabs defaultValue="approvals">
          <TabsList>
            <TabsTrigger value="approvals">Approvals</TabsTrigger>
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
            <TabsTrigger value="hours">Hours</TabsTrigger>
          </TabsList>

          <TabsContent value="approvals" className="mt-4">
            <ApprovalsTab account={account} />
          </TabsContent>
          <TabsContent value="sessions" className="mt-4">
            <SessionsTab account={account} />
          </TabsContent>
          <TabsContent value="hours" className="mt-4">
            <HoursTab account={account} />
          </TabsContent>
        </Tabs>
      ) : null}

      {/* Dialogs */}
      <AccountActionDialog
        open={dialog === "admit"}
        onOpenChange={(o) => (!o ? setDialog(null) : undefined)}
        title={`Admit ${name}?`}
        description="They gain full member access: requesting and giving tutoring for approved subjects."
        confirmLabel="Admit member"
        onConfirm={() => run(() => admitAccount(id), `${name} admitted.`)}
      />
      <AccountActionDialog
        open={dialog === "approve"}
        onOpenChange={(o) => (!o ? setDialog(null) : undefined)}
        title={`Activate ${name}?`}
        description="They gain full manager access to their organization and are emailed."
        confirmLabel="Activate manager"
        onConfirm={() => run(() => approveAccount(id), `${name} activated.`)}
      />
      <AccountActionDialog
        open={dialog === "reject"}
        onOpenChange={(o) => (!o ? setDialog(null) : undefined)}
        title={`Reject ${name}?`}
        description={`They keep their account but stay inactive. The note is shown to the ${kindWord}.`}
        confirmLabel={`Reject ${kindWord}`}
        destructive
        showNote
        onConfirm={(note) => run(() => rejectAccount(id, { note: note || undefined }), `${name} rejected.`)}
      />
      <AccountActionDialog
        open={dialog === "suspend"}
        onOpenChange={(o) => (!o ? setDialog(null) : undefined)}
        title={`Suspend ${name}?`}
        description={`They lose access until restored. Their account and history are kept. The note is shown to the ${kindWord}.`}
        confirmLabel={`Suspend ${kindWord}`}
        destructive
        showNote
        onConfirm={(note) => run(() => suspendAccount(id, { note: note || undefined }), `${name} suspended.`)}
      />
      <AccountActionDialog
        open={dialog === "restore"}
        onOpenChange={(o) => (!o ? setDialog(null) : undefined)}
        title={`Restore ${name}?`}
        description="Their access is reinstated immediately."
        confirmLabel={`Restore ${kindWord}`}
        onConfirm={() => run(() => restoreAccount(id), `${name} restored.`)}
      />
      <AccountActionDialog
        open={dialog === "delete"}
        onOpenChange={(o) => (!o ? setDialog(null) : undefined)}
        title={`Delete ${name}?`}
        description="This permanently deletes the account and frees their email for re-invite. Only pending or rejected accounts can be deleted."
        confirmLabel="Delete account"
        destructive
        onConfirm={() => run(() => deleteAccount(id), `${name} deleted.`)}
      />
      <AdjustHoursDialog
        open={dialog === "adjust"}
        onOpenChange={(o) => (!o ? setDialog(null) : undefined)}
        personName={name}
        onConfirm={(input) => run(() => adjustAccountHours(id, input), "Adjustment added.")}
      />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/admin/members"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      Back to members
    </Link>
  );
}

/* --------------------------------------------------------------- Tabs --- */

function ApprovalsTab({ account }: { account: AdminAccountDetail }) {
  if (account.approvals.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No subject approvals yet.
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden p-0">
      <ul className="divide-y">
        {account.approvals.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground">{subjectLabel(a)}</p>
              {a.evidence ? (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{a.evidence}</p>
              ) : a.direct_grant ? (
                <p className="mt-0.5 text-xs text-muted-foreground">Granted by a manager</p>
              ) : null}
            </div>
            <span
              className={cn(
                "inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
                a.status === "approved"
                  ? "bg-green-50 text-green-700 ring-green-600/20"
                  : a.status === "pending"
                    ? "bg-amber-50 text-amber-700 ring-amber-600/20"
                    : "bg-muted text-muted-foreground ring-border",
              )}
            >
              {a.status}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function SessionsTab({ account }: { account: AdminAccountDetail }) {
  if (account.sessions.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No sessions yet.
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden p-0">
      <ul className="divide-y">
        {account.sessions.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 font-medium text-foreground">
                <span className="truncate">{subjectLabel(s)}</span>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium",
                    s.role === "tutor" ? "bg-brand-subtle text-brand-strong" : "bg-slate-100 text-slate-600",
                  )}
                >
                  {s.role === "tutor" ? "Tutoring" : "Learning"}
                </span>
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {s.counterpart ? personName(s.counterpart) : "—"} · {formatDate(s.created_at)}
              </p>
            </div>
            <SessionStatusChip status={s.status} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function HoursTab({ account }: { account: AdminAccountDetail }) {
  return (
    <div className="space-y-4">
      <Card className="gap-2 py-4">
        <CardContent className="space-y-1">
          <p className="font-display text-2xl font-semibold tabular-nums tracking-tight text-foreground">{formatHours(account.total_hours)} h</p>
          <p className="text-sm text-muted-foreground">Total volunteer hours</p>
        </CardContent>
      </Card>

      {account.ledger.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No ledger entries yet.
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y">
            {account.ledger.map((l) => (
              <li key={l.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {l.kind === "award" ? "Session award" : "Adjustment"}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {formatDate(l.created_at)}
                    {l.awarded_by_name ? ` · ${l.awarded_by_name}` : ""}
                    {l.note ? ` · ${l.note}` : ""}
                  </p>
                </div>
                <span
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    l.hours < 0 ? "text-red-600" : "text-green-600",
                  )}
                >
                  {formatSignedHours(l.hours)} h
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
