"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, ScrollText } from "lucide-react";

import {
  listAudit,
  listOrgs,
  type AdminAuditEntry,
  type AdminOrg,
  type AuditFilters,
} from "@/services/api/admin";
import { adminAuditLine } from "@/lib/admin-format";
import { formatDateTime } from "@/components/manager/ui";
import { Pagination } from "@/components/manager/pagination";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PAGE_SIZE = 25;

/**
 * Audit log (§6.3) — the filterable platform viewer. Filters: org, actor (id),
 * action (substring), target type, and a from/to date range. Each row shows a
 * human-readable line and expands to the raw metadata JSON. Cross-org by design
 * (admins see every audit row, including org_id-null platform events).
 */
export default function AdminAuditPage() {
  const [orgs, setOrgs] = useState<AdminOrg[]>([]);

  // Filter inputs (action/actor are debounced into the applied filters).
  const [orgId, setOrgId] = useState("");
  const [actionInput, setActionInput] = useState("");
  const [actorInput, setActorInput] = useState("");
  const [targetType, setTargetType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [applied, setApplied] = useState<AuditFilters>({});
  const [offset, setOffset] = useState(0);

  const [data, setData] = useState<{ items: AdminAuditEntry[]; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  // Load orgs once for the org filter.
  const loadOrgs = useCallback(async () => {
    try {
      const res = await listOrgs({ status: "all", limit: 100 });
      setOrgs(res.items);
    } catch {
      // Best-effort.
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async (post-await) data fetch
    void loadOrgs();
  }, [loadOrgs]);

  // Debounce the free-text + select filters into `applied`.
  useEffect(() => {
    const id = setTimeout(() => {
      setApplied({
        org_id: orgId || undefined,
        action: actionInput.trim() || undefined,
        actor_id: actorInput.trim() || undefined,
        target_type: targetType || undefined,
        from: from || undefined,
        to: to || undefined,
      });
      setOffset(0);
    }, 300);
    return () => clearTimeout(id);
  }, [orgId, actionInput, actorInput, targetType, from, to]);

  const appliedKey = JSON.stringify(applied);

  // Stale-while-revalidate: the spinner only shows on first paint.
  useEffect(() => {
    let ignore = false;
    listAudit({ ...applied, limit: PAGE_SIZE, offset })
      .then((res) => {
        if (ignore) return;
        setData({ items: res.items, total: res.total });
        setError(null);
      })
      .catch((e: unknown) => {
        if (ignore) return;
        setError(e instanceof Error ? e.message || "Couldn't load the audit log." : "Couldn't load the audit log.");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedKey, offset]);

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ScrollText className="size-6 text-blue-600" aria-hidden="true" />
          Audit log
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every recorded action across the platform. Filter and expand a row for its metadata.
        </p>
      </header>

      {/* Filters */}
      <Card>
        <CardContent className="grid gap-3 py-5 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="audit-org" className="text-xs text-muted-foreground">
              Organization
            </Label>
            <Select value={orgId || "all"} onValueChange={(v) => setOrgId(v === "all" ? "" : v)}>
              <SelectTrigger id="audit-org" className="w-full">
                <SelectValue placeholder="All organizations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All organizations</SelectItem>
                {orgs.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="audit-action" className="text-xs text-muted-foreground">
              Action
            </Label>
            <Input
              id="audit-action"
              placeholder="e.g. session.verified"
              value={actionInput}
              onChange={(e) => setActionInput(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="audit-target" className="text-xs text-muted-foreground">
              Target type
            </Label>
            <Select
              value={targetType || "all"}
              onValueChange={(v) => setTargetType(v === "all" ? "" : v)}
            >
              <SelectTrigger id="audit-target" className="w-full">
                <SelectValue placeholder="Any target" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any target</SelectItem>
                <SelectItem value="organizations">Organizations</SelectItem>
                <SelectItem value="profiles">Profiles</SelectItem>
                <SelectItem value="sessions">Sessions</SelectItem>
                <SelectItem value="subject_approvals">Subject approvals</SelectItem>
                <SelectItem value="org_subjects">Org subjects</SelectItem>
                <SelectItem value="subject_templates">Templates</SelectItem>
                <SelectItem value="volunteer_hours_ledger">Hours ledger</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="audit-actor" className="text-xs text-muted-foreground">
              Actor ID
            </Label>
            <Input
              id="audit-actor"
              placeholder="profile UUID"
              value={actorInput}
              onChange={(e) => setActorInput(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="audit-from" className="text-xs text-muted-foreground">
              From
            </Label>
            <Input
              id="audit-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="audit-to" className="text-xs text-muted-foreground">
              To
            </Label>
            <Input id="audit-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {loading && !data ? (
        <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading audit log…
        </div>
      ) : error && !data ? (
        <p className="py-12 text-sm text-destructive">{error}</p>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No audit entries match these filters.
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y">
            {rows.map((entry) => (
              <AuditRow
                key={entry.id}
                entry={entry}
                expanded={expanded === entry.id}
                onToggle={() => setExpanded(expanded === entry.id ? null : entry.id)}
              />
            ))}
          </ul>
        </Card>
      )}

      <Pagination total={total} limit={PAGE_SIZE} offset={offset} onOffsetChange={setOffset} />
    </div>
  );
}

function AuditRow({
  entry,
  expanded,
  onToggle,
}: {
  entry: AdminAuditEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasMeta = entry.metadata && Object.keys(entry.metadata).length > 0;
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50"
      >
        {expanded ? (
          <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        ) : (
          <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm text-foreground">{adminAuditLine(entry)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            <span className="font-mono">{entry.action}</span>
            {entry.org_name ? ` · ${entry.org_name}` : ""}
            {" · "}
            {formatDateTime(entry.created_at)}
          </p>
        </div>
      </button>
      {expanded ? (
        <div className="border-t bg-muted/20 px-4 py-3 pl-11">
          <dl className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
            <Meta label="Actor" value={entry.actor_name ?? "System / cron"} />
            <Meta label="Actor kind" value={entry.actor_kind ?? "—"} />
            <Meta label="Target table" value={entry.target_table ?? "—"} />
            <Meta label="Target id" value={entry.target_id ?? "—"} mono />
          </dl>
          {hasMeta ? (
            <pre className="mt-3 overflow-x-auto rounded-md bg-background p-3 text-xs text-foreground ring-1 ring-inset ring-border">
              {JSON.stringify(entry.metadata, null, 2)}
            </pre>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">No metadata recorded.</p>
          )}
        </div>
      ) : null}
    </li>
  );
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-2">
      <dt className="text-muted-foreground">{label}:</dt>
      <dd className={mono ? "truncate font-mono text-foreground" : "text-foreground"}>{value}</dd>
    </div>
  );
}
