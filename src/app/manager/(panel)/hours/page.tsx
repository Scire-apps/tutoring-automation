"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, Download, Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  addAdjustment,
  exportHours,
  listHoursTotals,
  listLedger,
  listMembers,
  memberName,
  type ManageMember,
} from "@/services/api/manage";
import { TabBar, downloadBlob, formatDate, formatHours } from "@/components/manager/ui";
import { Pagination } from "@/components/manager/pagination";
import { AdjustmentDialog } from "@/components/manager/adjustment-dialog";
import { useList } from "@/components/manager/use-list";

const PAGE_SIZE = 25;

type Tab = "totals" | "ledger";

export default function ManagerHoursPage() {
  const [tab, setTab] = useState<Tab>("totals");
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [members, setMembers] = useState<ManageMember[]>([]);
  // Bumped after an adjustment so both tabs refetch.
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let ignore = false;
    listMembers({ limit: 100 })
      .then((env) => {
        if (!ignore) setMembers(env.items);
      })
      .catch(() => {
        // best-effort; the adjustment picker simply stays empty
      });
    return () => {
      ignore = true;
    };
  }, []);

  const handleAdjust = async (input: { member_id: string; hours: number; note: string }) => {
    await addAdjustment(input);
    toast.success("Adjustment recorded.");
    setReloadToken((t) => t + 1);
  };

  const handleExport = async (type: Tab) => {
    try {
      const blob = await exportHours(type);
      const date = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `volunteer-hours-${type}-${date}.csv`);
    } catch {
      toast.error("Could not export. Please try again.");
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Clock className="size-6 text-blue-600" aria-hidden="true" />
            Volunteer hours
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Awarded automatically when you verify sessions. Adjust manually if a correction is
            needed.
          </p>
        </div>
        <Button onClick={() => setAdjustOpen(true)}>
          <Plus className="size-4" aria-hidden="true" />
          Add adjustment
        </Button>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabBar
          tabs={[
            { value: "totals", label: "Totals" },
            { value: "ledger", label: "Ledger" },
          ]}
          value={tab}
          onChange={setTab}
        />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport("totals")}>
            <Download className="size-4" aria-hidden="true" />
            Totals CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("ledger")}>
            <Download className="size-4" aria-hidden="true" />
            Ledger CSV
          </Button>
        </div>
      </div>

      {tab === "totals" ? (
        <TotalsTab reloadToken={reloadToken} />
      ) : (
        <LedgerTab reloadToken={reloadToken} />
      )}

      <AdjustmentDialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        members={members}
        onSubmit={handleAdjust}
      />
    </div>
  );
}

// --- Totals tab --------------------------------------------------------------

function TotalsTab({ reloadToken }: { reloadToken: number }) {
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const id = setTimeout(() => {
      setQ(qInput.trim());
      setOffset(0);
    }, 300);
    return () => clearTimeout(id);
  }, [qInput]);

  const { data, loading, error } = useList(
    () => listHoursTotals({ q: q || undefined, limit: PAGE_SIZE, offset }),
    [q, offset, reloadToken],
    "Could not load totals.",
  );
  const rows = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-4">
      <SearchBox value={qInput} onChange={setQInput} placeholder="Search members" />
      {loading ? (
        <Loading />
      ) : error ? (
        <p className="py-8 text-sm text-destructive">{error}</p>
      ) : rows.length === 0 ? (
        <Empty>No members with hours yet.</Empty>
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y">
            {rows.map((r, i) => (
              <li
                key={r.member?.id ?? `row-${i}`}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <span className="truncate font-medium text-foreground">{memberName(r.member)}</span>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                  {formatHours(r.total_hours)} h
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Pagination total={total} limit={PAGE_SIZE} offset={offset} onOffsetChange={setOffset} />
    </div>
  );
}

// --- Ledger tab --------------------------------------------------------------

function LedgerTab({ reloadToken }: { reloadToken: number }) {
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const id = setTimeout(() => {
      setQ(qInput.trim());
      setOffset(0);
    }, 300);
    return () => clearTimeout(id);
  }, [qInput]);

  const { data, loading, error } = useList(
    () => listLedger({ q: q || undefined, limit: PAGE_SIZE, offset }),
    [q, offset, reloadToken],
    "Could not load the ledger.",
  );
  const rows = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-4">
      <SearchBox value={qInput} onChange={setQInput} placeholder="Search members or notes" />
      {loading ? (
        <Loading />
      ) : error ? (
        <p className="py-8 text-sm text-destructive">{error}</p>
      ) : rows.length === 0 ? (
        <Empty>No ledger entries yet.</Empty>
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y">
            {rows.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium text-foreground">{memberName(r.member)}</span>
                    <KindChip kind={r.kind} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(r.created_at)}
                    {r.awarded_by_name ? ` · by ${r.awarded_by_name}` : ""}
                    {r.session_id ? (
                      <>
                        {" · "}
                        <Link
                          href={`/manager/sessions/${r.session_id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {r.subject_name ? r.subject_name : "session"}
                        </Link>
                      </>
                    ) : null}
                  </p>
                  {r.note ? <p className="text-sm text-foreground">{r.note}</p> : null}
                </div>
                <span
                  className={
                    "shrink-0 text-sm font-semibold tabular-nums " +
                    (r.hours < 0 ? "text-red-600" : "text-foreground")
                  }
                >
                  {r.hours > 0 ? "+" : ""}
                  {formatHours(r.hours)} h
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Pagination total={total} limit={PAGE_SIZE} offset={offset} onOffsetChange={setOffset} />
    </div>
  );
}

function KindChip({ kind }: { kind: "award" | "adjustment" }) {
  return (
    <span
      className={
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset " +
        (kind === "award"
          ? "bg-green-50 text-green-700 ring-green-600/20"
          : "bg-blue-50 text-blue-700 ring-blue-600/20")
      }
    >
      {kind === "award" ? "Award" : "Adjustment"}
    </span>
  );
}

// --- Small shared bits -------------------------------------------------------

function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative max-w-sm">
      <Search
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        className="pl-8"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function Loading() {
  return (
    <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      Loading…
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="py-12 text-center text-sm text-muted-foreground">{children}</CardContent>
    </Card>
  );
}
