// ESLint 9 flat config. Next 16 removed the `next lint` command, and the previous
// FlatCompat bridge to the legacy `next/core-web-vitals` + `next/typescript` shareable
// configs is incompatible with ESLint 9.31 (circular `react` plugin config fails the
// config validator). This uses the official flat configs directly: @next/eslint-plugin-next
// (core-web-vitals), typescript-eslint (recommended), and eslint-plugin-react-hooks —
// reproducing the prior rule surface, with the same five project rule overrides preserved.
import tseslint from "typescript-eslint";
import nextPlugin from "@next/eslint-plugin-next";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "supabase/**",
    ],
  },
  ...tseslint.configs.recommended,
  {
    plugins: {
      "@next/next": nextPlugin,
      react: reactPlugin,
      "react-hooks": reactHooks,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "react/no-unescaped-entities": "warn",
      "prefer-const": "warn",
    },
  },
];

export default eslintConfig;
