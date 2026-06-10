"use client";

import { useState } from "react";

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
import { updateOrg, type AdminOrg } from "@/services/api/admin";

/** Keep only slug-legal characters as the user edits. */
function sanitizeSlug(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9-]/g, "");
}

/**
 * Edit-org dialog (§6.3 settings) — rename and/or change the slug. The slug must
 * match `^[a-z0-9]+(-[a-z0-9]+)*$`; a 409 (name/slug clash with another active
 * org) surfaces inline. Returns the updated org to the caller.
 */
export function OrgSettingsDialog({
  open,
  onOpenChange,
  org,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  org: AdminOrg;
  onSaved: (org: AdminOrg) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open ? (
          <Form org={org} onClose={() => onOpenChange(false)} onSaved={onSaved} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Form({
  org,
  onClose,
  onSaved,
}: {
  org: AdminOrg;
  onClose: () => void;
  onSaved: (org: AdminOrg) => void;
}) {
  const [name, setName] = useState(org.name);
  const [slug, setSlug] = useState(org.slug);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameValid = name.trim().length > 0;
  const slugValid = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);
  const changed = name.trim() !== org.name || slug !== org.slug;
  const valid = nameValid && slugValid && changed;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setPending(true);
    setError(null);
    try {
      const patch: { name?: string; slug?: string } = {};
      if (name.trim() !== org.name) patch.name = name.trim();
      if (slug !== org.slug) patch.slug = slug;
      const updated = await updateOrg(org.id, patch);
      onSaved(updated);
      onClose();
    } catch (err) {
      const e2 = err as { status?: number; message?: string };
      if (e2.status === 409) {
        setError("Another organization already uses that name or slug.");
      } else {
        setError(e2.message || "Couldn't save changes.");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Organization settings</DialogTitle>
        <DialogDescription>
          Changing the slug updates the org&apos;s identifier. The name is shown in signup dropdowns.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-3">
        <div className="space-y-1.5">
          <Label htmlFor="settings-name">Name</Label>
          <Input
            id="settings-name"
            value={name}
            disabled={pending}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            aria-invalid={!nameValid ? true : undefined}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="settings-slug">Slug</Label>
          <Input
            id="settings-slug"
            value={slug}
            disabled={pending}
            onChange={(e) => setSlug(sanitizeSlug(e.target.value))}
            aria-invalid={slug.length > 0 && !slugValid ? true : undefined}
          />
          <p className="text-xs text-muted-foreground">Lowercase letters, numbers and hyphens.</p>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || !valid}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </DialogFooter>
    </form>
  );
}
