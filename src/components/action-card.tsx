"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

/**
 * A quick-action tile used in the dashboard's "Quick actions" row (§4.3). Renders
 * an icon, title and one-line description as either a link (when `href` is set)
 * or a button (when `onClick` is set). Disabled tiles dim and stop interaction —
 * used for non-active members whose actions are gated.
 */
export function ActionCard({
  icon: Icon,
  title,
  description,
  href,
  onClick,
  disabled = false,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const body = (
    <Card
      className={cn(
        "group h-full gap-3 px-5 py-5 text-left transition-shadow",
        disabled
          ? "cursor-not-allowed opacity-50"
          : "hover:border-brand/40 hover:shadow-md",
        className,
      )}
    >
      <span className="flex size-10 items-center justify-center rounded-lg bg-brand-subtle text-brand">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </Card>
  );

  if (disabled) {
    return (
      <div aria-disabled="true" className="block">
        {body}
      </div>
    );
  }

  if (href) {
    return (
      <Link href={href} className="block focus-visible:outline-none">
        {body}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full text-left focus-visible:outline-none"
    >
      {body}
    </button>
  );
}
