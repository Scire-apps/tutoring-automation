import Link from "next/link";
import { BrandMark, BrandWordmark } from "@/components/brand";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type AuthShellProps = {
  title: string;
  subtitle?: React.ReactNode;
  /** Rendered between the BrandMark and the title (e.g. a "Manager registration" badge). */
  badge?: React.ReactNode;
  children: React.ReactNode;
  /** Rendered under the card (cross-links, helper text). */
  footer?: React.ReactNode;
  className?: string;
};

/**
 * Centered auth card on the Scire "Confident SaaS" canvas: warm off-white, a
 * faint emerald wash from the top, and a hairline grid — no gradient blobs. The
 * BrandMark + wordmark link home. Shared by every /auth/** page so they read as
 * one surface.
 */
export function AuthShell({
  title,
  subtitle,
  badge,
  children,
  footer,
  className,
}: AuthShellProps) {
  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-background px-4 py-10">
      {/* Atmosphere — emerald light from the top, faint grid texture. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(70%_100%_at_50%_0%,var(--brand-subtle),transparent_72%)]" />
        <div className="absolute inset-0 opacity-60 [mask-image:radial-gradient(120%_80%_at_50%_0%,black,transparent_70%)] bg-[linear-gradient(to_right,oklch(0.5_0.01_160/0.045)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.5_0.01_160/0.045)_1px,transparent_1px)] [background-size:44px_44px]" />
      </div>

      <div className={cn("w-full max-w-md animate-rise-in", className)}>
        <Card className="shadow-lg">
          <CardHeader className="items-center text-center">
            <Link
              href="/"
              aria-label="Scire home"
              className="mx-auto flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <BrandMark className="h-10 w-10" />
              <BrandWordmark className="text-xl" />
            </Link>
            {badge ? <div className="mt-4">{badge}</div> : null}
            <h1 className="font-display mt-4 text-2xl font-semibold tracking-tight text-foreground">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
            ) : null}
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
        {footer ? (
          <div className="mt-6 text-center text-sm text-muted-foreground">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
