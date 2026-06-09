import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Types are validated at build time (the codebase is type-clean). ESLint runs too;
  // remaining items are non-blocking `no-explicit-any`/unused-var warnings.
};

export default nextConfig;
