"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarRange } from "lucide-react";

import { listOrgs, type AdminOrg } from "@/services/api/admin";
import { SessionList } from "@/components/admin/session-list";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

/**
 * Sessions (global oversight) — §6.3. Every tutoring session across all orgs, with
 * an org filter and the status multi-filter + search owned by the shared
 * `SessionList`. Each row expands to a detail with Verify ({awarded_hours}) and
 * Cancel ({reason}) actions. The org column is shown since this is cross-org.
 */
export default function AdminSessionsPage() {
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
      // Best-effort.
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
          <CalendarRange className="size-6 text-brand" aria-hidden="true" />
          Sessions
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tutoring sessions across every organization. Open a row to verify or cancel.
        </p>
      </header>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">Organization</Label>
        <Select value={orgId || "all"} onValueChange={(v) => setOrgId(v === "all" ? "" : v)}>
          <SelectTrigger className="w-full max-w-xs">
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
      </div>

      <SessionList baseFilters={{ org_id: orgId || undefined }} showOrg />
    </div>
  );
}
