import Link from "next/link";
import { BrandMark } from "@/components/brand";
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
 * Centered auth card on the Scire gradient backdrop. The BrandMark links home.
 * Shared by every /auth/** page so they read as one surface.
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
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-white px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 -left-32 h-[40rem] w-[40rem] rounded-full bg-gradient-to-tr from-blue-200 via-indigo-200 to-purple-200 opacity-70 blur-3xl motion-safe:animate-pulse" />
        <div className="absolute -bottom-32 -right-32 h-[40rem] w-[40rem] rounded-full bg-gradient-to-tr from-indigo-200 via-purple-200 to-pink-200 opacity-70 blur-3xl motion-safe:animate-pulse" />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] opacity-40 [background-size:16px_16px]"
      />

      <div className={cn("w-full max-w-md", className)}>
        <Card className="shadow-xl">
          <CardHeader className="items-center text-center">
            <Link
              href="/"
              aria-label="Scire home"
              className="mx-auto rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <BrandMark className="h-11 w-11" />
            </Link>
            {badge ? <div className="mt-3">{badge}</div> : null}
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-gray-900">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-1 text-sm text-gray-600">{subtitle}</p>
            ) : null}
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
        {footer ? (
          <div className="mt-6 text-center text-sm text-gray-600">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}
