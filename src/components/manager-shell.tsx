"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  BadgeCheck,
  CalendarCheck,
  ClipboardCheck,
  Clock,
  BookMarked,
  Mail,
  ShieldCheck,
  LifeBuoy,
  LogOut,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";

import type { MeProfile } from "@/types/api";
import type { ManageCounts } from "@/services/api/manage";
import { getCounts } from "@/services/api/manage";
import { useAuth } from "@/app/providers";
import { cn } from "@/lib/utils";
import { BrandMark, BrandWordmark } from "@/components/brand";
import { PageBackdrop } from "@/components/page-backdrop";
import { Button } from "@/components/ui/button";

/** Identity + live sidebar badge counts shared with every manager page (§5.3). */
type ManagerContextValue = {
  profile: MeProfile;
  /** The five numeric sidebar badges from `GET /api/manage/counts`. */
  counts: ManageCounts;
  /** Re-fetch the badge counts (after a mutation that changes a queue size). */
  refreshCounts: () => Promise<void>;
};

const ManagerContext = createContext<ManagerContextValue | undefined>(undefined);

/** Access the manager identity + live counts. Must be inside `<ManagerShell>`. */
export function useManagerContext(): ManagerContextValue {
  const ctx = useContext(ManagerContext);
  if (!ctx) {
    throw new Error("useManagerContext must be used within <ManagerShell>");
  }
  return ctx;
}

/** A sidebar nav entry; `badge` names which count drives its numeric pill. */
type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: keyof ManageCounts;
};

/**
 * The §5.3 sidebar. Ten destinations; five carry numeric badges (pending
 * admissions / approval requests / verification queue / pending managers /
 * open help). The Sessions/Verification/Hours/Subjects/Emails/Help pages are
 * owned by the sibling manager-UI track — the links resolve once those land.
 */
const NAV: NavItem[] = [
  { href: "/manager/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/manager/members", label: "Members", icon: Users, badge: "pending_admissions" },
  { href: "/manager/approvals", label: "Approvals", icon: BadgeCheck, badge: "approval_requests" },
  { href: "/manager/sessions", label: "Sessions", icon: CalendarCheck },
  { href: "/manager/verification", label: "Verification", icon: ClipboardCheck, badge: "verification_queue" },
  { href: "/manager/hours", label: "Hours", icon: Clock },
  { href: "/manager/subjects", label: "Subjects", icon: BookMarked },
  { href: "/manager/emails", label: "Emails", icon: Mail },
  { href: "/manager/managers", label: "Managers", icon: ShieldCheck, badge: "pending_managers" },
  { href: "/manager/help", label: "Help", icon: LifeBuoy, badge: "open_help" },
];

const COUNTS_POLL_MS = 60_000;

const ZERO_COUNTS: ManageCounts = {
  pending_admissions: 0,
  approval_requests: 0,
  verification_queue: 0,
  pending_managers: 0,
  open_help: 0,
};

/**
 * The manager panel shell (§5.3), wrapping every `/manager/(panel)/**` page.
 * Sidebar: brand + org + manager name, the ten-item nav with five numeric
 * badges, and Sign out. Badges come from `GET /api/manage/counts`, refetched on
 * route change + window focus (and every 60s). Mobile-collapsible.
 *
 * Seeded with the server-read profile (no-flash); the client keeps the counts
 * live so a manager sees a new admission/approval/verification arrive without a
 * reload.
 */
export function ManagerShell({
  initialProfile,
  children,
}: {
  initialProfile: MeProfile;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();

  const [counts, setCounts] = useState<ManageCounts>(ZERO_COUNTS);
  const [mobileOpen, setMobileOpen] = useState(false);

  const refreshCounts = useCallback(async () => {
    try {
      setCounts(await getCounts());
    } catch {
      // Transient; keep the last known values.
    }
  }, []);

  // Refetch the badge counts on mount, every 60s, on navigation, and on focus.
  // This effect SUBSCRIBES to external systems (interval + focus + the API); the
  // poll only sets state AFTER its await (`refreshCounts`), never during render.
  // `pathname` is a dep so the counts refetch on every navigation.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async (post-await) poll + external subscriptions
    void refreshCounts();
    const id = setInterval(refreshCounts, COUNTS_POLL_MS);
    const onFocus = () => void refreshCounts();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [pathname, refreshCounts]);

  async function handleSignOut() {
    await signOut();
    router.push("/auth/login");
  }

  const fullName = `${initialProfile.first_name} ${initialProfile.last_name}`.trim();
  const orgName = initialProfile.org?.name ?? "Your organization";

  const ctx: ManagerContextValue = { profile: initialProfile, counts, refreshCounts };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 px-5 py-5">
        <Link href="/manager/dashboard" className="flex items-center gap-2">
          <BrandMark size={28} />
          <span className="flex flex-col leading-tight">
            <span className="flex items-baseline gap-1">
              <BrandWordmark className="text-lg" />
              <span className="text-xs font-medium text-muted-foreground">Manager</span>
            </span>
            <span className="text-xs text-muted-foreground">{orgName}</span>
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="rounded-md p-1 text-muted-foreground hover:bg-accent lg:hidden"
          aria-label="Close menu"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2" aria-label="Manager">
        {NAV.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          const count = item.badge ? counts[item.badge] : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-brand-subtle text-brand-strong"
                  : "text-foreground/80 hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              <span className="flex-1">{item.label}</span>
              {item.badge && count > 0 ? (
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-xs font-semibold text-white">
                  {count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="border-t px-3 py-3">
        <div className="flex items-center gap-3 px-2 py-1">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-sm font-semibold text-brand-strong uppercase">
            {(initialProfile.first_name[0] ?? "") + (initialProfile.last_name[0] ?? "") || "?"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{fullName}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email ?? ""}</p>
          </div>
        </div>
        <div className="mt-1 flex items-center justify-between px-2">
          <span className="text-xs text-muted-foreground">Manager</span>
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
  );

  return (
    <ManagerContext.Provider value={ctx}>
      <PageBackdrop />
      <div className="flex min-h-screen flex-col lg:flex-row">
        {/* Desktop sidebar */}
        <aside className="hidden shrink-0 border-r bg-card/80 backdrop-blur lg:block lg:h-screen lg:w-64 lg:sticky lg:top-0">
          {sidebar}
        </aside>

        {/* Mobile top bar */}
        <div className="flex items-center justify-between border-b bg-card/80 px-4 py-3 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
            aria-label="Open menu"
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
          <Link href="/manager/dashboard" className="flex items-center gap-2">
            <BrandMark size={24} />
            <BrandWordmark className="text-base" />
          </Link>
          <Button variant="ghost" size="icon-sm" onClick={handleSignOut} aria-label="Sign out">
            <LogOut className="size-4" aria-hidden="true" />
          </Button>
        </div>

        {/* Mobile drawer */}
        {mobileOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="fixed inset-0 bg-foreground/40"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />
            <div className="fixed inset-y-0 left-0 w-64 border-r bg-card shadow-xl">
              {sidebar}
            </div>
          </div>
        ) : null}

        {/* Main */}
        <main className="flex-1 px-4 py-6 sm:px-8 lg:py-10">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </ManagerContext.Provider>
  );
}
