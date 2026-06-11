"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  ShieldCheck,
  Users,
  CalendarRange,
  LayoutTemplate,
  ScrollText,
  KeyRound,
  Lock,
  LogOut,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";

import type { MeProfile } from "@/types/api";
import { useAuth } from "@/app/providers";
import { cn } from "@/lib/utils";
import { BrandMark, BrandWordmark } from "@/components/brand";
import { PageBackdrop } from "@/components/page-backdrop";
import { Button } from "@/components/ui/button";

/** A sidebar nav entry. The order is the §6.3 lockup. */
type NavItem = { href: string; label: string; icon: LucideIcon };

/**
 * §6.3 sidebar order: dashboard, orgs, managers, members, sessions, template,
 * audit, admins, security. Active highlighting matches on the bare path or any
 * descendant (so /admin/orgs/[id] keeps "Organizations" lit).
 */
const NAV: NavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/orgs", label: "Organizations", icon: Building2 },
  { href: "/admin/managers", label: "Managers", icon: ShieldCheck },
  { href: "/admin/members", label: "Members", icon: Users },
  { href: "/admin/sessions", label: "Sessions", icon: CalendarRange },
  { href: "/admin/template", label: "Subject template", icon: LayoutTemplate },
  { href: "/admin/audit", label: "Audit log", icon: ScrollText },
  { href: "/admin/admins", label: "Admins", icon: KeyRound },
  { href: "/admin/security", label: "Security", icon: Lock },
];

/**
 * The admin panel shell (§6.3). Sidebar with the BrandWordmark + "Admin" lockup,
 * the nine-item nav, an env badge (VERCEL_ENV + short SHA, hidden in production),
 * and a Sign out footer. Mobile-collapsible. Seeded with the server-read profile
 * (no-flash) from the layout's getServerProfile gate.
 *
 * No live count polling here (the admin panel is global oversight, not a per-org
 * work queue) — pages fetch their own data on mount.
 */
export function AdminShell({
  initialProfile,
  envLabel,
  children,
}: {
  initialProfile: MeProfile;
  /** "preview · a1b2c3d" / "development" etc.; null in production (hidden). */
  envLabel: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleSignOut() {
    await signOut();
    // No /admin-login leak: send to the public landing on sign out.
    router.push("/");
  }

  const fullName = `${initialProfile.first_name} ${initialProfile.last_name}`.trim();

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 px-5 py-5">
        <Link href="/admin/dashboard" className="flex items-center gap-2">
          <BrandMark size={28} />
          <span className="flex items-baseline gap-1">
            <BrandWordmark className="text-lg" />
            <span className="text-xs font-medium text-muted-foreground">Admin</span>
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

      {envLabel ? (
        <div className="px-5 pb-3">
          <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 font-mono text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
            {envLabel}
          </span>
        </div>
      ) : null}

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2" aria-label="Admin">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
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
          <span className="text-xs text-muted-foreground">Admin</span>
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
    <>
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
          <Link href="/admin/dashboard" className="flex items-center gap-1">
            <BrandMark size={24} />
            <BrandWordmark className="text-base" />
            <span className="text-xs font-medium text-muted-foreground">Admin</span>
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
            <div className="fixed inset-y-0 left-0 w-64 border-r bg-card shadow-xl">{sidebar}</div>
          </div>
        ) : null}

        {/* Main */}
        <main className="flex-1 px-4 py-6 sm:px-8 lg:py-10">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </>
  );
}
