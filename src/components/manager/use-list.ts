"use client";

import { useEffect, useState } from "react";

import { ApiError } from "@/services/api";

export type ListState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** True when the fetch failed with a 404 (lets a detail page render its empty state). */
  notFound: boolean;
};

/**
 * Fetch-on-dependency-change helper for the manager list screens. Encapsulates the
 * codebase's lint-clean effect idiom (state is written ONLY inside the async
 * continuations — never synchronously in the effect body, which the
 * `react-hooks/set-state-in-effect` rule forbids; first paint shows `loading`,
 * refetches are stale-while-revalidate). A stale response is dropped via an
 * `ignore` flag when `deps` change.
 *
 * `fetcher` is invoked on mount and whenever `deps` change; pass primitive deps
 * (strings/numbers/booleans) — array/object deps must be reduced to a stable key.
 */
export function useList<T>(
  fetcher: () => Promise<T>,
  deps: ReadonlyArray<unknown>,
  fallbackMessage: string,
): ListState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let ignore = false;
    fetcher()
      .then((res) => {
        if (ignore) return;
        setData(res);
        setError(null);
        setNotFound(false);
      })
      .catch((err: unknown) => {
        if (ignore) return;
        setNotFound(err instanceof ApiError && err.status === 404);
        setError(err instanceof ApiError ? err.message || fallbackMessage : fallbackMessage);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
    // The caller passes the exact dependency list; `fetcher`/`fallbackMessage`
    // are intentionally excluded (they close over the same deps).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, notFound };
}
