# Scire — Design System ("Confident SaaS")

The visual language for the whole app. Every page and component must conform.
This is the single reference for the UI overhaul; when in doubt, match this.

## The direction

Confident, modern product SaaS — looks like a funded startup, not a template.
We dropped the generic blue→indigo→purple gradient look entirely. No gradient
blobs, no glassmorphism / "liquid glass", no dotted-grid backdrops, no Inter.

- **Palette:** warm off-white canvas, rich near-black ink, a single confident
  **emerald** brand color used deliberately (not everywhere).
- **Type:** **Schibsted Grotesk** for display/headings (tight tracking, heavy
  weights), **Hanken Grotesk** for body/UI. Numbers are tabular for data tables.
- **Surfaces:** crisp tactile cards — hairline border + a real, low-spread
  shadow. Generous padding. Sharp, intentional, never floaty.
- **Motion:** restrained. One orchestrated page-load stagger on marketing
  surfaces; quick (150–200ms) hover/press feedback in the app. Respect
  `prefers-reduced-motion`. See the `web-motion-design` conventions.

## Color tokens (defined in `globals.css`)

Use semantic tokens — NEVER hardcode `blue-*`, `indigo-*`, `purple-*`, `gray-*`.

| Token | Use |
|---|---|
| `bg-background` / `text-foreground` | page canvas / primary text |
| `bg-card` / `text-card-foreground` | card & panel surfaces |
| `bg-primary` / `text-primary-foreground` | primary CTAs (emerald) |
| `bg-secondary` / `text-secondary-foreground` | secondary buttons/chips |
| `bg-muted` / `text-muted-foreground` | subtle fills / secondary text |
| `bg-accent` / `text-accent-foreground` | hover fills, soft emerald wash |
| `border-border`, `bg-input`, `ring-ring` | hairlines, inputs, focus |
| `bg-destructive` / red scale | errors / destructive |

### Brand + status helper classes (added in `@theme`)

- `bg-brand` / `text-brand` / `border-brand` — emerald brand (= primary).
- `bg-brand-subtle` / `text-brand-strong` — soft emerald wash bg / deep emerald text.
  Use for **active nav**, selected states, key highlights, brand chips.
- Status colors (Tailwind built-ins are fine for these semantic roles):
  - pending / waiting → `amber` (e.g. `bg-amber-50 text-amber-700 ring-amber-600/20`)
  - approved / verified / positive → **brand** (emerald) tokens
  - rejected / error / destructive → `bg-destructive` / `red`

## Replacement rules for the overhaul (apply mechanically)

- Active sidebar/nav item: `bg-blue-50 text-blue-700` → `bg-brand-subtle text-brand-strong`
- Count badges / dots: `bg-blue-600 text-white` → `bg-brand text-primary-foreground`
- Avatars: `bg-blue-100 text-blue-700` → `bg-brand-subtle text-brand-strong`
- Links / inline emphasis: `text-blue-600 hover:underline` → `text-brand hover:text-brand-strong`
- Focus rings: `ring-blue-500` → `ring-ring`
- Icon accents: `text-blue-600` → `text-brand`
- Any remaining `gray-*` → the matching neutral token (`text-muted-foreground`,
  `border-border`, etc.).

## Typography scale

- Page title (h1): `font-display text-2xl/3xl font-semibold tracking-tight`
- Section heading (h2): `font-display text-lg font-semibold tracking-tight`
- Body: default (Hanken Grotesk), `text-sm`/`text-base`
- Numeric / IDs / hours: `tabular-nums` (and `font-mono` for raw IDs/SHAs)
- Marketing hero: `font-display text-5xl/7xl font-bold tracking-[-0.02em]`

## Components

- Use the shared `@/components/ui/*` primitives (Button, Card, Badge, Input,
  Select, Dialog, Alert). They're already token-driven — don't re-style them
  per page. If a page needs a variant, add it to the primitive, don't fork it.
- **Cards:** `Card` is the tactile surface — border + shadow-sm. Group related
  content in cards; don't float bare text on the canvas.
- **Buttons:** `default` = emerald CTA, `outline` = secondary, `ghost` = tertiary.
- **PageHeader pattern:** every app page opens with a title (font-display) +
  one-line muted description, optional action button on the right.

## Don'ts

- ❌ gradient blobs, blurred color orbs, `animate-pulse` background decals
- ❌ glassmorphism / heavy backdrop-blur as decoration
- ❌ Inter, Roboto, Arial, Space Grotesk, system-ui as the brand face
- ❌ purple/indigo/blue accents anywhere
- ❌ rainbow of accent colors — emerald is the only brand hue; amber/red are
  reserved for status semantics only
