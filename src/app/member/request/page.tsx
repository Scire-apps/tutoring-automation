"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, HelpCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/services/api";
import { createRequest, listSubjects, type MemberSubject } from "@/services/api/member";

const NOTES_MIN = 10;
// Sentinel for the catalog's NULL category/grade dimensions (club orgs) — Radix
// Select forbids an empty-string value, so NULL rungs carry this token instead.
const NONE = "__none__";

/** Distinct, sorted values for one cascade rung, preserving the NULL option. */
function distinct<T extends string | number | null>(values: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const v of values) {
    const key = v === null ? NONE : String(v);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(v);
    }
  }
  return out;
}

export default function MemberRequestPage() {
  const router = useRouter();

  const [catalog, setCatalog] = useState<MemberSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Cascade selections.
  const [name, setName] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null); // NONE token for NULL
  const [grade, setGrade] = useState<string | null>(null); // NONE token for NULL

  const [isEll, setIsEll] = useState(false);
  const [language, setLanguage] = useState("");
  const [location, setLocation] = useState<"online" | "in_person" | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const items = await listSubjects();
        if (!active) return;
        // Only active catalog rows can take new requests.
        setCatalog(items.filter((s) => s.active !== false));
      } catch {
        if (active) setLoadError("Could not load your organization's subjects.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // --- Cascade derivations ---------------------------------------------------
  const names = useMemo(
    () => distinct(catalog.map((s) => s.name)).sort((a, b) => a.localeCompare(b)),
    [catalog],
  );

  const categories = useMemo(() => {
    if (!name) return [];
    return distinct(catalog.filter((s) => s.name === name).map((s) => s.category)).sort(
      sortNullable,
    );
  }, [catalog, name]);

  // Auto-collapse single-option rungs by DERIVING the effective value rather than
  // writing state from an effect: if a rung offers exactly one choice, it is
  // pre-resolved. The Select shows the effective value, so the user still sees it.
  const effectiveCategory = useMemo(
    () => (category !== null ? category : categories.length === 1 ? toToken(categories[0]) : null),
    [category, categories],
  );

  const grades = useMemo(() => {
    if (!name || effectiveCategory === null) return [];
    const cat = effectiveCategory === NONE ? null : effectiveCategory;
    return distinct(
      catalog
        .filter((s) => s.name === name && s.category === cat)
        .map((s) => s.grade_level),
    ).sort(sortNullableNum);
  }, [catalog, name, effectiveCategory]);

  const effectiveGrade = useMemo(
    () => (grade !== null ? grade : grades.length === 1 ? toToken(grades[0]) : null),
    [grade, grades],
  );

  // Resolve the selection to exactly one org_subject_id.
  const resolved = useMemo<MemberSubject | null>(() => {
    if (!name || effectiveCategory === null || effectiveGrade === null) return null;
    const cat = effectiveCategory === NONE ? null : effectiveCategory;
    const grd = effectiveGrade === NONE ? null : Number(effectiveGrade);
    const matches = catalog.filter(
      (s) => s.name === name && s.category === cat && s.grade_level === grd,
    );
    return matches.length === 1 ? matches[0] : null;
  }, [catalog, name, effectiveCategory, effectiveGrade]);

  const trimmedNotes = notes.trim();
  const notesValid = trimmedNotes.length >= NOTES_MIN;
  const canSubmit = !!resolved && !!location && notesValid && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolved || !location || !notesValid) return;
    setSubmitting(true);
    try {
      await createRequest({
        org_subject_id: resolved.org_subject_id,
        location_preference: location,
        notes: trimmedNotes,
        language: isEll && language.trim() ? language.trim() : null,
      });
      toast.success("Request posted — tutors can now claim it.");
      router.push("/member/dashboard");
    } catch (err) {
      if (err instanceof ApiError && err.code === "open_request_limit") {
        toast.error("You already have 5 open requests. Close one before posting another.");
      } else if (err instanceof ApiError) {
        toast.error(err.message || "Could not post your request. Please try again.");
      } else {
        toast.error("Could not post your request. Please try again.");
      }
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <Link
        href="/member/dashboard"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to dashboard
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display tracking-tight">
            <HelpCircle className="size-5 text-brand" aria-hidden="true" />
            Get help
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Tell us what you need help with. Once you post, approved tutors in your
            organization can claim your request.
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Loading subjects…
            </div>
          ) : loadError ? (
            <p className="py-8 text-sm text-destructive">{loadError}</p>
          ) : names.length === 0 ? (
            <p className="py-8 text-sm text-muted-foreground">
              Your organization has not published any subjects yet. Ask a manager to add
              one, or email contact@tutoringapp.ca.
            </p>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit}>
              {/* --- Cascading subject pickers --- */}
              <div className="space-y-2">
                <Label htmlFor="subject-name">Subject</Label>
                <Select
                  value={name ?? undefined}
                  onValueChange={(v) => {
                    setName(v);
                    setCategory(null);
                    setGrade(null);
                  }}
                >
                  <SelectTrigger id="subject-name" className="w-full">
                    <SelectValue placeholder="Choose a subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {names.map((n) => (
                      <SelectItem key={n} value={n}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {name && categories.length > 0 ? (
                <div className="space-y-2">
                  <Label htmlFor="subject-category">Stream</Label>
                  <Select
                    value={effectiveCategory ?? undefined}
                    onValueChange={(v) => {
                      setCategory(v);
                      setGrade(null);
                    }}
                  >
                    <SelectTrigger id="subject-category" className="w-full">
                      <SelectValue placeholder="Choose a stream" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={toToken(c)} value={toToken(c)}>
                          {c ?? "General"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              {name && effectiveCategory !== null && grades.length > 0 ? (
                <div className="space-y-2">
                  <Label htmlFor="subject-grade">Grade</Label>
                  <Select
                    value={effectiveGrade ?? undefined}
                    onValueChange={(v) => setGrade(v)}
                  >
                    <SelectTrigger id="subject-grade" className="w-full">
                      <SelectValue placeholder="Choose a grade" />
                    </SelectTrigger>
                    <SelectContent>
                      {grades.map((g) => (
                        <SelectItem key={toToken(g)} value={toToken(g)}>
                          {g === null ? "Any grade" : `Grade ${g}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              {/* --- ELL --- */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-input accent-[oklch(0.56_0.114_159)]"
                    checked={isEll}
                    onChange={(e) => setIsEll(e.target.checked)}
                  />
                  I&apos;m an English Language Learner (ELL)
                </label>
                {isEll ? (
                  <div className="space-y-1.5 pl-6">
                    <Label htmlFor="language" className="text-xs text-muted-foreground">
                      First language (optional)
                    </Label>
                    <input
                      id="language"
                      type="text"
                      className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                      placeholder="e.g. Mandarin"
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                    />
                  </div>
                ) : null}
              </div>

              {/* --- Location --- */}
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Where would you meet?</legend>
                <div className="flex gap-3">
                  {(
                    [
                      { value: "online", label: "Online" },
                      { value: "in_person", label: "In person" },
                    ] as const
                  ).map((opt) => (
                    <label
                      key={opt.value}
                      className={
                        "flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors " +
                        (location === opt.value
                          ? "border-brand bg-brand-subtle text-brand-strong"
                          : "border-input text-muted-foreground hover:bg-muted/40")
                      }
                    >
                      <input
                        type="radio"
                        name="location"
                        value={opt.value}
                        className="sr-only"
                        checked={location === opt.value}
                        onChange={() => setLocation(opt.value)}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              {/* --- Notes --- */}
              <div className="space-y-2">
                <Label htmlFor="notes">What do you need help with?</Label>
                <textarea
                  id="notes"
                  rows={4}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                  placeholder="Describe the topic, the assignment, or what you're stuck on (at least 10 characters)."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  aria-invalid={notes.length > 0 && !notesValid ? true : undefined}
                />
                <p className="text-xs text-muted-foreground">
                  {notes.length > 0 && !notesValid
                    ? `Add a little more detail — at least ${NOTES_MIN} characters.`
                    : "Be specific so a tutor knows whether they can help."}
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={!canSubmit}>
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Posting…
                  </>
                ) : (
                  "Post request"
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// --- helpers -----------------------------------------------------------------

function toToken(v: string | number | null): string {
  return v === null ? NONE : String(v);
}

function sortNullable(a: string | null, b: string | null): number {
  if (a === null) return 1;
  if (b === null) return -1;
  return a.localeCompare(b);
}

function sortNullableNum(a: number | null, b: number | null): number {
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}
