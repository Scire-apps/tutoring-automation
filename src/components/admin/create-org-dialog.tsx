"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createOrg,
  listTemplate,
  subjectLabel,
  type AdminOrg,
  type TemplateSubject,
} from "@/services/api/admin";

/** Slugify a name: lowercase, non-alnum → hyphens, collapse + trim hyphens. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Keep only the slug-legal characters as the user edits the field. */
function sanitizeSlug(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9-]/g, "");
}

/**
 * Create-Org dialog (§6.3). Name → an auto-slug the admin can override (kept to
 * `[a-z0-9-]`); a template-subject checklist, ALL pre-checked. On submit it POSTs
 * `{name, slug, seed_subject_ids}` — the handler copies the template via the
 * create_organization RPC and soft-deactivates any unchecked rows. A 409 (name or
 * slug clash) surfaces inline.
 *
 * The template can be large (228 default rows), so it's fetched once on open and
 * searchable; "Select all" / "Clear" toggle the whole filtered set.
 */
export function CreateOrgDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (org: AdminOrg) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open ? <CreateOrgForm onClose={() => onOpenChange(false)} onCreated={onCreated} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function CreateOrgForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (org: AdminOrg) => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  // Track whether the admin has hand-edited the slug (stop auto-deriving once they do).
  const slugTouched = useRef(false);

  const [template, setTemplate] = useState<TemplateSubject[]>([]);
  const [templateLoading, setTemplateLoading] = useState(true);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the whole template once (all rows, pre-checked).
  useEffect(() => {
    let ignore = false;
    listTemplate({ limit: 100, offset: 0 })
      .then(async (first) => {
        // The template has up to 228 rows; page through to gather them all.
        const all = [...first.items];
        let offset = first.items.length;
        while (offset < first.total) {
          const next = await listTemplate({ limit: 100, offset });
          all.push(...next.items);
          offset += next.items.length;
          if (next.items.length === 0) break;
        }
        if (ignore) return;
        setTemplate(all);
        setChecked(new Set(all.map((t) => t.id)));
        setTemplateLoading(false);
      })
      .catch(() => {
        if (ignore) return;
        setTemplateLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  function handleNameChange(next: string) {
    setName(next);
    if (!slugTouched.current) setSlug(slugify(next));
  }

  function handleSlugChange(next: string) {
    slugTouched.current = true;
    setSlug(sanitizeSlug(next));
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return template;
    return template.filter((t) => subjectLabel(t).toLowerCase().includes(needle));
  }, [template, q]);

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllFiltered() {
    setChecked((prev) => {
      const next = new Set(prev);
      for (const t of filtered) next.add(t.id);
      return next;
    });
  }

  function clearFiltered() {
    setChecked((prev) => {
      const next = new Set(prev);
      for (const t of filtered) next.delete(t.id);
      return next;
    });
  }

  const nameValid = name.trim().length > 0;
  const slugValid = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);
  const valid = nameValid && slugValid;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setPending(true);
    setError(null);
    try {
      // If every template row is checked, send 'all' (the handler's fast path);
      // otherwise send the explicit id list.
      const allChecked = template.length > 0 && checked.size === template.length;
      const org = await createOrg({
        name: name.trim(),
        slug,
        seed_subject_ids: allChecked ? "all" : Array.from(checked),
      });
      onCreated(org);
      onClose();
    } catch (err) {
      const e2 = err as { status?: number; code?: string; message?: string };
      if (e2.status === 409) {
        setError("An organization with that name or slug already exists.");
      } else {
        setError(e2.message || "Couldn't create the organization.");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle className="font-display tracking-tight">Create organization</DialogTitle>
        <DialogDescription>
          The chosen template subjects are copied into the new org&apos;s catalog. Managers can edit
          the catalog afterward.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-3">
        <div className="space-y-2">
          <Label htmlFor="org-name">Name</Label>
          <Input
            id="org-name"
            placeholder="e.g. Westside Secondary"
            value={name}
            disabled={pending}
            onChange={(e) => handleNameChange(e.target.value)}
            autoFocus
            aria-invalid={error && !nameValid ? true : undefined}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="org-slug">Slug</Label>
          <Input
            id="org-slug"
            placeholder="westside-secondary"
            value={slug}
            disabled={pending}
            onChange={(e) => handleSlugChange(e.target.value)}
            aria-invalid={slug.length > 0 && !slugValid ? true : undefined}
          />
          <p className="text-xs text-muted-foreground">
            Lowercase letters, numbers and hyphens. Auto-filled from the name; edit if you like.
          </p>
        </div>

        {/* Template-subject checklist */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Starter subjects</Label>
            <span className="text-xs text-muted-foreground">{checked.size} selected</span>
          </div>

          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              className="pl-8"
              placeholder="Filter subjects"
              value={q}
              disabled={pending || templateLoading}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3 text-xs">
            <button
              type="button"
              className="font-medium text-brand hover:underline disabled:opacity-50"
              onClick={selectAllFiltered}
              disabled={pending || templateLoading}
            >
              Select all
            </button>
            <button
              type="button"
              className="font-medium text-muted-foreground hover:underline disabled:opacity-50"
              onClick={clearFiltered}
              disabled={pending || templateLoading}
            >
              Clear
            </button>
          </div>

          <div className="max-h-48 overflow-y-auto rounded-md border">
            {templateLoading ? (
              <div className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Loading template…
              </div>
            ) : filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {template.length === 0 ? "No template subjects." : "No subjects match your filter."}
              </p>
            ) : (
              <ul className="divide-y">
                {filtered.map((t) => (
                  <li key={t.id}>
                    <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-accent/50">
                      <input
                        type="checkbox"
                        className="size-4 rounded border-input"
                        checked={checked.has(t.id)}
                        disabled={pending}
                        onChange={() => toggle(t.id)}
                      />
                      <span className="text-foreground">{subjectLabel(t)}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || !valid}>
          {pending ? "Creating…" : "Create organization"}
        </Button>
      </DialogFooter>
    </form>
  );
}
