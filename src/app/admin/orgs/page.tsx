"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, ChevronRight, Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { listOrgs, type AdminOrg } from "@/services/api/admin";
import { CreateOrgDialog } from "@/components/admin/create-org-dialog";
import { Pagination } from "@/components/manager/pagination";
import { useList } from "@/components/manager/use-list";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PAGE_SIZE = 25;

type StatusFilter = "active" | "archived" | "all";

/**
 * Organizations (§6.3) — a paginated list with member/manager/session counts, a
 * status filter (active by default; archived / all widen it), debounced search,
 * and the Create-Org dialog. Rows link to the org detail. No hard delete anywhere
 * (archive lives on the detail's settings tab).
 */
export default function AdminOrgsPage() {
  const router = useRouter();
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [offset, setOffset] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => {
      setQ(qInput.trim());
      setOffset(0);
    }, 300);
    return () => clearTimeout(id);
  }, [qInput]);

  const { data, loading, error } = useList(
    () => listOrgs({ q: q || undefined, status, limit: PAGE_SIZE, offset }),
    [q, status, offset],
    "Couldn't load organizations.",
  );
  const orgs = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight">
            <Building2 className="size-6 text-brand" aria-hidden="true" />
            Organizations
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every organization on Scire. Create one to onboard a school or club.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" aria-hidden="true" />
          Create organization
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            className="pl-8"
            placeholder="Search organizations"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as StatusFilter);
            setOffset(0);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading organizations…
        </div>
      ) : error ? (
        <p className="py-12 text-sm text-destructive">{error}</p>
      ) : orgs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {q ? "No organizations match your search." : "No organizations yet. Create your first."}
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y">
            {orgs.map((org) => (
              <OrgRow key={org.id} org={org} />
            ))}
          </ul>
        </Card>
      )}

      <Pagination total={total} limit={PAGE_SIZE} offset={offset} onOffsetChange={setOffset} />

      <CreateOrgDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(org) => {
          toast.success(`${org.name} created.`);
          router.push(`/admin/orgs/${org.id}`);
        }}
      />
    </div>
  );
}

function OrgRow({ org }: { org: AdminOrg }) {
  const archived = org.archived_at != null;
  return (
    <li>
      <Link
        href={`/admin/orgs/${org.id}`}
        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50"
      >
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-medium text-foreground">
            <span className="truncate">{org.name}</span>
            {archived ? (
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-inset ring-border">
                Archived
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            <span className="font-mono">{org.slug}</span>
            {" · "}
            {org.members_count} {org.members_count === 1 ? "member" : "members"}
            {" · "}
            {org.managers_count} {org.managers_count === 1 ? "manager" : "managers"}
            {" · "}
            {org.sessions_count} {org.sessions_count === 1 ? "session" : "sessions"}
          </p>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>
    </li>
  );
}
