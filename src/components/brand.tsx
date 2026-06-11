import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";

/**
 * Inline-SVG brand mark: an emerald rounded square with a lighter inset corner
 * and a white display "S". No file asset, so it renders identically server- and
 * client-side. Drop real artwork into `public/brand/` and swap only this
 * component.
 */
export function BrandMark({
  className,
  size = 32,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label={BRAND.name}
      className={cn("shrink-0", className)}
    >
      <rect width="32" height="32" rx="9" className="fill-brand" />
      {/* Soft inset highlight in the corner for a tactile, lit feel. */}
      <path d="M32 0 H20 A12 12 0 0 1 32 12 Z" className="fill-white/15" />
      <text
        x="16"
        y="17.5"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="var(--font-schibsted), var(--font-hanken), system-ui, sans-serif"
        fontSize="19"
        fontWeight="800"
        letterSpacing="-0.5"
        className="fill-white"
      >
        S
      </text>
    </svg>
  );
}

/**
 * Styled brand wordmark — the "Scire" name set in the display face. Ink by
 * default (pairs with the emerald mark); pass a color class to override.
 */
export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-display font-semibold tracking-tight text-foreground",
        className,
      )}
    >
      {BRAND.name}
    </span>
  );
}
