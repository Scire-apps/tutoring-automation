import { BrandMark, BrandWordmark } from "@/components/brand";
import { BRAND } from "@/lib/brand";

/**
 * Landing page — DEMOLITION PLACEHOLDER.
 *
 * A minimal Scire-branded server component that replaces the legacy marketing
 * page. The full landing experience (member + manager pathways,
 * hero, feature sections) is rebuilt in the admin/landing slice (§8.1); this
 * keeps the route green and on-brand until then.
 */
export default function Home() {
  return (
    <main className="grid min-h-screen place-items-center bg-white px-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <BrandMark size={56} />
        <BrandWordmark className="text-3xl" />
        <p className="max-w-md text-balance text-gray-600">{BRAND.tagline}</p>
      </div>
    </main>
  );
}
