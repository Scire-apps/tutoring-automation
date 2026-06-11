"use client";

import { useEffect, useState } from "react";
import { Info, KeyRound, Loader2 } from "lucide-react";

import { listAccounts, personName, type AdminAccount } from "@/services/api/admin";
import { formatDate } from "@/components/manager/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

/**
 * Admins (§6.3) — a READ-ONLY list of the seeded Scire admins (via
 * `GET /api/admin/accounts?kind=admin`). Admin accounts are never created or
 * mutated from the panel; the note points at the seed script.
 */
export default function AdminAdminsPage() {
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    listAccounts({ kind: "admin", limit: 100 })
      .then((res) => {
        if (ignore) return;
        setAdmins(res.items);
        setError(null);
      })
      .catch((e: unknown) => {
        if (ignore) return;
        setError(e instanceof Error ? e.message || "Couldn't load admins." : "Couldn't load admins.");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight">
          <KeyRound className="size-6 text-brand" aria-hidden="true" />
          Admins
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">The Scire platform administrators.</p>
      </header>

      <Alert>
        <Info className="size-4" />
        <AlertDescription>
          Admins are created directly by the Scire team via the Supabase Admin API (
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
            createUser
          </code>{" "}
          with <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">app_metadata.kind = &quot;admin&quot;</code>
          ) — there is no signup path.
        </AlertDescription>
      </Alert>

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading admins…
        </div>
      ) : error ? (
        <p className="py-12 text-sm text-destructive">{error}</p>
      ) : admins.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No admins found.
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y">
            {admins.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-sm font-semibold text-brand-strong uppercase">
                  {(a.first_name[0] ?? "") + (a.last_name[0] ?? "") || "?"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{personName(a)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {a.email} · since {formatDate(a.created_at)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
