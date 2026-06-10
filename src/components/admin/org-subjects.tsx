"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Plus, RotateCcw, Search } from "lucide-react";
import { toast } from "sonner";

import {
  listOrgSubjects,
  createOrgSubject,
  updateOrgSubject,
  type AdminSubject,
  type SubjectInput,
} from "@/services/api/admin";
import { ApiError } from "@/services/api";
import { SubjectDialog } from "@/components/manager/subject-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ManageSubject } from "@/services/api/manage";

/**
 * Admin org-catalog CRUD (§6.3 subjects tab) — shares the manager `SubjectDialog`
 * row components. Grouped by name; add / edit / archive (soft-deactivate when
 * referenced) / reactivate. NO hard delete exposed in the UI (the API
 * soft-deactivates referenced subjects). Scoped to one org via `orgId`.
 */
export function OrgSubjects({ orgId }: { orgId: string }) {
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  const [subjects, setSubjects] = useState<AdminSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminSubject | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<AdminSubject | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setQ(qInput.trim()), 300);
    return () => clearTimeout(id);
  }, [qInput]);

  // Stale-while-revalidate: the spinner only shows on first paint.
  useEffect(() => {
    let ignore = false;
    listOrgSubjects(orgId, { includeUsage: true, q: q || undefined })
      .then((res) => {
        if (ignore) return;
        setSubjects(res.items);
        setError(null);
      })
      .catch((e: unknown) => {
        if (ignore) return;
        setError(e instanceof Error ? e.message || "Couldn't load the catalog." : "Couldn't load the catalog.");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [orgId, q, reloadToken]);

  const reload = () => setReloadToken((t) => t + 1);

  const groups = useMemo(() => {
    const map = new Map<string, AdminSubject[]>();
    for (const s of subjects) {
      const list = map.get(s.name) ?? [];
      list.push(s);
      map.set(s.name, list);
    }
    return Array.from(map.entries())
      .map(([name, items]) => ({
        name,
        items: items.sort((a, b) => labelTail(a).localeCompare(labelTail(b))),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [subjects]);

  function clash(err: unknown): Error {
    if (err instanceof ApiError && (err.code === "invalid_state" || err.status === 409)) {
      return new Error("A subject with that name, category and grade already exists.");
    }
    return err instanceof ApiError ? new Error(err.message || "Could not save the subject.") : (err as Error);
  }

  async function handleAdd(input: SubjectInput) {
    try {
      await createOrgSubject(orgId, input);
    } catch (err) {
      throw clash(err);
    }
    toast.success("Subject added.");
    reload();
  }

  async function handleEdit(input: SubjectInput) {
    if (!editTarget) return;
    try {
      await updateOrgSubject(orgId, editTarget.id, input);
    } catch (err) {
      throw clash(err);
    }
    toast.success("Subject updated.");
    reload();
  }

  async function handleArchive() {
    if (!archiveTarget) return;
    try {
      await updateOrgSubject(orgId, archiveTarget.id, { active: false });
      toast.success("Subject archived.");
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message || "Could not archive." : "Could not archive.");
      throw err;
    }
  }

  async function handleReactivate(s: AdminSubject) {
    try {
      await updateOrgSubject(orgId, s.id, { active: true });
      toast.success("Subject reactivated.");
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message || "Could not reactivate." : "Could not reactivate.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative max-w-sm flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            className="pl-8"
            placeholder="Search subjects"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
          />
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="size-4" aria-hidden="true" />
          Add subject
        </Button>
      </div>

      {loading && subjects.length === 0 ? (
        <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading catalog…
        </div>
      ) : error ? (
        <p className="py-12 text-sm text-destructive">{error}</p>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {q ? "No subjects match your search." : "No subjects in this catalog yet."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.name}>
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{group.name}</h3>
              <Card className="overflow-hidden p-0">
                <ul className="divide-y">
                  {group.items.map((s) => (
                    <SubjectRow
                      key={s.id}
                      subject={s}
                      onEdit={() => setEditTarget(s)}
                      onArchive={() => setArchiveTarget(s)}
                      onReactivate={() => handleReactivate(s)}
                    />
                  ))}
                </ul>
              </Card>
            </section>
          ))}
        </div>
      )}

      <SubjectDialog open={addOpen} onOpenChange={setAddOpen} onSubmit={handleAdd} />
      <SubjectDialog
        open={editTarget !== null}
        onOpenChange={(o) => {
          if (!o) setEditTarget(null);
        }}
        initial={editTarget ? toManageSubject(editTarget) : null}
        onSubmit={handleEdit}
      />
      <ConfirmDialog
        open={archiveTarget !== null}
        onOpenChange={(o) => {
          if (!o) setArchiveTarget(null);
        }}
        title={`Archive ${archiveTarget ? labelOf(archiveTarget) : "subject"}?`}
        description={
          archiveTarget ? (
            <>
              {archiveTarget.open_sessions ?? 0} open{" "}
              {(archiveTarget.open_sessions ?? 0) === 1 ? "request references" : "requests reference"} this
              subject — they continue; no NEW requests or approval requests may use it. You can
              reactivate it any time.
            </>
          ) : null
        }
        confirmLabel="Archive subject"
        destructive
        onConfirm={handleArchive}
      />
    </div>
  );
}

function SubjectRow({
  subject,
  onEdit,
  onArchive,
  onReactivate,
}: {
  subject: AdminSubject;
  onEdit: () => void;
  onArchive: () => void;
  onReactivate: () => void;
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 font-medium text-foreground">
          {labelTail(subject) || subject.name}
          {!subject.active ? (
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-inset ring-border">
              Archived
            </span>
          ) : null}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {subject.open_sessions ?? 0} open · {subject.approved_members ?? 0} approved
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <Pencil className="size-4" aria-hidden="true" />
          Edit
        </Button>
        {subject.active ? (
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onArchive}>
            Archive
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={onReactivate}>
            <RotateCcw className="size-4" aria-hidden="true" />
            Reactivate
          </Button>
        )}
      </div>
    </li>
  );
}

/** Adapt an AdminSubject to the manager `SubjectDialog`'s `ManageSubject` prop. */
function toManageSubject(s: AdminSubject): ManageSubject {
  return {
    id: s.id,
    name: s.name,
    category: s.category,
    grade_level: s.grade_level,
    active: s.active,
  };
}

function labelTail(s: AdminSubject): string {
  const bits: string[] = [];
  if (s.category) bits.push(s.category);
  if (s.grade_level != null) bits.push(`Grade ${s.grade_level}`);
  return bits.join(" · ");
}

function labelOf(s: AdminSubject): string {
  const tail = labelTail(s);
  return tail ? `${s.name} · ${tail}` : s.name;
}
