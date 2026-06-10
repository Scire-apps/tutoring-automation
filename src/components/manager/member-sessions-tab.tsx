"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarCheck } from "lucide-react";

import type { ManageMemberSession } from "@/services/api/manage";
import { getMemberSessions } from "@/services/api/manage";
import { ApiError } from "@/services/api";
import { SessionStatusChip } from "@/components/manager/session-status-chip";
import { subjectLabel, personName } from "@/lib/manager-format";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * Member detail → Sessions tab (§5.5): the member's sessions as BOTH requester
 * (learner) and tutor (claimer), grouped. Read-only; each row links to the
 * manager session detail for interventions.
 */
export function MemberSessionsTab({ memberId }: { memberId: string }) {
  const [sessions, setSessions] = useState<ManageMemberSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSessions(await getMemberSessions(memberId));
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message || "Couldn't load sessions." : "Couldn't load sessions.",
      );
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async (post-await) data fetch
    void load();
  }, [load]);

  if (loading && sessions.length === 0) {
    return (
      <div className="space-y-2">
        {[0, 1].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg border bg-muted/40" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Something went wrong</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const asLearner = sessions.filter((s) => s.role === "requester");
  const asTutor = sessions.filter((s) => s.role === "tutor");

  if (sessions.length === 0) {
    return (
      <Card className="py-8 text-center">
        <CardContent className="flex flex-col items-center gap-2">
          <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <CalendarCheck className="size-5" aria-hidden="true" />
          </span>
          <p className="text-sm text-muted-foreground">No sessions yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <SessionGroup title="As learner" sessions={asLearner} counterpartLabel="Tutor" />
      <SessionGroup title="As tutor" sessions={asTutor} counterpartLabel="Learner" />
    </div>
  );
}

function SessionGroup({
  title,
  sessions,
  counterpartLabel,
}: {
  title: string;
  sessions: ManageMemberSession[];
  counterpartLabel: string;
}) {
  if (sessions.length === 0) return null;
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <ul className="space-y-2">
        {sessions.map((s) => (
          <li key={s.id}>
            <Link
              href={`/manager/sessions/${s.id}`}
              className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-4 py-3 transition-colors hover:border-blue-300"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{subjectLabel(s)}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {counterpartLabel}: {personName(s.counterpart, "—")}
                  {s.scheduled_at ? ` · ${new Date(s.scheduled_at).toLocaleString()}` : ""}
                </p>
              </div>
              <SessionStatusChip status={s.status} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
