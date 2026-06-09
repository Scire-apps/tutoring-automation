import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";

/**
 * Inline-SVG brand mark: a blue-600 rounded square with a white "S". No file
 * asset, so it renders identically server- and client-side. Drop real artwork
 * into `public/brand/` and swap only this component.
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
      <rect width="32" height="32" rx="8" className="fill-blue-600" />
      <text
        x="16"
        y="17"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="var(--font-inter), system-ui, sans-serif"
        fontSize="20"
        fontWeight="700"
        className="fill-white"
      >
        S
      </text>
    </svg>
  );
}

/** Styled brand wordmark — the "Scire" name set in the brand color. */
export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-semibold tracking-tight text-blue-600",
        className,
      )}
    >
      {BRAND.name}
    </span>
  );
}
