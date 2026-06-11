"use client";

import { useCallback, useEffect, useState } from "react";
import { Users } from "lucide-react";

import { listOrgs, type AdminOrg } from "@/services/api/admin";
import { AccountList } from "@/components/admin/account-list";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Members (global) — §6.3. Cross-org member search (`?q`) with org + status
 * filters and the same per-row actions as the org-detail members tab (Admit /
 * Reject / Suspend / Restore / Delete). The shared `AccountList` owns search,
 * the status filter, pagination, and the action dialogs; this page adds the org
 * filter and pins the kind to `member`.
 */
export default function AdminMembersPage() {
  const [orgs, setOrgs] = useState<AdminOrg[]>([]);
  const [orgId, setOrgId] = useState<string>("");

  const loadOrgs = useCallback(async () => {
    try {
      const first = await listOrgs({ status: "all", limit: 100, offset: 0 });
      const all = [...first.items];
      let offset = first.items.length;
      while (offset < first.total && first.items.length > 0) {
        const next = await listOrgs({ status: "all", limit: 100, offset });
        all.push(...next.items);
        offset += next.items.length;
        if (next.items.length === 0) break;
      }
      setOrgs(all);
    } catch {
      // Best-effort; the table still loads without the org filter.
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async (post-await) data fetch
    void loadOrgs();
  }, [loadOrgs]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight">
          <Users className="size-6 text-brand" aria-hidden="true" />
          Members
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every member across all organizations. Filter by organization or status.
        </p>
      </header>

      <AccountList
        baseParams={{ kind: "member", org_id: orgId || undefined }}
        emptyLabel="No members found."
        toolbarExtra={
          <Select
            value={orgId || "all"}
            onValueChange={(v) => setOrgId(v === "all" ? "" : v)}
          >
            <SelectTrigger className="w-52">
              <SelectValue placeholder="All organizations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All organizations</SelectItem>
              {orgs.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
    </div>
  );
}
