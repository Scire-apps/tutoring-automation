"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Clock, Plus } from "lucide-react";

import type { ManageLedgerEntry } from "@/services/api/manage";
import { getMemberHours, adjustMemberHours } from "@/services/api/manage";
import { ApiError } from "@/services/api";
import { HoursAdjustmentDialog } from "@/components/manager/hours-adjustment-dialog";
import { formatHours, formatHoursTotal } from "@/lib/manager-format";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * Member detail → Hours tab (§5.5): the member's volunteer-hours ledger (append-
 * only: date, ±hours, kind chip award|adjustment, session link, awarded-by, note)
 * with the running total and an "Add adjustment" dialog (signed nonzero hours,
 * required reason; negative = correction). Awards come only from the verify
 * trigger — never inserted here.
 */
export function MemberHoursTab({
  memberId,
  memberName,
  totalHours,
  onChanged,
}: {
  memberId: string;
  memberName: string;
  totalHours: number;
  onChanged: () => Promise<void>;
}) {
  const [entries, setEntries] = useState<ManageLedgerEntry[]>([]);
  const [total, setTotal] = useState(totalHours);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getMemberHours(memberId);
      setEntries(res.items);
      setTotal(res.total_hours);
    } catch (e) {
      setError(e instanceof ApiError ? e.message || "Couldn't load hours." : "Couldn't load hours.");
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async (post-await) data fetch
    void load();
  }, [load]);

  const afterMutation = useCallback(async () => {
    await Promise.all([load(), onChanged()]);
  }, [load, onChanged]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-lg bg-brand-subtle text-brand">
            <Clock className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="font-display text-2xl font-semibold tracking-tight tabular-nums text-foreground">{formatHoursTotal(total)}</p>
            <p className="text-sm text-muted-foreground">Total volunteer hours</p>
          </div>
        </div>
        <Button size="sm" onClick={() => setAdjustOpen(true)}>
          <Plus className="size-4" aria-hidden="true" />
          Add adjustment
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading && entries.length === 0 ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg border bg-muted/40" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <Card className="py-8 text-center">
          <CardContent>
            <p className="text-sm text-muted-foreground">No ledger entries yet.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Kind</th>
                    <th className="px-4 py-2.5 text-right">Hours</th>
                    <th className="px-4 py-2.5">Note</th>
                    <th className="px-4 py-2.5">By</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {entries.map((e) => (
                    <tr key={e.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {new Date(e.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <KindChip kind={e.kind} />
                      </td>
                      <td
                        className={cn(
                          "px-4 py-3 text-right font-medium tabular-nums",
                          e.hours < 0 ? "text-red-700" : "text-green-700",
                        )}
                      >
                        {e.hours >= 0 ? "+" : ""}
                        {formatHours(e.hours)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {e.session_id ? (
                          <Link
                            href={`/manager/sessions/${e.session_id}`}
                            className="text-brand-strong hover:underline"
                          >
                            {e.note ?? "Session award"}
                          </Link>
                        ) : (
                          (e.note ?? "—")
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{e.awarded_by_name ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <HoursAdjustmentDialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        memberName={memberName}
        onConfirm={async ({ delta_hours, note }) => {
          await adjustMemberHours(memberId, { delta_hours, note });
          await afterMutation();
        }}
      />
    </div>
  );
}

function KindChip({ kind }: { kind: "award" | "adjustment" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        kind === "award"
          ? "bg-green-50 text-green-700 ring-green-600/20"
          : "bg-brand-subtle text-brand-strong ring-brand/20",
      )}
    >
      {kind === "award" ? "Award" : "Adjustment"}
    </span>
  );
}
