"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  TwoWeekTimeGrid,
  type AllowedDateMap,
  type DateSelection,
} from "@/components/two-week-time-grid";
import { formatDuration } from "@/components/duration-picker";
import { ApiError } from "@/services/api";
import {
  getSession,
  scheduleSession,
  type MemberSession,
} from "@/services/api/member";

/** The single contiguous block the claimer selected, or null if not exactly one. */
function singleBlock(
  selection: DateSelection,
): { date: string; start: string; end: string; minutes: number } | null {
  const dates = Object.keys(selection).filter((d) => (selection[d] ?? []).length > 0);
  if (dates.length !== 1) return null;
  const ranges = selection[dates[0]];
  if (ranges.length !== 1) return null;
  const { start, end } = ranges[0];
  return { date: dates[0], start, end, minutes: diffMinutes(start, end) };
}

function diffMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

/** Build a local-time ISO string for a YYYY-MM-DD + HH:MM block (no TZ drift). */
function toLocalIso(date: string, start: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = start.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0).toISOString();
}

export default function MemberSchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [session, setSession] = useState<MemberSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selection, setSelection] = useState<DateSelection>({});
  const [location, setLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const s = await getSession(id);
        if (!active) return;
        setSession(s);
      } catch (err) {
        if (!active) return;
        setLoadError(
          err instanceof ApiError && err.code === "not_found"
            ? "This session no longer exists."
            : "Could not load this session.",
        );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  const allowed = useMemo<AllowedDateMap>(() => {
    if (!session?.availability || typeof session.availability !== "object") return {};
    const out: AllowedDateMap = {};
    for (const [date, ranges] of Object.entries(
      session.availability as Record<string, string[]>,
    )) {
      if (!Array.isArray(ranges)) continue;
      out[date] = ranges
        .map((r) => {
          const [start, end] = String(r).split("-");
          return start && end ? { start, end } : null;
        })
        .filter((r): r is { start: string; end: string } => r !== null);
    }
    return out;
  }, [session]);

  const duration = session?.duration_minutes ?? null;
  const block = useMemo(() => singleBlock(selection), [selection]);
  const exactFit = !!block && duration != null && block.minutes === duration;
  const canSubmit = exactFit && !submitting;

  const editable = session?.status === "availability_set";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!block || !exactFit) return;
    setSubmitting(true);
    try {
      await scheduleSession(id, {
        scheduled_at: toLocalIso(block.date, block.start),
        date: block.date,
        start: block.start,
        duration_minutes: block.minutes,
        location: location.trim() || null,
      });
      toast.success("Session scheduled — we've emailed both of you the details.");
      router.push("/member/dashboard");
    } catch (err) {
      if (err instanceof ApiError && err.code === "invalid_state") {
        toast.error("This session can no longer be scheduled.");
      } else if (err instanceof ApiError && err.code === "validation_error") {
        toast.error("That time doesn't fit the learner's availability. Pick another block.");
      } else if (err instanceof ApiError) {
        toast.error(err.message || "Could not schedule the session. Please try again.");
      } else {
        toast.error("Could not schedule the session. Please try again.");
      }
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <Link
        href="/member/dashboard"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to dashboard
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display tracking-tight">
            <CalendarCheck className="size-5 text-brand" aria-hidden="true" />
            Schedule the session
          </CardTitle>
          {session ? (
            <p className="text-sm text-muted-foreground">
              {subjectLabel(session)} with {session.requester_name ?? "your learner"}.
              {duration ? ` Pick a single ${formatDuration(duration)} block` : " Pick a block"}{" "}
              inside the highlighted times they&apos;re free.
            </p>
          ) : null}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Loading…
            </div>
          ) : loadError ? (
            <p className="py-12 text-sm text-destructive">{loadError}</p>
          ) : !editable ? (
            <p className="py-12 text-sm text-muted-foreground">
              This session isn&apos;t ready to schedule yet.
            </p>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label>Choose a time</Label>
                <TwoWeekTimeGrid
                  value={selection}
                  onChange={setSelection}
                  allowed={allowed}
                  singleDayOnly
                  singleContiguousRange
                  maxMinutesPerSession={duration ?? undefined}
                />
                {duration ? (
                  <p
                    className={
                      "text-xs " + (exactFit ? "text-green-600" : "text-amber-600")
                    }
                  >
                    {!block
                      ? `Select one continuous ${formatDuration(duration)} block.`
                      : exactFit
                        ? `Scheduled for ${formatBlock(block.date, block.start, block.end)}.`
                        : `That block is ${formatDuration(
                            block.minutes,
                          )} — it must be exactly ${formatDuration(duration)}.`}
                  </p>
                ) : null}
              </div>

              {session?.location_preference === "in_person" ? (
                <div className="space-y-2">
                  <Label htmlFor="location">Where will you meet? (optional)</Label>
                  <input
                    id="location"
                    type="text"
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                    placeholder="e.g. Library, Room 204"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>
              ) : null}

              <Button type="submit" className="w-full" disabled={!canSubmit}>
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Scheduling…
                  </>
                ) : (
                  "Confirm time"
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// --- helpers -----------------------------------------------------------------

function subjectLabel(s: MemberSession): string {
  const bits = [s.subject_name];
  if (s.subject_category) bits.push(s.subject_category);
  if (s.subject_grade != null) bits.push(`Grade ${s.subject_grade}`);
  return bits.join(" · ");
}

function formatBlock(date: string, start: string, end: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dayLabel = new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return `${dayLabel}, ${start}–${end}`;
}
