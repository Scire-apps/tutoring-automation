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
import type { SubjectInput, ManageSubject } from "@/services/api/manage";

/**
 * Add / Edit org-subject dialog (§5.11). Name is required; category and grade are
 * optional (NULL dims support club orgs). The triple (name, category, grade) is
 * unique — a clash surfaces as a 409 the caller maps to an inline error here.
 * Renames propagate via FK (no substring matching). Re-mounts per open so it seeds
 * cleanly from `initial` without a sync effect.
 */
export function SubjectDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set the dialog is in Edit mode, prefilled from this subject. */
  initial?: ManageSubject | null;
  onSubmit: (input: SubjectInput) => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <SubjectForm initial={initial ?? null} onClose={() => onOpenChange(false)} onSubmit={onSubmit} />
      </DialogContent>
    </Dialog>
  );
}

function SubjectForm({
  initial,
  onClose,
  onSubmit,
}: {
  initial: ManageSubject | null;
  onClose: () => void;
  onSubmit: (input: SubjectInput) => Promise<void>;
}) {
  const editing = initial !== null;
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [grade, setGrade] = useState(initial?.grade_level != null ? String(initial.grade_level) : "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gradeNum = grade.trim() === "" ? null : Number(grade);
  const gradeValid = gradeNum === null || (Number.isInteger(gradeNum) && gradeNum >= 1 && gradeNum <= 13);
  const valid = name.trim().length > 0 && gradeValid;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setPending(true);
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        category: category.trim() || null,
        grade_level: gradeNum,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the subject.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{editing ? "Edit subject" : "Add subject"}</DialogTitle>
        <DialogDescription>
          Name is required. Leave category or grade blank for subjects that don&apos;t need them
          (e.g. a club). The name + category + grade combination must be unique.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-3">
        <div className="space-y-2">
          <Label htmlFor="subject-name">Name</Label>
          <Input
            id="subject-name"
            placeholder="e.g. Mathematics"
            value={name}
            disabled={pending}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            aria-invalid={error ? true : undefined}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="subject-category">
              Category <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="subject-category"
              placeholder="e.g. IB"
              value={category}
              disabled={pending}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="subject-grade">
              Grade <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="subject-grade"
              type="number"
              inputMode="numeric"
              min={1}
              max={13}
              placeholder="9–12"
              value={grade}
              disabled={pending}
              onChange={(e) => setGrade(e.target.value)}
              aria-invalid={grade.trim() !== "" && !gradeValid ? true : undefined}
            />
          </div>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || !valid}>
          {pending ? "Saving…" : editing ? "Save changes" : "Add subject"}
        </Button>
      </DialogFooter>
    </form>
  );
}
