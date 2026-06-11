"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  HandHelping,
  ClipboardList,
  BadgeCheck,
  BookOpenCheck,
  Lock,
  LogOut,
  Settings,
  type LucideIcon,
} from "lucide-react";

import type { MeProfile } from "@/types/api";
import { getMe } from "@/services/api";
import { getCounts } from "@/services/api/member";
import { useAuth } from "@/app/providers";
import { cn } from "@/lib/utils";
import { BrandMark, BrandWordmark } from "@/components/brand";
import { PageBackdrop } from "@/components/page-backdrop";

/** Identity + live action-count shared with every member page (one fetch, §4.2). */
type MemberContextValue = {
  profile: MeProfile;
  /** Number of items needing the member's attention (badge on Dashboard). */
  actionCount: number;
  /** True only when the member is admitted (status active). */
  isActive: boolean;
  /** Force a fresh `/api/auth/me` read (after a profile mutation). */
  refreshProfile: () => Promise<void>;
  /** Force a fresh `/api/member/counts` read (after a mutation that changes the badge). */
  refreshCounts: () => Promise<void>;
};

const MemberContext = createContext<MemberContextValue | undefined>(undefined);

/** Access the member identity + live counts. Must be inside `<MemberLayout>`. */
export function useMemberContext(): MemberContextValue {
  const ctx = useContext(MemberContext);
  if (!ctx) {
    throw new Error("useMemberContext must be used within <MemberLayout>");
  }
  return ctx;
}

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Whether this destination requires an admitted (active) account. */
  gated: boolean;
  /** Show the action-count badge on this item. */
  badge?: boolean;
};

const NAV: NavItem[] = [
  { href: "/member/dashboard", label: "Dashboard", icon: LayoutDashboard, gated: false, badge: true },
  { href: "/member/request", label: "Get Help", icon: HandHelping, gated: true },
  { href: "/member/board", label: "Tutoring Board", icon: ClipboardList, gated: true },
  { href: "/member/approvals", label: "Approvals", icon: BadgeCheck, gated: true },
  { href: "/member/tutorial", label: "How it works", icon: BookOpenCheck, gated: false },
];

const ACTIVE_POLL_MS = 60_000; // counts refresh cadence for admitted members
const ADMISSION_POLL_MS = 60_000; // /me refresh cadence while awaiting admission

/**
 * The member shell (§4.2): brand + org subtitle, the five-item nav, and a footer
 * identity block, wrapping all `/member/**` pages. It owns the one-fetch
 * `MemberContext`, the Dashboard action-count badge (polled every 60s + on route
 * change + on window focus), and the NON-ACTIVE locked-nav mode (gated links
 * grayed with a lock icon, `aria-disabled`, and an "Available after admission"
 * tooltip; polling switches to `/api/auth/me` so admission unlocks without a
 * reload — and re-mints the JWT claims first so the proxy sees the fresh status).
 *
 * Seeded with the server-read profile (no-flash); the client keeps it live.
 */
export function MemberLayout({
  initialProfile,
  children,
}: {
  initialProfile: MeProfile;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut, refreshClaims } = useAuth();

  const [profile, setProfile] = useState<MeProfile>(initialProfile);
  const [actionCount, setActionCount] = useState(0);

  const isActive = profile.status === "active";

  // Mirror the latest active state into a ref so the async poller can detect a
  // pending→active flip without `profile` in its dependency list. The ref is
  // written in an effect (never during render).
  const wasActiveRef = useRef(isActive);
  useEffect(() => {
    wasActiveRef.current = isActive;
  }, [isActive]);

  const refreshProfile = useCallback(async () => {
    try {
      const me = await getMe();
      const next = me.profile;
      // On a pending→active flip, re-mint JWT claims BEFORE the unlocked UI
      // renders so the proxy's getClaims() doesn't bounce the fresh member.
      if (next.status === "active" && !wasActiveRef.current) {
        await refreshClaims();
      }
      setProfile(next);
    } catch {
      // Transient; the next poll retries.
    }
  }, [refreshClaims]);

  const refreshCounts = useCallback(async () => {
    try {
      const { action_count } = await getCounts();
      setActionCount(action_count);
    } catch {
      // Transient; leave the last known value.
    }
  }, []);

  // ACTIVE members: poll the badge count (60s + pathname change + focus).
  // NON-ACTIVE members: poll /api/auth/me (60s + focus) to catch admission.
  // This effect SUBSCRIBES to external systems (an interval + window focus + an
  // async API) — the documented-legitimate use of an effect. The initial sync
  // call below sets state only after its `await`, never synchronously.
  useEffect(() => {
    const poll = isActive ? refreshCounts : refreshProfile;
    void poll();
    const id = setInterval(poll, isActive ? ACTIVE_POLL_MS : ADMISSION_POLL_MS);
    const onFocus = () => void poll();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
    // `pathname` is a dep so the active-member badge refetches on navigation.
  }, [isActive, pathname, refreshCounts, refreshProfile]);

  async function handleSignOut() {
    await signOut();
    router.push("/auth/login");
  }

  const fullName = `${profile.first_name} ${profile.last_name}`.trim();
  const initials =
    (profile.first_name[0] ?? "") + (profile.last_name[0] ?? "");

  const ctx: MemberContextValue = {
    profile,
    actionCount,
    isActive,
    refreshProfile,
    refreshCounts,
  };

  return (
    <MemberContext.Provider value={ctx}>
      <PageBackdrop />
      <div className="flex min-h-screen flex-col lg:flex-row">
        {/* Sidebar */}
        <aside className="flex shrink-0 flex-col border-b bg-card/80 backdrop-blur lg:h-screen lg:w-64 lg:border-r lg:border-b-0">
          <div className="flex items-center gap-2 px-5 py-5">
            <Link href="/member/dashboard" className="flex items-center gap-2">
              <BrandMark size={28} />
              <span className="flex flex-col leading-tight">
                <BrandWordmark className="text-lg" />
                {profile.org ? (
                  <span className="text-xs text-muted-foreground">
                    {profile.org.name}
                  </span>
                ) : null}
              </span>
            </Link>
          </div>

          <nav className="flex-1 space-y-1 px-3 py-2" aria-label="Member">
            {NAV.map((item) => {
              const locked = item.gated && !isActive;
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;

              if (locked) {
                return (
                  <span
                    key={item.href}
                    aria-disabled="true"
                    title="Available after admission"
                    className="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground/60"
                  >
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    <span className="flex-1">{item.label}</span>
                    <Lock className="size-3.5 shrink-0" aria-hidden="true" />
                  </span>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-brand-subtle text-brand-strong"
                      : "text-foreground/80 hover:bg-accent hover:text-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="flex-1">{item.label}</span>
                  {item.badge && actionCount > 0 ? (
                    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-xs font-semibold text-white">
                      {actionCount}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          {/* Footer identity */}
          <div className="border-t px-3 py-3">
            <div className="flex items-center gap-3 px-2 py-1">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-sm font-semibold text-brand-strong uppercase">
                {initials || "?"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {fullName}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {user?.email ?? ""}
                </p>
              </div>
            </div>
            <div className="mt-1 flex items-center justify-between px-2">
              <span className="text-xs text-muted-foreground">Member</span>
              <div className="flex items-center gap-1">
                {isActive ? (
                  <Link
                    href="/member/profile"
                    title="Profile & settings"
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <Settings className="size-4" aria-hidden="true" />
                    <span className="sr-only">Profile</span>
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={handleSignOut}
                  title="Sign out"
                  className="flex items-center gap-1.5 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <LogOut className="size-4" aria-hidden="true" />
                  <span className="sr-only">Sign out</span>
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 px-4 py-6 sm:px-8 lg:py-10">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>
    </MemberContext.Provider>
  );
}
