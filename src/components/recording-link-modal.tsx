"use client";

import { useState } from "react";
import { Link2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/services/api";
import { saveRecording } from "@/services/api/member";

/**
 * Recording-link dialog (§4.7). The claimer (tutor) pastes the session recording
 * URL. The link is editable ONLY in `scheduled` or `needs_changes` — once the
 * session is `completed` the manager is reviewing the link, so the field locks
 * (the correction path is `needs_changes`). Recording and completion are
 * DECOUPLED: this dialog only persists the URL via `PUT .../recording`; marking
 * the session complete is a separate action on the session list.
 */
export function RecordingLinkModal({
  sessionId,
  status = "scheduled",
  currentUrl,
  open,
  onOpenChange,
  onSaved,
}: {
  sessionId: string;
  /** Session status; the modal only opens for editable rows, so it defaults to
   * an editable state when the caller (e.g. the dashboard) doesn't pass one. */
  status?: string;
  currentUrl: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful save so the parent can refetch its rows. */
  onSaved?: (url: string) => void | Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Re-mounted with each open (Radix unmounts content on close), so the
            input seeds freshly from the current URL without a sync effect. */}
        <RecordingForm
          sessionId={sessionId}
          status={status}
          initialUrl={currentUrl ?? ""}
          onClose={() => onOpenChange(false)}
          onSaved={onSaved}
        />
      </DialogContent>
    </Dialog>
  );
}

function RecordingForm({
  sessionId,
  status,
  initialUrl,
  onClose,
  onSaved,
}: {
  sessionId: string;
  status: string;
  initialUrl: string;
  onClose: () => void;
  onSaved?: (url: string) => void;
}) {
  const editable = status === "scheduled" || status === "needs_changes";
  const [url, setUrl] = useState(initialUrl);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      setError("Paste the recording link before saving.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveRecording(sessionId, { recording_url: trimmed });
      toast.success("Link saved ✓");
      onSaved?.(trimmed);
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message || "Could not save the link. Please try again."
          : "Could not save the link. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Link2 className="size-5 text-blue-600" aria-hidden="true" />
          Recording link
        </DialogTitle>
        <DialogDescription>
          {editable
            ? "You can edit this link until you mark the session complete."
            : "This session is being reviewed — the link can no longer be edited."}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-2">
        <Label htmlFor="recording-url">Recording URL</Label>
        <Input
          id="recording-url"
          type="url"
          inputMode="url"
          placeholder="https://drive.google.com/…"
          value={url}
          disabled={!editable || saving}
          onChange={(e) => setUrl(e.target.value)}
          aria-invalid={error ? true : undefined}
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
          {editable ? "Cancel" : "Close"}
        </Button>
        {editable ? (
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save link"}
          </Button>
        ) : null}
      </DialogFooter>
    </>
  );
}
