"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ApiError } from "@/services/api";
import { completeSession } from "@/services/api/member";

/**
 * Decoupled "Complete session" action for the claimer (§4.7). Completion is
 * SEPARATE from saving the recording link — this only POSTs `.../complete`. The
 * button is disabled until a recording link exists (`hasRecording`), and the
 * server still guards: a 409 `recording_required` (e.g. the link was cleared)
 * surfaces as a toast and leaves the session untouched.
 */
export function CompleteSessionButton({
  sessionId,
  hasRecording,
  onCompleted,
  size = "sm",
  className,
}: {
  sessionId: string;
  hasRecording: boolean;
  /** Called after a successful complete so the parent can refetch/optimistically update. */
  onCompleted?: () => void;
  size?: "xs" | "sm" | "default" | "lg";
  className?: string;
}) {
  const [submitting, setSubmitting] = useState(false);

  const handleComplete = async () => {
    setSubmitting(true);
    try {
      await completeSession(sessionId);
      toast.success("Session marked complete — a manager will verify your hours.");
      onCompleted?.();
    } catch (err) {
      if (err instanceof ApiError && err.code === "recording_required") {
        toast.error("Add the recording link before marking the session complete.");
      } else if (err instanceof ApiError && err.code === "invalid_state") {
        toast.error("This session can no longer be completed.");
      } else {
        toast.error("Could not complete the session. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Button
      type="button"
      size={size}
      className={className}
      onClick={handleComplete}
      disabled={submitting || !hasRecording}
      title={hasRecording ? undefined : "Add the recording link first"}
    >
      {submitting ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Completing…
        </>
      ) : (
        <>
          <CheckCircle2 className="size-4" aria-hidden="true" />
          Complete session
        </>
      )}
    </Button>
  );
}
