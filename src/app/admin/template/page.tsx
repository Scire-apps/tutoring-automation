"use client";

import { useEffect, useState } from "react";
import { Info, LayoutTemplate, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  listTemplate,
  createTemplateSubject,
  updateTemplateSubject,
  deleteTemplateSubject,
  subjectLabel,
  type TemplateSubject,
  type SubjectInput,
} from "@/services/api/admin";
import { ApiError } from "@/services/api";
import { SubjectDialog } from "@/components/manager/subject-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Pagination } from "@/components/manager/pagination";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { ManageSubject } from "@/services/api/manage";

const PAGE_SIZE = 25;

/**
 * Subject template (§6.3) — the DEFAULT catalog copied into each new org at
 * creation. Flat CRUD over `subject_templates` with a banner clarifying edits
 * affect FUTURE org creations only (existing catalogs are unaffected). Reuses the
 * manager `SubjectDialog` for add/edit; delete is a confirm (template rows aren't
 * referenced by sessions, so a hard delete is safe here).
 */
export default function AdminTemplatePage() {
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [reloadToken, setReloadToken] = useState(0);

  const [data, setData] = useState<{ items: TemplateSubject[]; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TemplateSubject | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TemplateSubject | null>(null);

  useEffect(() => {
    const id = setTimeout(() => {
      setQ(qInput.trim());
      setOffset(0);
    }, 300);
    return () => clearTimeout(id);
  }, [qInput]);

  // Stale-while-revalidate: the spinner only shows on first paint.
  useEffect(() => {
    let ignore = false;
    listTemplate({ q: q || undefined, limit: PAGE_SIZE, offset })
      .then((res) => {
        if (ignore) return;
        setData({ items: res.items, total: res.total });
        setError(null);
      })
      .catch((e: unknown) => {
        if (ignore) return;
        setError(e instanceof Error ? e.message || "Couldn't load the template." : "Couldn't load the template.");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [q, offset, reloadToken]);

  const reload = () => setReloadToken((t) => t + 1);
  const rows = data?.items ?? [];
  const total = data?.total ?? 0;

  function clash(err: unknown): Error {
    if (err instanceof ApiError && (err.code === "invalid_state" || err.status === 409)) {
      return new Error("A template subject with that name, category and grade already exists.");
    }
    return err instanceof ApiError ? new Error(err.message || "Could not save.") : (err as Error);
  }

  async function handleAdd(input: SubjectInput) {
    try {
      await createTemplateSubject(input);
    } catch (err) {
      throw clash(err);
    }
    toast.success("Template subject added.");
    reload();
  }

  async function handleEdit(input: SubjectInput) {
    if (!editTarget) return;
    try {
      await updateTemplateSubject(editTarget.id, input);
    } catch (err) {
      throw clash(err);
    }
    toast.success("Template subject updated.");
    reload();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteTemplateSubject(deleteTarget.id);
    toast.success("Template subject removed.");
    reload();
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight">
            <LayoutTemplate className="size-6 text-brand" aria-hidden="true" />
            Subject template
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The default subject catalog new organizations start from.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="size-4" aria-hidden="true" />
          Add subject
        </Button>
      </header>

      <Alert>
        <Info className="size-4" />
        <AlertDescription>
          Changes here apply to newly created organizations only — existing catalogs are unaffected.
        </AlertDescription>
      </Alert>

      <div className="relative max-w-sm">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          className="pl-8"
          placeholder="Search template subjects"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
        />
      </div>

      {loading && !data ? (
        <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading template…
        </div>
      ) : error && !data ? (
        <p className="py-12 text-sm text-destructive">{error}</p>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {q ? "No template subjects match your search." : "The template is empty."}
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y">
            {rows.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                  {subjectLabel(t)}
                </span>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button variant="ghost" size="sm" onClick={() => setEditTarget(t)}>
                    <Pencil className="size-4" aria-hidden="true" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => setDeleteTarget(t)}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Pagination total={total} limit={PAGE_SIZE} offset={offset} onOffsetChange={setOffset} />

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
        open={deleteTarget !== null}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null);
        }}
        title={`Remove ${deleteTarget ? subjectLabel(deleteTarget) : "subject"}?`}
        description="It is removed from the default template. Existing org catalogs keep their copies."
        confirmLabel="Remove subject"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  );
}

/** Adapt a TemplateSubject to the manager `SubjectDialog`'s `ManageSubject` prop. */
function toManageSubject(t: TemplateSubject): ManageSubject {
  return { id: t.id, name: t.name, category: t.category, grade_level: t.grade_level, active: true };
}
