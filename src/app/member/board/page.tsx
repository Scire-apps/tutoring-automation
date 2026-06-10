"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ClipboardList,
  Loader2,
  Lock,
  MapPin,
  Monitor,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/sonner";
import { ApiError } from "@/services/api";
import { claimSession, listBoard, type BoardItem } from "@/services/api/member";

const PAGE_SIZE = 25;
const ONLY_CLAIMABLE_KEY = "scire.board.onlyClaimable";

/** SSR-safe read of the persisted "only claimable" toggle (default OFF). */
function readOnlyClaimable(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(ONLY_CLAIMABLE_KEY) === "1";
}

export default function MemberBoardPage() {
  const [items, setItems] = useState<BoardItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Hydrate the toggle during initial state creation (not in an effect) so it
  // persists across visits without a cascading post-mount re-render.
  const [onlyClaimable, setOnlyClaimable] = useState<boolean>(readOnlyClaimable);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  // The session just claimed → drives the "Next steps" modal.
  const [claimedItem, setClaimedItem] = useState<BoardItem | null>(null);
  // Bumped by Retry to re-run the fresh-load effect (event-handler setState).
  const [reloadToken, setReloadToken] = useState(0);

  // Fresh load from the top on mount, on filter change, and on Retry. The fetch
  // is inline with its state writes in async continuations (.then/.catch/.finally),
  // and a cancellation flag drops a stale response if the effect re-runs.
  useEffect(() => {
    let ignore = false;
    listBoard({ limit: PAGE_SIZE, offset: 0, eligibleOnly: onlyClaimable })
      .then((res) => {
        if (ignore) return;
        setError(null);
        setTotal(res.total);
        setOffset(res.items.length);
        setItems(res.items);
      })
      .catch(() => {
        if (!ignore) setError("Could not load the board. Please try again.");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [onlyClaimable, reloadToken]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const res = await listBoard({
        limit: PAGE_SIZE,
        offset,
        eligibleOnly: onlyClaimable,
      });
      setTotal(res.total);
      setOffset((o) => o + res.items.length);
      setItems((prev) => [...prev, ...res.items]);
    } catch {
      toast.error("Could not load more requests.");
    } finally {
      setLoadingMore(false);
    }
  };

  const retry = () => {
    setLoading(true);
    setReloadToken((t) => t + 1);
  };

  const toggleOnlyClaimable = (next: boolean) => {
    setLoading(true);
    setOnlyClaimable(next);
    localStorage.setItem(ONLY_CLAIMABLE_KEY, next ? "1" : "0");
  };

  const handleClaim = async (item: BoardItem) => {
    setClaimingId(item.id);
    try {
      await claimSession(item.id);
      // Remove the now-claimed row and surface the next-steps modal.
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setTotal((t) => Math.max(0, t - 1));
      setClaimedItem(item);
    } catch (err) {
      if (err instanceof ApiError && err.code === "already_claimed") {
        toast.error("Someone beat you to this one.");
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        setTotal((t) => Math.max(0, t - 1));
      } else if (err instanceof ApiError && err.code === "not_approved_for_subject") {
        toast.error("You're not approved to tutor this subject yet.");
      } else if (err instanceof ApiError && err.code === "own_request") {
        toast.error("You can't claim your own request.");
        setItems((prev) => prev.filter((i) => i.id !== item.id));
      } else if (err instanceof ApiError && err.code === "not_found") {
        toast.error("That request is no longer available.");
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        setTotal((t) => Math.max(0, t - 1));
      } else {
        toast.error("Could not claim this request. Please try again.");
      }
    } finally {
      setClaimingId(null);
    }
  };

  const hasMore = items.length < total;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <Toaster />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <ClipboardList className="size-6 text-blue-600" aria-hidden="true" />
            Tutoring board
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Claim a request to tutor a subject you&apos;re approved for.
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            className="size-4 rounded border-input accent-blue-600"
            checked={onlyClaimable}
            onChange={(e) => toggleOnlyClaimable(e.target.checked)}
          />
          Only requests I can claim
        </label>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading the board…
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-destructive">
            {error}
            <div className="mt-3">
              <Button variant="outline" size="sm" onClick={retry}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            {onlyClaimable
              ? "No open requests match the subjects you're approved for right now."
              : "No open requests right now. Check back soon."}
          </CardContent>
        </Card>
      ) : (
        <>
          <ul className="space-y-3">
            {items.map((item) => (
              <BoardCard
                key={item.id}
                item={item}
                claiming={claimingId === item.id}
                onClaim={() => handleClaim(item)}
              />
            ))}
          </ul>

          {hasMore ? (
            <div className="mt-6 flex justify-center">
              <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Loading…
                  </>
                ) : (
                  `Load more (${total - items.length} left)`
                )}
              </Button>
            </div>
          ) : null}
        </>
      )}

      <NextStepsModal item={claimedItem} onClose={() => setClaimedItem(null)} />
    </div>
  );
}

// --- Board card --------------------------------------------------------------

function BoardCard({
  item,
  claiming,
  onClaim,
}: {
  item: BoardItem;
  claiming: boolean;
  onClaim: () => void;
}) {
  return (
    <li>
      <Card>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1.5">
            <p className="font-semibold text-foreground">{subjectLabel(item)}</p>
            <p className="line-clamp-3 text-sm text-muted-foreground">{item.notes}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                {item.location_preference === "online" ? (
                  <Monitor className="size-3.5" aria-hidden="true" />
                ) : (
                  <MapPin className="size-3.5" aria-hidden="true" />
                )}
                {item.location_preference === "online" ? "Online" : "In person"}
              </span>
              {item.language ? <span>ELL · {item.language}</span> : null}
              <span>{relativeTime(item.created_at)}</span>
            </div>
          </div>

          <div className="shrink-0">
            {item.can_claim ? (
              <Button size="sm" onClick={onClaim} disabled={claiming}>
                {claiming ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Claiming…
                  </>
                ) : (
                  "Claim"
                )}
              </Button>
            ) : (
              <div className="flex flex-col items-stretch gap-1.5">
                <Button size="sm" variant="outline" disabled className="cursor-not-allowed">
                  <Lock className="size-3.5" aria-hidden="true" />
                  Approval required
                </Button>
                <Link
                  href={`/member/approvals?subject=${encodeURIComponent(item.org_subject_id)}`}
                  className="inline-flex items-center justify-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  Request approval
                  <ArrowRight className="size-3" aria-hidden="true" />
                </Link>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </li>
  );
}

// --- Next-steps modal (shown on a successful 201 claim) ----------------------

function NextStepsModal({
  item,
  onClose,
}: {
  item: BoardItem | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!item} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>You claimed this request</DialogTitle>
          <DialogDescription>
            {item ? subjectLabel(item) : ""}
          </DialogDescription>
        </DialogHeader>
        <ol className="space-y-2 text-sm text-muted-foreground">
          <li>
            1. The learner sets their availability — you&apos;ll get an email when it&apos;s
            ready.
          </li>
          <li>2. Pick a time inside their availability to schedule the session.</li>
          <li>3. Meet, then add the recording link and mark the session complete.</li>
          <li>4. A manager verifies it and awards your volunteer hours.</li>
        </ol>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Back to board
          </Button>
          <Button asChild>
            <Link href="/member/dashboard">Go to my sessions</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- helpers -----------------------------------------------------------------

function subjectLabel(item: BoardItem): string {
  const bits = [item.subject_name];
  if (item.subject_category) bits.push(item.subject_category);
  if (item.subject_grade != null) bits.push(`Grade ${item.subject_grade}`);
  return bits.join(" · ");
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}
