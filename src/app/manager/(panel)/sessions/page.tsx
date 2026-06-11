"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarRange, ChevronRight, Loader2, Search } from "lucide-react";

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
import type { SessionStatus } from "@/types/api";
import {
  listSessions,
  listSubjects,
  listMembers,
  memberName,
  subjectLabel,
  type ManageSession,
  type ManageSubject,
  type ManageMember,
} from "@/services/api/manage";
import {
  PriorityBadge,
  SessionStatusBadge,
  formatAge,
  sessionStatusLabel,
} from "@/components/manager/ui";
import { Pagination } from "@/components/manager/pagination";
import { useList } from "@/components/manager/use-list";

const PAGE_SIZE = 25;

/** The default "active" multi-filter set (§5.8) — everything but the terminal states. */
const ACTIVE_STATUSES: SessionStatus[] = [
  "open",
  "claimed",
  "availability_set",
  "scheduled",
  "completed",
  "needs_changes",
];

const ALL_STATUSES: SessionStatus[] = [
  "open",
  "claimed",
  "availability_set",
  "scheduled",
  "completed",
  "needs_changes",
  "verified",
  "cancelled",
];

export default function ManagerSessionsPage() {
  // Filter options (loaded once).
  const [subjects, setSubjects] = useState<ManageSubject[]>([]);
  const [members, setMembers] = useState<ManageMember[]>([]);

  // Filter state.
  const [statuses, setStatuses] = useState<SessionStatus[]>(ACTIVE_STATUSES);
  const [subjectId, setSubjectId] = useState<string>("");
  const [memberId, setMemberId] = useState<string>("");
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);

  // Debounce the search box into `q`.
  useEffect(() => {
    const id = setTimeout(() => {
      setQ(qInput.trim());
      setOffset(0);
    }, 300);
    return () => clearTimeout(id);
  }, [qInput]);

  // Load the filter option lists once.
  useEffect(() => {
    let ignore = false;
    Promise.all([listSubjects({}), listMembers({ limit: 100 })])
      .then(([subs, mem]) => {
        if (ignore) return;
        setSubjects(subs.items);
        setMembers(mem.items);
      })
      .catch(() => {
        // Filter options are best-effort; the table still loads.
      });
    return () => {
      ignore = true;
    };
  }, []);

  // `statusKey` is a stable string proxy for the `statuses` array so the load
  // hook doesn't re-fire on every render from a fresh array identity.
  const statusKey = statuses.join(",");

  const { data, loading, error } = useList(
    () =>
      listSessions({
        status: statuses,
        subjectId: subjectId || undefined,
        memberId: memberId || undefined,
        q: q || undefined,
        limit: PAGE_SIZE,
        offset,
      }),
    [statusKey, subjectId, memberId, q, offset],
    "Could not load sessions.",
  );
  const sessions = data?.items ?? [];
  const total = data?.total ?? 0;

  function toggleStatus(s: SessionStatus) {
    setOffset(0);
    setStatuses((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  }

  function resetStatuses() {
    setOffset(0);
    setStatuses(ACTIVE_STATUSES);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight">
          <CalendarRange className="size-6 text-brand" aria-hidden="true" />
          Sessions
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every tutoring session in your organization. Open the record to verify, reopen, or
          cancel.
        </p>
      </header>

      {/* --- Filters --- */}
      <Card>
        <CardContent className="space-y-4">
          {/* Status multi-filter */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <button
                type="button"
                onClick={resetStatuses}
                className="text-xs font-medium text-brand hover:underline"
              >
                Active only
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ALL_STATUSES.map((s) => {
                const on = statuses.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleStatus(s)}
                    className={
                      on
                        ? "rounded-full bg-brand px-3 py-1 text-xs font-medium text-white"
                        : "rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-accent"
                    }
                  >
                    {sessionStatusLabel(s)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subject / member / search */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="filter-subject" className="text-xs text-muted-foreground">
                Subject
              </Label>
              <Select
                value={subjectId || "all"}
                onValueChange={(v) => {
                  setSubjectId(v === "all" ? "" : v);
                  setOffset(0);
                }}
              >
                <SelectTrigger id="filter-subject" className="w-full">
                  <SelectValue placeholder="All subjects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All subjects</SelectItem>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {subjectLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="filter-member" className="text-xs text-muted-foreground">
                Member
              </Label>
              <Select
                value={memberId || "all"}
                onValueChange={(v) => {
                  setMemberId(v === "all" ? "" : v);
                  setOffset(0);
                }}
              >
                <SelectTrigger id="filter-member" className="w-full">
                  <SelectValue placeholder="All members" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All members</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {memberName(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="filter-q" className="text-xs text-muted-foreground">
                Search
              </Label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="filter-q"
                  className="pl-8"
                  placeholder="Notes or names"
                  value={qInput}
                  onChange={(e) => setQInput(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* --- Table --- */}
      <SessionsTable sessions={sessions} loading={loading} error={error} />

      <Pagination total={total} limit={PAGE_SIZE} offset={offset} onOffsetChange={setOffset} />
    </div>
  );
}

function SessionsTable({
  sessions,
  loading,
  error,
}: {
  sessions: ManageSession[];
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Loading sessions…
      </div>
    );
  }
  if (error) {
    return <p className="py-12 text-sm text-destructive">{error}</p>;
  }
  if (sessions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No sessions match these filters.
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden p-0">
      <ul className="divide-y">
        {sessions.map((s) => (
          <li key={s.id}>
            <Link
              href={`/manager/sessions/${s.id}`}
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-medium text-foreground">
                    {subjectLabel(s.subject)}
                  </span>
                  <SessionStatusBadge status={s.status} />
                  {s.priority !== "normal" ? <PriorityBadge priority={s.priority} /> : null}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {memberName(s.requester)}
                  {s.tutor ? <> {"→"} {memberName(s.tutor)}</> : <> · unclaimed</>}
                  {" · "}
                  {formatAge(s.created_at)}
                </p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
