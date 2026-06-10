"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Numbered-page footer for the manager panel's paginated tables (§5.0 — "no
 * unpaginated tables"). Renders the showing-range and prev/next controls; pure
 * presentation, the page owns the `offset` state.
 */
export function Pagination({
  total,
  limit,
  offset,
  onOffsetChange,
  className,
}: {
  total: number;
  limit: number;
  offset: number;
  onOffsetChange: (next: number) => void;
  className?: string;
}) {
  if (total <= limit && offset === 0) return null;
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, total);
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className={`flex items-center justify-between gap-3 pt-3 ${className ?? ""}`}>
      <p className="text-xs text-muted-foreground">
        {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={offset <= 0}
          onClick={() => onOffsetChange(Math.max(0, offset - limit))}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Prev
        </Button>
        <span className="text-xs text-muted-foreground">
          Page {page} of {pages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={to >= total}
          onClick={() => onOffsetChange(offset + limit)}
        >
          Next
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
