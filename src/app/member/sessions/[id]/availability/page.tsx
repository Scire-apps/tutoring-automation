"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarClock, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import {
  TwoWeekTimeGrid,
  compressSelectionToDateMap,
  type DateSelection,
} from "@/components/two-week-time-grid";
import {
  DurationPicker,
  formatDuration,
  type DurationOption,
} from "@/components/duration-picker";
import { ApiError } from "@/services/api";
import {
  getSession,
  setAvailability,
  type MemberSession,
} from "@/services/api/member";

/** Longest single contiguous selected range across all dates, in minutes. */
function maxWindowMinutes(selection: DateSelection): number {
  let max = 0;
  for (const ranges of Object.values(selection)) {
    for (const r of ranges) {
      max = Math.max(max, diffMinutes(r.start, r.end));
    }
  }
  return max;
}

function diffMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

export default function MemberAvailabilityPage({
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
  const [duration, setDuration] = useState<DurationOption | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const s = await getSession(id);
        if (!active) return;
        setSession(s);
        if (s.duration_minutes && isDurationOption(s.duration_minutes)) {
          setDuration(s.duration_minutes);
        }
        // Re-hydrate any previously-set availability so edits start from current state.
        if (s.availability && typeof s.availability === "object") {
          setSelection(dateMapToSelection(s.availability as Record<string, string[]>));
        }
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

  const longestWindow = useMemo(() => maxWindowMinutes(selection), [selection]);
  const windowFits = duration != null && longestWindow >= duration;
  const canSubmit = !!duration && windowFits && !submitting;

  // Surfaces while the requester is still allowed to set/edit availability.
  const editable = session?.status === "claimed" || session?.status === "availability_set";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!duration || !windowFits) return;
    setSubmitting(true);
    try {
      await setAvailability(id, {
        availability: compressSelectionToDateMap(selection),
        duration_minutes: duration,
      });
      toast.success("Availability saved — your tutor can now schedule a time.");
      router.push("/member/dashboard");
    } catch (err) {
      if (err instanceof ApiError && err.code === "invalid_state") {
        toast.error("This session can no longer accept availability.");
      } else if (err instanceof ApiError) {
        toast.error(err.message || "Could not save your availability. Please try again.");
      } else {
        toast.error("Could not save your availability. Please try again.");
      }
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <Toaster />
      <Link
        href="/member/dashboard"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to dashboard
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="size-5 text-blue-600" aria-hidden="true" />
            Set your availability
          </CardTitle>
          {session ? (
            <p className="text-sm text-muted-foreground">
              {subjectLabel(session)} with {session.tutor_name ?? "your tutor"}. Pick how
              long you need, then drag to mark when you&apos;re free.
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
              This session is no longer waiting on your availability.
            </p>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="duration">Session length</Label>
                <DurationPicker id="duration" value={duration} onChange={setDuration} />
              </div>

              <div className="space-y-2">
                <Label>When are you free?</Label>
                <TwoWeekTimeGrid value={selection} onChange={setSelection} />
                {duration ? (
                  <p
                    className={
                      "text-xs " +
                      (windowFits ? "text-muted-foreground" : "text-amber-600")
                    }
                  >
                    {windowFits
                      ? `Looks good — your longest free block is ${formatDuration(
                          longestWindow,
                        )}.`
                      : `Select at least one block of ${formatDuration(
                          duration,
                        )} so your tutor can fit the session.`}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Choose a session length first.
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={!canSubmit}>
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Saving…
                  </>
                ) : (
                  "Save availability"
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

function isDurationOption(n: number): n is DurationOption {
  return [60, 90, 120, 150, 180].includes(n);
}

function subjectLabel(s: MemberSession): string {
  const bits = [s.subject_name];
  if (s.subject_category) bits.push(s.subject_category);
  if (s.subject_grade != null) bits.push(`Grade ${s.subject_grade}`);
  return bits.join(" · ");
}

function dateMapToSelection(map: Record<string, string[]>): DateSelection {
  const out: DateSelection = {};
  for (const [date, ranges] of Object.entries(map)) {
    if (!Array.isArray(ranges)) continue;
    out[date] = ranges
      .map((r) => {
        const [start, end] = String(r).split("-");
        return start && end ? { start, end } : null;
      })
      .filter((r): r is { start: string; end: string } => r !== null);
  }
  return out;
}
