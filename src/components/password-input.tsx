"use client";

import { forwardRef, useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PasswordInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "type"
> & {
  /** Helper text rendered under the field (e.g. "At least 10 characters"). */
  helper?: string;
};

/** Password field with a lucide Eye/EyeOff visibility toggle and optional helper line. */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ helper, className, id, ...props }, ref) {
    const [visible, setVisible] = useState(false);
    const fallbackId = useId();
    const inputId = id ?? fallbackId;
    const helperId = helper ? `${inputId}-helper` : undefined;

    return (
      <div>
        <div className="relative">
          <Input
            ref={ref}
            id={inputId}
            type={visible ? "text" : "password"}
            aria-describedby={helperId}
            className={cn("pr-10", className)}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {visible ? (
              <EyeOff aria-hidden className="h-4 w-4" />
            ) : (
              <Eye aria-hidden className="h-4 w-4" />
            )}
          </button>
        </div>
        {helper ? (
          <p id={helperId} className="mt-1.5 text-xs text-muted-foreground">
            {helper}
          </p>
        ) : null}
      </div>
    );
  }
);
