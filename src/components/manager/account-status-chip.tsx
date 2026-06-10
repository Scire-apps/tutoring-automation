import type { AccountStatus } from "@/types/api";
import { cn } from "@/lib/utils";
import { statusLabel } from "@/lib/manager-format";

const TONE: Record<AccountStatus, string> = {
  active: "bg-green-50 text-green-700 ring-green-600/20",
  pending: "bg-amber-50 text-amber-700 ring-amber-600/20",
  suspended: "bg-orange-50 text-orange-700 ring-orange-600/20",
  rejected: "bg-red-50 text-red-700 ring-red-600/20",
};

/** A small pill for an account status (member or manager) — manager-panel use. */
export function AccountStatusChip({
  status,
  className,
}: {
  status: AccountStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        TONE[status],
        className,
      )}
    >
      {statusLabel(status)}
    </span>
  );
}
