import { cn } from "@/lib/utils";

/**
 * The shared gradient-blob backdrop — de-duplicates the gradient layers that the
 * legacy dashboards copy-pasted (§4.10). Renders two soft, blurred, animated
 * blobs behind the page content. Decorative only: fixed, non-interactive, and
 * hidden from assistive tech.
 *
 * Drop it once near the top of a page/layout; content sits above it via normal
 * stacking (the backdrop is pinned with a negative z-index).
 */
export function PageBackdrop({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed inset-0 -z-10 overflow-hidden",
        className,
      )}
    >
      <div className="absolute -top-24 -left-24 size-[32rem] rounded-full bg-gradient-to-tr from-blue-200 via-indigo-200 to-purple-200 opacity-60 blur-3xl motion-safe:animate-pulse" />
      <div className="absolute -right-24 -bottom-24 size-[32rem] rounded-full bg-gradient-to-tr from-indigo-200 via-purple-200 to-pink-200 opacity-60 blur-3xl motion-safe:animate-pulse" />
    </div>
  );
}
