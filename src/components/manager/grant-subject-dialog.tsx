"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Search } from "lucide-react";

import type { ManageOrgSubject } from "@/services/api/manage";
import { listOrgSubjects } from "@/services/api/manage";
import { ApiError } from "@/services/api";
import { subjectLabel } from "@/lib/manager-format";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * "Grant subject" picker (§5.5): directly approves a member to tutor a subject
 * (a direct grant — evidence NULL, source chip "direct"). Lists the org's ACTIVE
 * catalog minus subjects the member already holds/awaits (`excludeSubjectIds`),
 * with a search filter. On confirm → `POST /api/manage/subject-approvals`.
 */
export function GrantSubjectDialog({
  open,
  onOpenChange,
  memberName,
  excludeSubjectIds,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberName: string;
  /** org_subject_ids the member already has a (non-terminal) approval row for. */
  excludeSubjectIds: string[];
  /** Resolves with the chosen org_subject_id. Stays open if it rejects. */
  onConfirm: (orgSubjectId: string) => Promise<void>;
}) {
  const [subjects, setSubjects] = useState<ManageOrgSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the active catalog when the dialog opens. State is only set inside the
  // promise callbacks (post-await), so the effect triggers no synchronous render
  // cascade; `loading` starts true and resets to true on close (see `reset()`).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    listOrgSubjects({ active: true })
      .then((items) => {
        if (cancelled) return;
        setLoadError(null);
        setSubjects(items);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setLoadError(
            e instanceof ApiError ? e.message || "Couldn't load subjects." : "Couldn't load subjects.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const exclude = useMemo(() => new Set(excludeSubjectIds), [excludeSubjectIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return subjects
      .filter((s) => !exclude.has(s.id))
      .filter((s) => (q ? subjectLabel(s).toLowerCase().includes(q) : true));
  }, [subjects, exclude, query]);

  function reset() {
    setQuery("");
    setSelected(null);
    setError(null);
    // Re-arm the loading spinner for the next open (the load effect refetches).
    setLoading(true);
  }

  async function handleConfirm() {
    if (!selected) {
      setError("Pick a subject to grant.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onConfirm(selected);
      reset();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message || "Couldn't grant the subject." : "Couldn't grant the subject.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display tracking-tight">Grant a subject to {memberName}</DialogTitle>
          <DialogDescription>
            Approve {memberName} to tutor a subject directly, without a request.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search subjects…"
              className="pl-9"
              aria-label="Search subjects"
              disabled={pending}
            />
          </div>

          <div className="max-h-64 overflow-y-auto rounded-md border">
            {loading ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">Loading…</p>
            ) : loadError ? (
              <p className="px-3 py-6 text-center text-sm text-destructive">{loadError}</p>
            ) : filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                No subjects available to grant.
              </p>
            ) : (
              <ul className="divide-y">
                {filtered.map((s) => {
                  const isSel = selected === s.id;
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(s.id)}
                        disabled={pending}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent",
                          isSel && "bg-brand-subtle text-brand-strong",
                        )}
                      >
                        <span>{subjectLabel(s)}</span>
                        {isSel ? <Check className="size-4 shrink-0" aria-hidden="true" /> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={pending || !selected}>
            {pending ? "Granting…" : "Grant subject"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
