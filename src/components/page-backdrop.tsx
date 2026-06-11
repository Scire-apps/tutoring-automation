import { cn } from "@/lib/utils";

/**
 * The shared app backdrop. Replaces the legacy animated gradient blobs with a
 * restrained "Confident SaaS" canvas: the warm off-white base plus a single
 * faint emerald wash bleeding from the top, and a barely-there hairline grid.
 * Decorative only: fixed, non-interactive, and hidden from assistive tech.
 *
 * Drop it once near the top of a page/layout; content sits above it via normal
 * stacking (the backdrop is pinned with a negative z-index).
 */
export function PageBackdrop({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background",
        className,
      )}
    >
      {/* Faint emerald light from the top — atmosphere without a color blob. */}
      <div className="absolute inset-x-0 top-0 h-80 bg-[radial-gradient(80%_100%_at_50%_0%,var(--brand-subtle),transparent_70%)] opacity-70" />
      {/* Whisper-thin grid for texture; fades out below the fold. */}
      <div className="absolute inset-0 opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent_55%)] bg-[linear-gradient(to_right,oklch(0.5_0.01_160/0.04)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.5_0.01_160/0.04)_1px,transparent_1px)] [background-size:44px_44px]" />
    </div>
  );
}
