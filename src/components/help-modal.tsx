"use client";

import { useState } from "react";
import { LifeBuoy } from "lucide-react";

import type { UrgencyLevel } from "@/types/api";
import { submitHelp } from "@/services/api/member";
import { ApiError } from "@/services/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { BRAND } from "@/lib/brand";

const URGENCY_OPTIONS: { value: UrgencyLevel; label: string }[] = [
  { value: "low", label: "Low — whenever someone gets a chance" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High — I'm stuck and need help soon" },
];

/**
 * "Ask for help" modal (§4.9). Active members send an urgency + free-text message
 * to their org's manager help queue via `POST /api/member/help`. Submit is
 * PESSIMISTIC: the modal stays open and shows an inline error if the send fails,
 * so nothing is lost. On success it resets and closes.
 */
export function HelpModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [urgency, setUrgency] = useState<UrgencyLevel>("normal");
  const [description, setDescription] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setUrgency("normal");
    setDescription("");
    setError(null);
  }

  async function handleSubmit() {
    const trimmed = description.trim();
    if (trimmed.length === 0) {
      setError("Please describe what you need help with.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await submitHelp({ urgency, description: trimmed });
      reset();
      onOpenChange(false);
    } catch (e) {
      // Pessimistic: keep the modal open, surface the failure, preserve input.
      setError(
        e instanceof ApiError
          ? e.message || "Couldn't send your message. Please try again."
          : "Couldn't send your message. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display tracking-tight">
            <LifeBuoy className="size-5 text-brand" aria-hidden="true" />
            Ask for help
          </DialogTitle>
          <DialogDescription>
            Send a note to a manager at your organization. For account questions
            you can also email {BRAND.contactEmail}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="help-urgency">Urgency</Label>
            <Select
              value={urgency}
              onValueChange={(v) => setUrgency(v as UrgencyLevel)}
            >
              <SelectTrigger id="help-urgency" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {URGENCY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="help-description">What do you need help with?</Label>
            <textarea
              id="help-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Describe your question or issue…"
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={pending}>
            {pending ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
