"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  UserPlus,
  Inbox,
  CalendarCheck,
  ClipboardCheck,
  Clock,
  ArrowRight,
  History,
  type LucideIcon,
} from "lucide-react";

import type { ManageOverview, ManageAttentionItem } from "@/services/api/manage";
import { getOverview } from "@/services/api/manage";
import { ApiError } from "@/services/api";
import { useManagerContext } from "@/components/manager-shell";
import { auditLine } from "@/lib/manager-format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * Manager overview (§5.4): six stat cards (counts + ledger-SUM total hours), the
 * "Needs attention" strips (each rendered only when its count > 0, with the top-5
 * rows and an inline primary action), and the last-10 human-readable audit
 * entries. All from a single `GET /api/manage/overview` aggregate.
 */
export default function ManagerOverviewPage() {
  const { profile, refreshCounts } = useManagerContext();
  const [data, setData] = useState<ManageOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const d = await getOverview();
      setData(d);
      // Keep the sidebar badges consistent with the overview snapshot.
      void refreshCounts();
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message || "Couldn't load the overview."
          : "Couldn't load the overview.",
      );
    } finally {
      setLoading(false);
    }
  }, [refreshCounts]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async (post-await) data fetch
    void load();
  }, [load]);

  const orgName = profile.org?.name ?? "your organization";

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">Overview</h1>
        <p className="text-sm text-muted-foreground">{orgName}</p>
      </header>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <StatGrid data={data} loading={loading} />

      <NeedsAttention data={data} loading={loading} />

      <RecentActivity data={data} loading={loading} />
    </div>
  );
}

/* --------------------------------------------------------------- Stat grid --- */

const STAT_META: {
  key: keyof ManageOverview["stats"];
  label: string;
  icon: LucideIcon;
  hours?: boolean;
}[] = [
  { key: "active_members", label: "Active members", icon: Users },
  { key: "pending_admissions", label: "Pending admissions", icon: UserPlus },
  { key: "open_requests", label: "Open requests", icon: Inbox },
  { key: "scheduled", label: "Scheduled", icon: CalendarCheck },
  { key: "awaiting_verification", label: "Awaiting verification", icon: ClipboardCheck },
  { key: "total_hours_awarded", label: "Hours awarded", icon: Clock, hours: true },
];

function StatGrid({ data, loading }: { data: ManageOverview | null; loading: boolean }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {STAT_META.map((s) => {
        const Icon = s.icon;
        const raw = data ? data.stats[s.key] : null;
        const value =
          raw == null ? "—" : s.hours ? formatHours(raw) : String(raw);
        return (
          <Card key={s.key} className="gap-2 py-5">
            <CardContent className="space-y-2">
              <span className="flex size-9 items-center justify-center rounded-xl bg-brand-subtle text-brand">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <p
                className={
                  loading
                    ? "font-display text-2xl font-semibold tabular-nums text-muted-foreground"
                    : "font-display text-2xl font-semibold tabular-nums text-foreground"
                }
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

function formatHours(hours: number): string {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(2);
}

/* --------------------------------------------------------- Needs attention --- */

/** A "Needs attention" group: a queue's top-5 rows with one inline primary action. */
type AttentionGroup = {
  key: keyof ManageOverview["attention"];
  title: string;
  actionLabel: string;
  href: (item: ManageAttentionItem) => string;
};

const ATTENTION_GROUPS: AttentionGroup[] = [
  {
    key: "admissions",
    title: "Pending admissions",
    actionLabel: "Review",
    href: () => "/manager/members/admissions",
  },
  {
    key: "approvals",
    title: "Approval requests",
    actionLabel: "Review",
    href: () => "/manager/approvals",
  },
  {
    key: "verification",
    title: "Awaiting verification",
    actionLabel: "Verify",
    href: (i) => `/manager/sessions/${i.id}`,
  },
  {
    key: "managers",
    title: "Pending managers",
    actionLabel: "Review",
    href: () => "/manager/managers",
  },
  {
    key: "help",
    title: "Open help requests",
    actionLabel: "Open",
    href: () => "/manager/help",
  },
];

function NeedsAttention({
  data,
  loading,
}: {
  data: ManageOverview | null;
  loading: boolean;
}) {
  if (loading && !data) {
    return (
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">Needs attention</h2>
        <div className="h-24 animate-pulse rounded-xl border bg-muted/40" />
      </section>
    );
  }
  if (!data) return null;

  const groups = ATTENTION_GROUPS.map((g) => ({ g, items: data.attention[g.key] })).filter(
    ({ items }) => items.length > 0,
  );

  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">Needs attention</h2>
      {groups.length === 0 ? (
        <Card className="py-8 text-center">
          <CardContent className="flex flex-col items-center gap-2">
            <span className="flex size-10 items-center justify-center rounded-full bg-brand-subtle text-brand">
              <ClipboardCheck className="size-5" aria-hidden="true" />
            </span>
            <p className="text-sm text-muted-foreground">
              You&apos;re all caught up. Nothing needs your attention right now.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {groups.map(({ g, items }) => (
            <Card key={g.key}>
              <CardContent className="space-y-3 py-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">{g.title}</h3>
                  <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-xs font-semibold tabular-nums text-white">
                    {items.length}
                  </span>
                </div>
                <ul className="divide-y">
                  {items.slice(0, 5).map((item) => (
                    <li key={item.id} className="flex items-center gap-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {item.title}
                        </p>
                        {item.subtitle ? (
                          <p className="truncate text-xs text-muted-foreground">
                            {item.subtitle}
                          </p>
                        ) : null}
                      </div>
                      <Button asChild size="sm" variant="outline">
                        <Link href={g.href(item)}>
                          {g.actionLabel}
                          <ArrowRight className="size-3.5" aria-hidden="true" />
                        </Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

/* --------------------------------------------------------- Recent activity --- */

function RecentActivity({
  data,
  loading,
}: {
  data: ManageOverview | null;
  loading: boolean;
}) {
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
                  <p className="text-sm text-foreground">{auditLine(entry)}</p>
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
