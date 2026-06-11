"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown, LifeBuoy, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ApiError } from "@/services/api";
import { listHelp, resolveHelp, memberName } from "@/services/api/manage";
import { TabBar, UrgencyBadge, formatAge, formatDateTime } from "@/components/manager/ui";
import { Pagination } from "@/components/manager/pagination";
import { useList } from "@/components/manager/use-list";

const PAGE_SIZE = 25;

type Tab = "open" | "resolved";

export default function ManagerHelpPage() {
  const [tab, setTab] = useState<Tab>("open");
  const [reloadToken, setReloadToken] = useState(0);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight">
          <LifeBuoy className="size-6 text-brand" aria-hidden="true" />
          Help requests
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Members ask for help here. Open the message, sort out the issue, then mark it resolved.
        </p>
      </header>

      <TabBar
        tabs={[
          { value: "open", label: "Open" },
          { value: "resolved", label: "Resolved" },
        ]}
        value={tab}
        onChange={setTab}
      />

      <HelpList
        key={tab}
        status={tab}
        reloadToken={reloadToken}
        onResolved={() => setReloadToken((t) => t + 1)}
      />
    </div>
  );
}

function HelpList({
  status,
  reloadToken,
  onResolved,
}: {
  status: Tab;
  reloadToken: number;
  onResolved: () => void;
}) {
  const [offset, setOffset] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  // Ids resolved this session, hidden immediately (optimistic) until the refetch.
  const [removed, setRemoved] = useState<Set<string>>(new Set());

  const { data, loading, error } = useList(
    () => listHelp({ status, limit: PAGE_SIZE, offset }),
    [status, offset, reloadToken],
    "Could not load help requests.",
  );
  const items = (data?.items ?? []).filter((h) => !removed.has(h.id));
  const total = Math.max(0, (data?.total ?? 0) - removed.size);

  const handleResolve = async (id: string) => {
    setResolvingId(id);
    try {
      await resolveHelp(id);
      toast.success("Marked resolved.");
      // Hide it from the open list immediately, then bump the resolved tab.
      setRemoved((prev) => new Set(prev).add(id));
      onResolved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message || "Could not resolve." : "Could not resolve.");
    } finally {
      setResolvingId(null);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Loading…
      </div>
    );
  }
  if (error) return <p className="py-12 text-sm text-destructive">{error}</p>;
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          {status === "open" ? "No open help requests. Nice and quiet." : "No resolved requests yet."}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {items.map((h) => {
          const open = expanded === h.id;
          return (
            <li key={h.id}>
              <Card>
                <CardContent className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : h.id)}
                    className="flex w-full items-center gap-3 text-left"
                    aria-expanded={open}
                  >
                    <UrgencyBadge urgency={h.urgency} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {memberName(h.member)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {open ? formatDateTime(h.created_at) : h.description}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatAge(h.created_at)}</span>
                    <ChevronDown
                      className={"size-4 shrink-0 text-muted-foreground transition-transform " + (open ? "rotate-180" : "")}
                      aria-hidden="true"
                    />
                  </button>

                  {open ? (
                    <div className="space-y-3 border-t pt-3">
                      <p className="text-sm whitespace-pre-wrap text-foreground">{h.description}</p>
                      {status === "open" ? (
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            onClick={() => handleResolve(h.id)}
                            disabled={resolvingId === h.id}
                          >
                            <CheckCircle2 className="size-4" aria-hidden="true" />
                            {resolvingId === h.id ? "Resolving…" : "Resolve"}
                          </Button>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Resolved
                          {h.resolved_by_name ? ` by ${h.resolved_by_name}` : ""}
                          {h.resolved_at ? ` · ${formatDateTime(h.resolved_at)}` : ""}
                        </p>
                      )}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
      <Pagination total={total} limit={PAGE_SIZE} offset={offset} onOffsetChange={setOffset} />
    </div>
  );
}
