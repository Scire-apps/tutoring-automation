"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookMarked, Loader2, Pencil, Plus, RotateCcw, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/services/api";
import {
  archiveSubject,
  createSubject,
  listSubjects,
  reactivateSubject,
  updateSubject,
  type ManageSubject,
  type SubjectInput,
} from "@/services/api/manage";
import { SubjectDialog } from "@/components/manager/subject-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useList } from "@/components/manager/use-list";

export default function ManagerSubjectsPage() {
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  // Dialog state.
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ManageSubject | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<ManageSubject | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setQ(qInput.trim()), 300);
    return () => clearTimeout(id);
  }, [qInput]);

  const reload = useCallback(() => setReloadToken((t) => t + 1), []);

  const { data, loading, error } = useList(
    () => listSubjects({ includeUsage: true, q: q || undefined }),
    [q, reloadToken],
    "Could not load the catalog.",
  );
  const subjects = useMemo(() => data?.items ?? [], [data]);

  // Group by subject name (§5.11 "catalog grouped by name").
  const groups = useMemo(() => {
    const map = new Map<string, ManageSubject[]>();
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

  const handleAdd = async (input: SubjectInput) => {
    try {
      await createSubject(input);
    } catch (err) {
      if (err instanceof ApiError && (err.code === "invalid_state" || err.status === 409)) {
        throw new Error("A subject with that name, category and grade already exists.");
      }
      throw err instanceof ApiError ? new Error(err.message || "Could not add the subject.") : err;
    }
    toast.success("Subject added.");
    reload();
  };

  const handleEdit = async (input: SubjectInput) => {
    if (!editTarget) return;
    try {
      await updateSubject(editTarget.id, input);
    } catch (err) {
      if (err instanceof ApiError && (err.code === "invalid_state" || err.status === 409)) {
        throw new Error("A subject with that name, category and grade already exists.");
      }
      throw err instanceof ApiError ? new Error(err.message || "Could not save changes.") : err;
    }
    toast.success("Subject updated.");
    reload();
  };

  const handleArchive = async () => {
    if (!archiveTarget) return;
    try {
      await archiveSubject(archiveTarget.id);
      toast.success("Subject archived.");
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message || "Could not archive." : "Could not archive.");
      throw err;
    }
  };

  const handleReactivate = async (s: ManageSubject) => {
    try {
      await reactivateSubject(s.id);
      toast.success("Subject reactivated.");
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message || "Could not reactivate." : "Could not reactivate.");
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight">
            <BookMarked className="size-6 text-brand" aria-hidden="true" />
            Subjects
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your organization&apos;s tutoring catalog. Members request and claim sessions in these
            subjects.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="size-4" aria-hidden="true" />
          Add subject
        </Button>
      </header>

      <div className="relative max-w-sm">
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

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading catalog…
        </div>
      ) : error ? (
        <p className="py-12 text-sm text-destructive">{error}</p>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {q ? "No subjects match your search." : "No subjects yet. Add your first subject."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.name}>
              <h2 className="mb-2 font-display text-sm font-semibold tracking-tight text-muted-foreground">{group.name}</h2>
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

      {/* Add */}
      <SubjectDialog open={addOpen} onOpenChange={setAddOpen} onSubmit={handleAdd} />
      {/* Edit */}
      <SubjectDialog
        open={editTarget !== null}
        onOpenChange={(o) => {
          if (!o) setEditTarget(null);
        }}
        initial={editTarget}
        onSubmit={handleEdit}
      />
      {/* Archive (usage-warning) */}
      <ConfirmDialog
        open={archiveTarget !== null}
        onOpenChange={(o) => {
          if (!o) setArchiveTarget(null);
        }}
        title={`Archive ${archiveTarget ? labelOf(archiveTarget) : "subject"}?`}
        description={
          archiveTarget ? (
            <>
              {archiveTarget.open_sessions} open{" "}
              {archiveTarget.open_sessions === 1 ? "request references" : "requests reference"} this
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
  subject: ManageSubject;
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
        <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
          {subject.open_sessions} open · {subject.approved_members} approved
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

/** The "category · grade" tail under the grouped name (e.g. "IB · Grade 11"). */
function labelTail(s: ManageSubject): string {
  const bits: string[] = [];
  if (s.category) bits.push(s.category);
  if (s.grade_level != null) bits.push(`Grade ${s.grade_level}`);
  return bits.join(" · ");
}

/** Full label for dialog copy ("Mathematics · IB · Grade 11"). */
function labelOf(s: ManageSubject): string {
  const tail = labelTail(s);
  return tail ? `${s.name} · ${tail}` : s.name;
}
