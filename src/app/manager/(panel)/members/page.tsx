"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Search, UserPlus, Users } from "lucide-react";

import type { AccountStatus } from "@/types/api";
import type { ManageMemberRow, ManageMemberStatusFilter } from "@/services/api/manage";
import { listMembers, suspendMember, restoreMember } from "@/services/api/manage";
import { ApiError } from "@/services/api";
import { useManagerContext } from "@/components/manager-shell";
import { AccountStatusChip } from "@/components/manager/account-status-chip";
import {
  SuspendDialog,
  RestoreDialog,
} from "@/components/manager/member-action-dialogs";
import { formatHoursTotal, personName } from "@/lib/manager-format";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const PAGE_SIZE = 25;

const STATUS_OPTIONS: { value: ManageMemberStatusFilter; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
  { value: "suspended", label: "Suspended" },
  { value: "rejected", label: "Rejected (recovery)" },
  { value: "all", label: "All statuses" },
];

/**
 * Members directory (§5.5): name, email, grade, pronouns, status chip,
 * approved-subjects count, ledger-SUM hours total, joined date. Filters by status
 * (default ACTIVE; "rejected" is the recovery view) + server-side `q` search.
 * Inline suspend/restore (the deeper Suspend dialog with the open-requests +
 * active-sessions cascade lives here too — the row carries those counts).
 */
export default function ManagerMembersPage() {
  const { counts, refreshCounts } = useManagerContext();
  const [status, setStatus] = useState<ManageMemberStatusFilter>("active");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [offset, setOffset] = useState(0);

  const [rows, setRows] = useState<ManageMemberRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Row whose suspend/restore dialog is open.
  const [suspendTarget, setSuspendTarget] = useState<ManageMemberRow | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<ManageMemberRow | null>(null);

  // Debounce the search box (300ms) and reset paging on a new query/filter.
  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedQ(q.trim());
      setOffset(0);
    }, 300);
    return () => clearTimeout(id);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listMembers({ status, q: debouncedQ || undefined, limit: PAGE_SIZE, offset });
      setRows(res.items);
      setTotal(res.total);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message || "Couldn't load members." : "Couldn't load members.",
      );
    } finally {
      setLoading(false);
    }
  }, [status, debouncedQ, offset]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async (post-await) data fetch
    void load();
  }, [load]);

  const afterMutation = useCallback(async () => {
    await Promise.all([load(), refreshCounts()]);
  }, [load, refreshCounts]);

  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + PAGE_SIZE, total);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-subtle text-brand">
            <Users className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">Members</h1>
            <p className="text-sm text-muted-foreground">
              Everyone in your organization.
            </p>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link href="/manager/members/admissions">
            <UserPlus className="size-4" aria-hidden="true" />
            Admissions
            {counts.pending_admissions > 0 ? (
              <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-xs font-semibold text-white">
                {counts.pending_admissions}
              </span>
            ) : null}
          </Link>
        </Button>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-56">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or email…"
            className="pl-9"
            aria-label="Search members"
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as ManageMemberStatusFilter);
            setOffset(0);
          }}
        >
          <SelectTrigger className="w-52" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {/* Table */}
      <Card className="overflow-hidden py-0">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5">Member</th>
                  <th className="px-4 py-2.5">Grade</th>
                  <th className="px-4 py-2.5">Pronouns</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Subjects</th>
                  <th className="px-4 py-2.5 text-right">Hours</th>
                  <th className="px-4 py-2.5">Joined</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading && rows.length === 0 ? (
                  <SkeletonRows />
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12">
                      <EmptyState />
                    </td>
                  </tr>
                ) : (
                  rows.map((m) => (
                    <MemberTableRow
                      key={m.id}
                      member={m}
                      onSuspend={() => setSuspendTarget(m)}
                      onRestore={() => setRestoreTarget(m)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {total > 0 ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {pageStart}–{pageEnd} of {total}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0 || loading}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pageEnd >= total || loading}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      {/* Inline suspend / restore dialogs */}
      {suspendTarget ? (
        <SuspendDialog
          open={suspendTarget !== null}
          onOpenChange={(open) => {
            if (!open) setSuspendTarget(null);
          }}
          memberName={personName(suspendTarget)}
          openRequests={suspendTarget.open_requests_count}
          activeSessions={suspendTarget.active_sessions_count}
          onConfirm={async ({ note, cancelActive }) => {
            await suspendMember(suspendTarget.id, { note, cancel_active: cancelActive });
            setSuspendTarget(null);
            await afterMutation();
          }}
        />
      ) : null}

      {restoreTarget ? (
        <RestoreDialog
          open={restoreTarget !== null}
          onOpenChange={(open) => {
            if (!open) setRestoreTarget(null);
          }}
          memberName={personName(restoreTarget)}
          onConfirm={async () => {
            await restoreMember(restoreTarget.id);
            setRestoreTarget(null);
            await afterMutation();
          }}
        />
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------------- Table row --- */

function MemberTableRow({
  member,
  onSuspend,
  onRestore,
}: {
  member: ManageMemberRow;
  onSuspend: () => void;
  onRestore: () => void;
}) {
  return (
    <tr className="hover:bg-muted/30">
      <td className="px-4 py-3">
        <Link
          href={`/manager/members/${member.id}`}
          className="font-medium text-foreground hover:text-brand-strong hover:underline"
        >
          {personName(member)}
        </Link>
        <p className="truncate text-xs text-muted-foreground">{member.email}</p>
      </td>
      <td className="px-4 py-3 text-muted-foreground">{member.grade ?? "—"}</td>
      <td className="px-4 py-3 text-muted-foreground">{member.pronouns ?? "—"}</td>
      <td className="px-4 py-3">
        <AccountStatusChip status={member.status} />
      </td>
      <td className="px-4 py-3 text-right tabular-nums">{member.approved_subjects_count}</td>
      <td className="px-4 py-3 text-right tabular-nums">
        {formatHoursTotal(member.total_hours)}
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {new Date(member.created_at).toLocaleDateString()}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          <RowAction status={member.status} onSuspend={onSuspend} onRestore={onRestore} />
          <Button asChild variant="ghost" size="sm">
            <Link href={`/manager/members/${member.id}`}>View</Link>
          </Button>
        </div>
      </td>
    </tr>
  );
}

/** The inline suspend/restore control, shown only for state-legal transitions. */
function RowAction({
  status,
  onSuspend,
  onRestore,
}: {
  status: AccountStatus;
  onSuspend: () => void;
  onRestore: () => void;
}) {
  if (status === "active") {
    return (
      <Button variant="outline" size="sm" onClick={onSuspend}>
        Suspend
      </Button>
    );
  }
  if (status === "suspended" || status === "rejected") {
    return (
      <Button variant="outline" size="sm" onClick={onRestore}>
        Restore
      </Button>
    );
  }
  // pending → admissions queue handles admit/reject
  return null;
}

/* --------------------------------------------------------------- Primitives --- */

function SkeletonRows() {
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <tr key={i}>
          <td colSpan={8} className="px-4 py-3">
            <div className="h-6 animate-pulse rounded bg-muted/50" />
          </td>
        </tr>
      ))}
    </>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Users className="size-5" aria-hidden="true" />
      </span>
      <p className="text-sm text-muted-foreground">No members match these filters.</p>
    </div>
  );
}
