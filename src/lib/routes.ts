import type { Database } from "@/types/database";

type AccountKind = Database["public"]["Enums"]["account_kind"];
type AccountStatus = Database["public"]["Enums"]["account_status"];

/**
 * Canonical post-auth landing path for a (kind, status) pair — the single source
 * of truth shared by the proxy, the auth pages, and `/auth/confirm` (§3.4, §8).
 *
 *   admin            → /admin/dashboard
 *   manager active   → /manager/dashboard
 *   manager (other)  → /manager/pending     (locked-modal gate page)
 *   member (any)     → /member/dashboard     (status-gated in the page itself)
 *
 * Members always land on their dashboard regardless of status — there is no
 * separate /member/pending route; the dashboard renders the gate card.
 */
export function homeFor(kind: AccountKind, status: AccountStatus): string {
  if (kind === "admin") return "/admin/dashboard";
  if (kind === "manager") {
    return status === "active" ? "/manager/dashboard" : "/manager/pending";
  }
  return "/member/dashboard";
}
