"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Mail,
  Send,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/services/api";
import {
  getEmailBatch,
  listEmailBatches,
  listMembers,
  listSubjects,
  memberName,
  previewRecipients,
  sendEmail,
  subjectLabel,
  type EmailScope,
  type ManageMember,
  type ManageSubject,
} from "@/services/api/manage";
import { TabBar, formatDateTime } from "@/components/manager/ui";
import { Pagination } from "@/components/manager/pagination";
import { useList } from "@/components/manager/use-list";

const BODY_MAX = 10_000;

type Tab = "compose" | "history";

export default function ManagerEmailsPage() {
  const [tab, setTab] = useState<Tab>("compose");
  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Mail className="size-6 text-blue-600" aria-hidden="true" />
          Emails
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Send a plain-text message to members of your organization. Every send is logged.
        </p>
      </header>

      <TabBar
        tabs={[
          { value: "compose", label: "Compose" },
          { value: "history", label: "History" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "compose" ? <ComposeTab onSent={() => setTab("history")} /> : <HistoryTab />}
    </div>
  );
}

// --- Compose -----------------------------------------------------------------

const SCOPES: { value: EmailScope; label: string; hint: string }[] = [
  { value: "all_active", label: "All active members", hint: "Everyone admitted to your org." },
  { value: "pending", label: "Pending members", hint: "Awaiting admission." },
  {
    value: "approved_for_subject",
    label: "Approved for a subject",
    hint: "Tutors approved in a chosen subject.",
  },
  { value: "member_ids", label: "Selected members", hint: "Pick individual members." },
];

function ComposeTab({ onSent }: { onSent: () => void }) {
  const [scope, setScope] = useState<EmailScope>("all_active");
  const [subjectId, setSubjectId] = useState<string>("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  // Option lists.
  const [subjects, setSubjects] = useState<ManageSubject[]>([]);
  const [members, setMembers] = useState<ManageMember[]>([]);

  // Live recipient-count preview.
  const [preview, setPreview] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    let ignore = false;
    Promise.all([listSubjects({}), listMembers({ limit: 100 })])
      .then(([subs, mem]) => {
        if (ignore) return;
        setSubjects(subs.items.filter((s) => s.active));
        setMembers(mem.items);
      })
      .catch(() => {
        // best-effort
      });
    return () => {
      ignore = true;
    };
  }, []);

  // Recompute the server-side preview whenever the audience changes (debounced).
  // The `member_ids` audience needs no round-trip — its count is the local
  // selection, derived below — and `approved_for_subject` waits for a subject. In
  // both skip cases the effect makes no synchronous state write (the rule forbids
  // it); state flips only inside the timeout/promise continuations.
  useEffect(() => {
    const needsFetch =
      scope === "all_active" ||
      scope === "pending" ||
      (scope === "approved_for_subject" && !!subjectId);
    if (!needsFetch) return;

    let ignore = false;
    const id = setTimeout(() => {
      if (ignore) return;
      setPreviewing(true);
      previewRecipients({ scope, subject_id: subjectId || undefined })
        .then((r) => {
          if (!ignore) setPreview(r.count);
        })
        .catch(() => {
          if (!ignore) setPreview(null);
        })
        .finally(() => {
          if (!ignore) setPreviewing(false);
        });
    }, 250);
    return () => {
      ignore = true;
      clearTimeout(id);
    };
  }, [scope, subjectId]);

  // The displayed recipient count: local selection for member_ids; null (→ prompt)
  // for approved_for_subject until a subject is chosen; else the fetched preview.
  const recipientCount =
    scope === "member_ids"
      ? memberIds.length
      : scope === "approved_for_subject" && !subjectId
        ? null
        : preview;

  const subjectValid = subject.trim().length > 0;
  const bodyValid = body.trim().length > 0 && body.length <= BODY_MAX;
  const audienceValid =
    scope === "approved_for_subject"
      ? !!subjectId
      : scope === "member_ids"
        ? memberIds.length > 0
        : true;
  const canSend = subjectValid && bodyValid && audienceValid && !sending && (recipientCount ?? 0) > 0;

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      const res = await sendEmail({
        scope,
        subject_id: scope === "approved_for_subject" ? subjectId : undefined,
        member_ids: scope === "member_ids" ? memberIds : undefined,
        subject: subject.trim(),
        body,
      });
      toast.success(`Sent to ${res.recipient_count} ${res.recipient_count === 1 ? "member" : "members"}.`);
      setSubject("");
      setBody("");
      setMemberIds([]);
      onSent();
    } catch (err) {
      if (err instanceof ApiError && (err.code === "rate_limited" || err.status === 429)) {
        toast.error(
          err.message || "Your organization has reached its daily email limit. Try again tomorrow.",
        );
      } else {
        toast.error(err instanceof ApiError ? err.message || "Could not send. Please try again." : "Could not send. Please try again.");
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-5">
        {/* Audience */}
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-foreground">Audience</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {SCOPES.map((s) => {
              const active = scope === s.value;
              return (
                <label
                  key={s.value}
                  className={
                    "flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors " +
                    (active ? "border-blue-400 bg-blue-50/60" : "hover:bg-accent/50")
                  }
                >
                  <input
                    type="radio"
                    name="audience"
                    className="mt-0.5 size-4 accent-blue-600"
                    checked={active}
                    onChange={() => setScope(s.value)}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">{s.label}</span>
                    <span className="block text-xs text-muted-foreground">{s.hint}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* Conditional audience inputs */}
        {scope === "approved_for_subject" ? (
          <div className="space-y-2">
            <Label htmlFor="email-subject-picker">Subject</Label>
            <Select value={subjectId || undefined} onValueChange={setSubjectId}>
              <SelectTrigger id="email-subject-picker" className="w-full">
                <SelectValue placeholder="Choose a subject" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {subjectLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {scope === "member_ids" ? (
          <MemberMultiSelect members={members} selected={memberIds} onChange={setMemberIds} />
        ) : null}

        {/* Recipient-count preview */}
        <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
          <Users className="size-4 text-muted-foreground" aria-hidden="true" />
          {previewing ? (
            <span className="text-muted-foreground">Counting recipients…</span>
          ) : recipientCount == null ? (
            <span className="text-muted-foreground">Choose an audience to see the recipient count.</span>
          ) : (
            <span className="text-foreground">
              <span className="font-semibold">{recipientCount}</span>{" "}
              {recipientCount === 1 ? "recipient" : "recipients"}
            </span>
          )}
        </div>

        {/* Subject */}
        <div className="space-y-2">
          <Label htmlFor="email-subject">Subject</Label>
          <Input
            id="email-subject"
            placeholder="Subject line"
            value={subject}
            disabled={sending}
            onChange={(e) => setSubject(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Your organization name is added as a prefix automatically.
          </p>
        </div>

        {/* Body */}
        <div className="space-y-2">
          <Label htmlFor="email-body">Message</Label>
          <textarea
            id="email-body"
            rows={8}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            placeholder="Write your message in plain text…"
            value={body}
            disabled={sending}
            maxLength={BODY_MAX}
            onChange={(e) => setBody(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Plain text only — it&apos;s wrapped in the Scire template with a footer. {body.length.toLocaleString()}/
            {BODY_MAX.toLocaleString()}.
          </p>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSend} disabled={!canSend}>
            {sending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Sending…
              </>
            ) : (
              <>
                <Send className="size-4" aria-hidden="true" />
                Send to {recipientCount ?? 0}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** A searchable multi-select for the "Selected members" audience (§5.12). */
function MemberMultiSelect({
  members,
  selected,
  onChange,
}: {
  members: ManageMember[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? members.filter(
          (m) =>
            `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) ||
            m.email.toLowerCase().includes(q),
        )
      : members;
    return list.slice(0, 50);
  }, [members, query]);

  function toggle(id: string) {
    onChange(selectedSet.has(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="member-search">Members</Label>
      <Input
        id="member-search"
        placeholder="Search members"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {selected.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {selected.length} selected ·{" "}
          <button type="button" className="text-blue-600 hover:underline" onClick={() => onChange([])}>
            Clear
          </button>
        </p>
      ) : null}
      <div className="max-h-56 overflow-y-auto rounded-md border">
        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">No members match.</p>
        ) : (
          <ul className="divide-y">
            {filtered.map((m) => (
              <li key={m.id}>
                <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 hover:bg-accent/50">
                  <input
                    type="checkbox"
                    className="size-4 accent-blue-600"
                    checked={selectedSet.has(m.id)}
                    onChange={() => toggle(m.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-foreground">{memberName(m)}</span>
                    <span className="block truncate text-xs text-muted-foreground">{m.email}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// --- History -----------------------------------------------------------------

const PAGE_SIZE = 25;

function HistoryTab() {
  const [offset, setOffset] = useState(0);
  const [openBatch, setOpenBatch] = useState<string | null>(null);

  const { data, loading, error } = useList(
    () => listEmailBatches({ limit: PAGE_SIZE, offset }),
    [offset],
    "Could not load history.",
  );
  const batches = data?.items ?? [];
  const total = data?.total ?? 0;

  if (openBatch) {
    return <BatchDetail batchId={openBatch} onBack={() => setOpenBatch(null)} />;
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Loading history…
      </div>
    );
  }
  if (error) return <p className="py-12 text-sm text-destructive">{error}</p>;
  if (batches.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No emails sent yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden p-0">
        <ul className="divide-y">
          {batches.map((b) => (
            <li key={b.batch_id}>
              <button
                type="button"
                onClick={() => setOpenBatch(b.batch_id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{b.subject}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {formatDateTime(b.created_at)}
                    {b.sender_name ? ` · ${b.sender_name}` : ""} · {audienceLabel(b.scope)} ·{" "}
                    {b.recipient_count} {b.recipient_count === 1 ? "recipient" : "recipients"}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </Card>
      <Pagination total={total} limit={PAGE_SIZE} offset={offset} onOffsetChange={setOffset} />
    </div>
  );
}

function BatchDetail({ batchId, onBack }: { batchId: string; onBack: () => void }) {
  const { data: detail, loading, error } = useList(
    () => getEmailBatch(batchId),
    [batchId],
    "Could not load this email.",
  );

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        All emails
      </button>

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading…
        </div>
      ) : error || !detail ? (
        <p className="py-12 text-sm text-destructive">{error ?? "Not found."}</p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{detail.batch.subject}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {formatDateTime(detail.batch.created_at)}
                {detail.batch.sender_name ? ` · ${detail.batch.sender_name}` : ""} ·{" "}
                {audienceLabel(detail.batch.scope)}
              </p>
              {detail.body ? (
                <p className="rounded-md bg-muted/40 p-3 text-sm whitespace-pre-wrap text-foreground">
                  {detail.body}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Recipients
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({detail.recipients.length})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y">
                {detail.recipients.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      {r.recipient_name ? (
                        <p className="truncate text-sm text-foreground">{r.recipient_name}</p>
                      ) : null}
                      <p className="truncate text-xs text-muted-foreground">{r.recipient_email}</p>
                    </div>
                    {r.status === "sent" ? (
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-green-700">
                        <CheckCircle2 className="size-3.5" aria-hidden="true" />
                        Sent
                      </span>
                    ) : (
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-red-600">
                        <XCircle className="size-3.5" aria-hidden="true" />
                        Failed
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

/** Human label for a stored batch scope value. */
function audienceLabel(scope: string): string {
  switch (scope) {
    case "all_active":
      return "All active members";
    case "pending":
      return "Pending members";
    case "approved_for_subject":
      return "Approved for a subject";
    case "member_ids":
      return "Selected members";
    default:
      return scope;
  }
}
