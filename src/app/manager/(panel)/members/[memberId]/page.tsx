"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, GraduationCap } from "lucide-react";

import type { ManageMemberDetail } from "@/services/api/manage";
import {
  getMember,
  admitMember,
  rejectMember,
  suspendMember,
  restoreMember,
} from "@/services/api/manage";
import { ApiError } from "@/services/api";
import { useManagerContext } from "@/components/manager-shell";
import { AccountStatusChip } from "@/components/manager/account-status-chip";
import {
  AdmitDialog,
  RejectDialog,
  RestoreDialog,
  SuspendDialog,
} from "@/components/manager/member-action-dialogs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/manager/tabs";
import { MemberApprovalsTab } from "@/components/manager/member-approvals-tab";
import { MemberSessionsTab } from "@/components/manager/member-sessions-tab";
import { MemberHoursTab } from "@/components/manager/member-hours-tab";
import { personName } from "@/lib/manager-format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * Member detail (§5.5): profile header with STATE-LEGAL actions (admit/reject for
 * pending; suspend for active; restore for suspended/rejected) and three tabs —
 * Approvals (grants + history + Grant subject), Sessions (as requester AND tutor),
 * Hours (ledger + total + Add adjustment). Managers cannot edit member profile
 * fields — only lifecycle/approval/hours actions.
 */
export default function ManagerMemberDetailPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = use(params);
  const { refreshCounts } = useManagerContext();

  const [member, setMember] = useState<ManageMemberDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [admitOpen, setAdmitOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setMember(await getMember(memberId));
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setError("This member doesn't exist or isn't in your organization.");
      } else {
        setError(
          e instanceof ApiError ? e.message || "Couldn't load this member." : "Couldn't load this member.",
        );
      }
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async (post-await) data fetch
    void load();
  }, [load]);

  const afterMutation = useCallback(async () => {
    await Promise.all([load(), refreshCounts()]);
  }, [load, refreshCounts]);

  if (loading && !member) {
    return <DetailSkeleton />;
  }

  if (error && !member) {
    return (
      <div className="space-y-6">
        <BackLink />
        <Alert variant="destructive">
          <AlertTitle>Couldn&apos;t open this member</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!member) return null;

  const name = personName(member);

  return (
    <div className="space-y-6">
      <BackLink />

      {/* Header */}
      <Card>
        <CardContent className="flex flex-wrap items-start justify-between gap-4 py-6">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-base font-semibold text-blue-700 uppercase">
              {(member.first_name[0] ?? "") + (member.last_name[0] ?? "") || "?"}
            </span>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight text-foreground">{name}</h1>
                <AccountStatusChip status={member.status} />
              </div>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Mail className="size-3.5" aria-hidden="true" />
                {member.email}
              </p>
              <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <GraduationCap className="size-3.5" aria-hidden="true" />
                  {member.grade != null ? `Grade ${member.grade}` : "No grade"}
                </span>
                <span>{member.pronouns ?? "No pronouns"}</span>
                <span>Joined {new Date(member.created_at).toLocaleDateString()}</span>
              </p>
              {member.status_note ? (
                <p className="mt-1 rounded-md bg-muted px-3 py-1.5 text-sm text-muted-foreground">
                  Note: {member.status_note}
                </p>
              ) : null}
            </div>
          </div>

          <MemberActions
            member={member}
            onAdmit={() => setAdmitOpen(true)}
            onReject={() => setRejectOpen(true)}
            onSuspend={() => setSuspendOpen(true)}
            onRestore={() => setRestoreOpen(true)}
          />
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="approvals">
        <TabsList>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="hours">Hours</TabsTrigger>
        </TabsList>

        <TabsContent value="approvals" className="pt-4">
          <MemberApprovalsTab memberId={member.id} memberName={name} onChanged={afterMutation} />
        </TabsContent>
        <TabsContent value="sessions" className="pt-4">
          <MemberSessionsTab memberId={member.id} />
        </TabsContent>
        <TabsContent value="hours" className="pt-4">
          <MemberHoursTab
            memberId={member.id}
            memberName={name}
            totalHours={member.total_hours}
            onChanged={afterMutation}
          />
        </TabsContent>
      </Tabs>

      {/* Lifecycle dialogs */}
      <AdmitDialog
        open={admitOpen}
        onOpenChange={setAdmitOpen}
        memberName={name}
        onConfirm={async (note) => {
          await admitMember(member.id, { note: note || undefined });
          await afterMutation();
        }}
      />
      <RejectDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        memberName={name}
        onConfirm={async (note) => {
          await rejectMember(member.id, { note: note || undefined });
          await afterMutation();
        }}
      />
      <SuspendDialog
        open={suspendOpen}
        onOpenChange={setSuspendOpen}
        memberName={name}
        openRequests={member.open_requests_count}
        activeSessions={member.active_sessions_count}
        onConfirm={async ({ note, cancelActive }) => {
          await suspendMember(member.id, { note, cancel_active: cancelActive });
          await afterMutation();
        }}
      />
      <RestoreDialog
        open={restoreOpen}
        onOpenChange={setRestoreOpen}
        memberName={name}
        onConfirm={async () => {
          await restoreMember(member.id);
          await afterMutation();
        }}
      />
    </div>
  );
}

/* ----------------------------------------------------------------- Actions --- */

function MemberActions({
  member,
  onAdmit,
  onReject,
  onSuspend,
  onRestore,
}: {
  member: ManageMemberDetail;
  onAdmit: () => void;
  onReject: () => void;
  onSuspend: () => void;
  onRestore: () => void;
}) {
  switch (member.status) {
    case "pending":
      return (
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onReject}>
            Reject
          </Button>
          <Button onClick={onAdmit}>Admit</Button>
        </div>
      );
    case "active":
      return (
        <Button variant="outline" onClick={onSuspend}>
          Suspend
        </Button>
      );
    case "suspended":
    case "rejected":
      return <Button onClick={onRestore}>Restore</Button>;
    default:
      return null;
  }
}

/* -------------------------------------------------------------- Primitives --- */

function BackLink() {
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit text-muted-foreground">
      <Link href="/manager/members">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Members
      </Link>
    </Button>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-7 w-24 animate-pulse rounded bg-muted/40" />
      <div className="h-32 animate-pulse rounded-lg border bg-muted/40" />
      <div className="h-9 w-64 animate-pulse rounded-lg bg-muted/40" />
      <div className="h-48 animate-pulse rounded-lg border bg-muted/40" />
    </div>
  );
}
