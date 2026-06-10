"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, UserCheck, UserPlus } from "lucide-react";

import type { ManageMemberRow } from "@/services/api/manage";
import { listMembers, admitMember, rejectMember } from "@/services/api/manage";
import { ApiError } from "@/services/api";
import { useManagerContext } from "@/components/manager-shell";
import { AdmitDialog, RejectDialog } from "@/components/manager/member-action-dialogs";
import { personName } from "@/lib/manager-format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const PAGE_SIZE = 25;

/**
 * Admissions queue (§5.5): pending members OLDEST-FIRST → Admit | Reject dialogs.
 * Rejected rows persist (re-admit from rejected is legal, surfaced in the
 * directory's recovery view). Both decisions email the member; the member side
 * flips on its next `/api/auth/me` poll.
 */
export default function ManagerAdmissionsPage() {
  const { refreshCounts } = useManagerContext();
  const [rows, setRows] = useState<ManageMemberRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [admitTarget, setAdmitTarget] = useState<ManageMemberRow | null>(null);
  const [rejectTarget, setRejectTarget] = useState<ManageMemberRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Oldest-first: the API admits an `order` hint for the admissions queue.
      const res = await listMembers({
        status: "pending",
        order: "oldest",
        limit: PAGE_SIZE,
        offset,
      });
      setRows(res.items);
      setTotal(res.total);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message || "Couldn't load admissions." : "Couldn't load admissions.",
      );
    } finally {
      setLoading(false);
    }
  }, [offset]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async (post-await) data fetch
    void load();
  }, [load]);

  const afterMutation = useCallback(async () => {
    await Promise.all([load(), refreshCounts()]);
  }, [load, refreshCounts]);

  const pageEnd = Math.min(offset + PAGE_SIZE, total);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit text-muted-foreground">
          <Link href="/manager/members">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Members
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Admissions</h1>
          <p className="text-sm text-muted-foreground">
            Members awaiting admission, oldest first.
          </p>
        </div>
      </header>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading && rows.length === 0 ? (
        <SkeletonList />
      ) : rows.length === 0 ? (
        <Card className="py-12 text-center">
          <CardContent className="flex flex-col items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-full bg-green-50 text-green-600">
              <UserCheck className="size-6" aria-hidden="true" />
            </span>
            <p className="text-sm text-muted-foreground">
              No one is waiting for admission right now.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {rows.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-4 py-3"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                <UserPlus className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/manager/members/${m.id}`}
                  className="font-medium text-foreground hover:text-blue-700 hover:underline"
                >
                  {personName(m)}
                </Link>
                <p className="truncate text-sm text-muted-foreground">
                  {m.email}
                  {m.grade != null ? ` · Grade ${m.grade}` : ""}
                </p>
              </div>
              <span className="text-xs text-muted-foreground">
                Requested {new Date(m.created_at).toLocaleDateString()}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setRejectTarget(m)}>
                  Reject
                </Button>
                <Button size="sm" onClick={() => setAdmitTarget(m)}>
                  Admit
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {total > PAGE_SIZE ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {total === 0 ? 0 : offset + 1}–{pageEnd} of {total}
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

      {admitTarget ? (
        <AdmitDialog
          open={admitTarget !== null}
          onOpenChange={(open) => {
            if (!open) setAdmitTarget(null);
          }}
          memberName={personName(admitTarget)}
          onConfirm={async (note) => {
            await admitMember(admitTarget.id, { note: note || undefined });
            setAdmitTarget(null);
            await afterMutation();
          }}
        />
      ) : null}

      {rejectTarget ? (
        <RejectDialog
          open={rejectTarget !== null}
          onOpenChange={(open) => {
            if (!open) setRejectTarget(null);
          }}
          memberName={personName(rejectTarget)}
          onConfirm={async (note) => {
            await rejectMember(rejectTarget.id, { note: note || undefined });
            setRejectTarget(null);
            await afterMutation();
          }}
        />
      ) : null}
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-lg border bg-muted/40" />
      ))}
    </div>
  );
}
