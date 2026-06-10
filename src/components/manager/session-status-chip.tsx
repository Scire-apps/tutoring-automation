import type { SessionStatus } from "@/types/api";
import { cn } from "@/lib/utils";
import { sessionStatusLabel, sessionStatusTone } from "@/lib/manager-format";

/**
 * A NEUTRAL session-status pill for the manager/admin view (not role-aware — the
 * member `StatusChip` reads differently per side; managers see the objective
 * lifecycle state).
 */
export function SessionStatusChip({
  status,
  className,
}: {
  status: SessionStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        sessionStatusTone(status),
        className,
      )}
    >
      {sessionStatusLabel(status)}
    </span>
  );
}
