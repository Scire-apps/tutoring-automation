"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Archive,
  Building2,
  Loader2,
  RotateCcw,
  UserPlus,
  Users,
  ShieldCheck,
  CalendarRange,
  Inbox,
  ClipboardCheck,
  Clock,
  BookMarked,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  getOrg,
  getOrgStats,
  archiveOrg,
  restoreOrg,
  inviteManager,
  type AdminOrg,
  type AdminOrgStats,
} from "@/services/api/admin";
import { ApiError } from "@/services/api";
import { formatHours } from "@/lib/admin-format";
import { AccountList } from "@/components/admin/account-list";
import { SessionList } from "@/components/admin/session-list";
import { OrgSubjects } from "@/components/admin/org-subjects";
import { OrgSettingsDialog } from "@/components/admin/org-settings-dialog";
import { InviteManagerDialog } from "@/components/admin/account-dialogs";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/manager/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Org detail (§6.3) — header + tab nav (overview stats, members, managers,
 * sessions, subjects, settings). Members/Managers reuse the shared `AccountList`
 * (org-scoped); Sessions reuse `SessionList`; Subjects reuse `OrgSubjects`. The
 * settings tab offers rename / slug edit / Archive / Restore — NO hard delete.
 */
export default function AdminOrgDetailPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = use(params);
  const router = useRouter();

  const [org, setOrg] = useState<AdminOrg | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const loadOrg = useCallback(async () => {
    try {
      const o = await getOrg(orgId);
      setOrg(o);
      setError(null);
      setNotFound(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setNotFound(true);
      setError(e instanceof ApiError ? e.message || "Couldn't load this organization." : "Couldn't load this organization.");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async (post-await) data fetch
    void loadOrg();
  }, [loadOrg]);

  if (loading && !org) {
    return (
      <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Loading organization…
      </div>
    );
  }

  if (!org) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {notFound ? "This organization could not be found." : (error ?? "Couldn't load this organization.")}
          </CardContent>
        </Card>
      </div>
    );
  }

  const archived = org.archived_at != null;

  return (
    <div className="space-y-6">
      <BackLink />

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Building2 className="size-6 text-blue-600" aria-hidden="true" />
            {org.name}
            {archived ? (
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-inset ring-border">
                Archived
              </span>
            ) : null}
          </h1>
          <p className="mt-1 font-mono text-sm text-muted-foreground">{org.slug}</p>
        </div>
      </header>

      {archived ? (
        <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">
          This organization is archived — hidden from signup, no new requests or claims, and its
          manager panel is read-only. Logins and hours history are retained. Restore it from
          Settings.
        </div>
      ) : null}

      <Tabs defaultValue="overview">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="managers">Managers</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="subjects">Subjects</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-5">
          <OverviewTab orgId={orgId} />
        </TabsContent>

        <TabsContent value="members" className="mt-5">
          <AccountList
            baseParams={{ kind: "member", org_id: orgId }}
            emptyLabel="No members in this organization yet."
          />
        </TabsContent>

        <TabsContent value="managers" className="mt-5">
          <ManagersTab orgId={orgId} orgName={org.name} />
        </TabsContent>

        <TabsContent value="sessions" className="mt-5">
          <SessionList baseFilters={{ org_id: orgId }} />
        </TabsContent>

        <TabsContent value="subjects" className="mt-5">
          <OrgSubjects orgId={orgId} />
        </TabsContent>

        <TabsContent value="settings" className="mt-5">
          <SettingsTab
            org={org}
            onChanged={(o) => setOrg(o)}
            onArchived={() => {
              void loadOrg();
            }}
            onDeletedToList={() => router.push("/admin/orgs")}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/admin/orgs"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      All organizations
    </Link>
  );
}

/* ------------------------------------------------------------- Overview --- */

const STAT_META: {
  key: keyof AdminOrgStats;
  label: string;
  icon: LucideIcon;
  hours?: boolean;
}[] = [
  { key: "active_members", label: "Active members", icon: Users },
  { key: "pending_members", label: "Pending admissions", icon: UserPlus },
  { key: "active_managers", label: "Active managers", icon: ShieldCheck },
  { key: "open_requests", label: "Open requests", icon: Inbox },
  { key: "scheduled", label: "Scheduled", icon: CalendarRange },
  { key: "awaiting_verification", label: "Awaiting verification", icon: ClipboardCheck },
  { key: "hours_awarded", label: "Hours awarded", icon: Clock, hours: true },
  { key: "subjects_active", label: "Active subjects", icon: BookMarked },
];

function OverviewTab({ orgId }: { orgId: string }) {
  const [stats, setStats] = useState<AdminOrgStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    getOrgStats(orgId)
      .then((s) => {
        if (ignore) return;
        setStats(s);
        setError(null);
      })
      .catch((e: unknown) => {
        if (ignore) return;
        setError(e instanceof Error ? e.message || "Couldn't load stats." : "Couldn't load stats.");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [orgId]);

  if (error) return <p className="py-6 text-sm text-destructive">{error}</p>;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {STAT_META.map((s) => {
        const Icon = s.icon;
        const raw = stats ? stats[s.key] : null;
        const value = raw == null ? "—" : s.hours ? formatHours(raw) : String(raw);
        return (
          <Card key={s.key} className="gap-2 py-4">
            <CardContent className="space-y-1.5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <p
                className={cn(
                  "text-xl font-semibold",
                  loading ? "text-muted-foreground" : "text-foreground",
                )}
              >
                {value}
              </p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------- Managers --- */

function ManagersTab({ orgId, orgName }: { orgId: string; orgName: string }) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  return (
    <>
      <AccountList
        // Remount on invite so the new pending manager appears.
        key={reloadToken}
        baseParams={{ kind: "manager", org_id: orgId }}
        emptyLabel="No managers in this organization yet."
        toolbarExtra={
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus className="size-4" aria-hidden="true" />
            Invite manager
          </Button>
        }
      />
      <InviteManagerDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        fixedOrgId={orgId}
        onConfirm={async (input) => {
          await inviteManager(input);
          toast.success(`Invitation sent for ${orgName}.`);
          setReloadToken((t) => t + 1);
        }}
      />
    </>
  );
}

/* ------------------------------------------------------------- Settings --- */

function SettingsTab({
  org,
  onChanged,
  onArchived,
  onDeletedToList,
}: {
  org: AdminOrg;
  onChanged: (org: AdminOrg) => void;
  onArchived: () => void;
  onDeletedToList: () => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const archived = org.archived_at != null;
  // onDeletedToList is reserved for a future hard-purge runbook tool; archive-only in v1.
  void onDeletedToList;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 py-5">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Details</h3>
            <p className="text-sm text-muted-foreground">
              Rename the organization or change its slug.
            </p>
          </div>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Name</dt>
              <dd className="text-foreground">{org.name}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Slug</dt>
              <dd className="font-mono text-foreground">{org.slug}</dd>
            </div>
          </dl>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            Edit details
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 py-5">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {archived ? "Restore organization" : "Archive organization"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {archived
                ? "Restoring re-enables signups and the manager panel. The slug is re-validated for uniqueness."
                : "Archiving hides the org from signup and makes its manager panel read-only. Logins and hours history are kept. There is no hard delete."}
            </p>
          </div>
          {archived ? (
            <Button variant="outline" size="sm" onClick={() => setRestoreOpen(true)}>
              <RotateCcw className="size-4" aria-hidden="true" />
              Restore organization
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setArchiveOpen(true)}
            >
              <Archive className="size-4" aria-hidden="true" />
              Archive organization
            </Button>
          )}
        </CardContent>
      </Card>

      <OrgSettingsDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        org={org}
        onSaved={(o) => {
          toast.success("Organization updated.");
          onChanged(o);
        }}
      />

      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title={`Archive ${org.name}?`}
        description="It disappears from signup and its manager panel becomes read-only. You can restore it any time."
        confirmLabel="Archive organization"
        destructive
        onConfirm={async () => {
          await archiveOrg(org.id);
          toast.success("Organization archived.");
          onArchived();
        }}
      />

      <ConfirmDialog
        open={restoreOpen}
        onOpenChange={setRestoreOpen}
        title={`Restore ${org.name}?`}
        description="Signups and the manager panel are re-enabled. The slug is re-validated for uniqueness."
        confirmLabel="Restore organization"
        onConfirm={async () => {
          try {
            await restoreOrg(org.id);
          } catch (err) {
            if (err instanceof ApiError && err.status === 409) {
              throw new Error("Another active organization already uses this slug. Change the slug first.");
            }
            throw err;
          }
          toast.success("Organization restored.");
          onArchived();
        }}
      />
    </div>
  );
}
