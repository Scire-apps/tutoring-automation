"use client";

import { cn } from "@/lib/utils";

/** The five legal session durations (minutes) — matches the DB CHECK (60–180 step 30). */
export const DURATION_OPTIONS = [60, 90, 120, 150, 180] as const;
export type DurationOption = (typeof DURATION_OPTIONS)[number];

/**
 * Segmented control for a session's `duration_minutes` (§4.7). Writes the single
 * duration column directly — the SCHEMA FINAL desired/final split is gone, so
 * there is one value here. Labels read "1h", "1h 30m", … for clarity.
 */
export function DurationPicker({
  value,
  onChange,
  disabled,
  className,
  id,
}: {
  value: DurationOption | null;
  onChange: (next: DurationOption) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
}) {
  return (
    <div
      id={id}
      role="radiogroup"
      aria-label="Session duration"
      className={cn(
        "inline-flex w-full rounded-lg border border-input bg-muted/40 p-1",
        className,
      )}
    >
      {DURATION_OPTIONS.map((minutes) => {
        const selected = value === minutes;
        return (
          <button
            key={minutes}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(minutes)}
            className={cn(
              "flex-1 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              "disabled:cursor-not-allowed disabled:opacity-50",
              selected
                ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {formatDuration(minutes)}
          </button>
        );
      })}
    </div>
  );
}

/** "60" → "1h", "90" → "1h 30m". Exported so pages can label the chosen duration. */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
