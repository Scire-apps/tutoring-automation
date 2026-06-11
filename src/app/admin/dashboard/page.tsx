"use client";

import {
  Building2,
  Users,
  ShieldCheck,
  CalendarRange,
  ClipboardCheck,
  Clock,
  History,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import type { ServiceState } from "@/types/api";
import {
  getOverview,
  getStatus,
  type AdminOverview,
  type AdminStatus,
} from "@/services/api/admin";
import { adminAuditLine, formatHours } from "@/lib/admin-format";
import { useList } from "@/components/manager/use-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

/**
 * Admin dashboard (§6.3) — platform stat cards, service health (via
 * `GET /api/admin/status`), and the last-10 platform audit entries. Read-only
 * landing for the panel; each section fetches independently so a flaky health
 * check never blanks the stats.
 */
export default function AdminDashboardPage() {
  const { data: overview, loading, error } = useList(
    () => getOverview(),
    [],
    "Couldn't load the platform overview.",
  );
  const { data: status } = useList(() => getStatus(), [], "Couldn't load service health.");

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Scire platform overview.</p>
      </header>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <StatGrid data={overview} loading={loading} />

      <ServiceHealth status={status} />

      <RecentActivity data={overview} loading={loading} />
    </div>
  );
}

/* --------------------------------------------------------------- Stat grid --- */

const STAT_META: {
  key: keyof AdminOverview["stats"];
  label: string;
  icon: LucideIcon;
  hours?: boolean;
}[] = [
  { key: "organizations", label: "Organizations", icon: Building2 },
  { key: "active_members", label: "Active members", icon: Users },
  { key: "pending_managers", label: "Pending managers", icon: ShieldCheck },
  { key: "sessions", label: "Sessions", icon: CalendarRange },
  { key: "awaiting_verification", label: "Awaiting verification", icon: ClipboardCheck },
  { key: "hours_awarded", label: "Hours awarded", icon: Clock, hours: true },
];

function StatGrid({ data, loading }: { data: AdminOverview | null; loading: boolean }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {STAT_META.map((s) => {
        const Icon = s.icon;
        const raw = data ? data.stats[s.key] : null;
        const value = raw == null ? "—" : s.hours ? formatHours(raw) : String(raw);
        return (
          <Card key={s.key} className="gap-2 py-5">
            <CardContent className="space-y-2">
              <span className="flex size-9 items-center justify-center rounded-lg bg-brand-subtle text-brand">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <p
                className={cn(
                  "text-2xl font-semibold tabular-nums",
                  loading ? "text-muted-foreground" : "text-foreground",
                )}
              >
                {value}
              </p>
              <p className="text-sm text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------- Service health --- */

const HEALTH_META: Record<ServiceState, { icon: LucideIcon; tone: string; label: string }> = {
  ok: { icon: CheckCircle2, tone: "text-green-600", label: "Operational" },
  degraded: { icon: AlertTriangle, tone: "text-amber-600", label: "Degraded" },
  down: { icon: XCircle, tone: "text-red-600", label: "Down" },
};

function ServiceHealth({ status }: { status: AdminStatus | null }) {
  if (!status) return null;
  const overall = HEALTH_META[status.status];
  const OverallIcon = overall.icon;
  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">Service health</h2>
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2">
          <CardTitle className="font-display text-base tracking-tight">Status</CardTitle>
          <span className={cn("inline-flex items-center gap-1.5 text-sm font-medium", overall.tone)}>
            <OverallIcon className="size-4" aria-hidden="true" />
            {overall.label}
          </span>
        </CardHeader>
        <CardContent>
          {status.checks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No service checks reported.</p>
          ) : (
            <ul className="divide-y">
              {status.checks.map((c) => {
                const meta = HEALTH_META[c.status];
                const Icon = meta.icon;
                return (
                  <li key={c.name} className="flex items-center gap-3 py-2.5">
                    <Icon className={cn("size-4 shrink-0", meta.tone)} aria-hidden="true" />
                    <span className="flex-1 text-sm font-medium text-foreground">{c.name}</span>
                    {c.detail ? (
                      <span className="text-xs text-muted-foreground">{c.detail}</span>
                    ) : (
                      <span className={cn("text-xs font-medium", meta.tone)}>{meta.label}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

/* --------------------------------------------------------- Recent activity --- */

function RecentActivity({ data, loading }: { data: AdminOverview | null; loading: boolean }) {
  if (loading && !data) return null;
  if (!data || data.recent_audit.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">Recent activity</h2>
      <Card>
        <CardContent className="py-2">
          <ul className="divide-y">
            {data.recent_audit.map((entry) => (
              <li key={entry.id} className="flex items-start gap-3 py-3">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <History className="size-3.5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">{adminAuditLine(entry)}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(entry.created_at).toLocaleString()}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}
