import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

type Tone = "neutral" | "amber" | "red" | "green";

const TONE_STYLES: Record<Tone, { wrap: string; icon: string }> = {
  neutral: { wrap: "bg-muted", icon: "text-muted-foreground" },
  amber: { wrap: "bg-amber-50", icon: "text-amber-600" },
  red: { wrap: "bg-red-50", icon: "text-red-600" },
  green: { wrap: "bg-green-50", icon: "text-green-600" },
};

/**
 * Shared gate card ({icon, heading, body, actions}) used by the pending-manager
 * page, the manager-suspended state, and the member pending/rejected/suspended
 * dashboard states. Renders as a centered, modal-styled card.
 */
export function AccountStatusCard({
  icon: Icon,
  heading,
  body,
  actions,
  tone = "neutral",
  className,
}: {
  icon: LucideIcon;
  heading: string;
  body: React.ReactNode;
  actions?: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  const toneStyle = TONE_STYLES[tone];

  return (
    <Card className={cn("w-full max-w-md text-center shadow-xl", className)}>
      <CardContent className="flex flex-col items-center gap-4">
        <span
          className={cn(
            "flex size-14 items-center justify-center rounded-full",
            toneStyle.wrap,
          )}
        >
          <Icon className={cn("size-7", toneStyle.icon)} aria-hidden="true" />
        </span>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {heading}
        </h1>
        <div className="text-sm text-muted-foreground">{body}</div>
        {actions ? (
          <div className="flex w-full flex-col gap-2 pt-2 sm:flex-row sm:justify-center">
            {actions}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
