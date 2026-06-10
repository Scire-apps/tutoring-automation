# Scire

**Peer tutoring, organized.** Scire is a multi-tenant platform that runs a school or club's peer-tutoring program: members post requests when they need help, tutor the subjects they're approved for, and get every volunteer hour verified — all in one account. It is sold to organizations (typically one per school) and operated by the Scire team.

This is a single **Next.js 16 (App Router) monolith** — the UI and the entire API live in one app — backed by **Supabase** (Postgres + Auth + RLS).

## Organizations & the three-role model

Every user and every row of data belongs to exactly one **organization**. Organizations are created and managed only by the Scire team. There are three mutually exclusive account kinds:

- **Member** — public signup. A member picks their organization from a list (any email domain) and verifies their email like normal. After verification the account loads its dashboard but is **inactive** — zero capabilities, no org data — until a manager (or the Scire team) admits it. Once active, a member can BOTH request tutoring AND give tutoring, but only for subjects a manager has approved them to teach.
- **Manager** (per-org) — teachers and club execs. Managers never tutor or get tutored; they get an org administration panel: admit and manage members, approve members to teach specific subjects, email members, oversee sessions, verify completed sessions and award volunteer hours, approve other pending managers of their org, and manage the org's subject catalog. Managers sign up through a dedicated pathway and are activated by the Scire team (or by an existing active manager of the same org).
- **Admin** (app-wide, the Scire team) — no public signup; admin accounts are seeded directly in the database. Admins sign in through a secret, never-linked page and get a master panel: organization CRUD, manager assignment/activation, and global oversight.

## Architecture

- **Monolith.** App Router pages under `src/app/**` (React 19, Tailwind v4, shadcn/ui new-york, lucide-react) and route handlers under `src/app/api/**/route.ts` — every endpoint the app needs, same-origin (`/api/...`).
- **RLS-first.** Authorization's primary boundary is **Postgres Row Level Security**, not the API layer. API routes act as the signed-in user — the user's JWT is forwarded to PostgREST via an RLS-bound client — so any request a route would block, the database blocks too. Tenancy is structural: `org_id` lives on every org-scoped table and RLS policies are join-free `org_id = (select private.helper())` checks against `SECURITY DEFINER` helpers in a non-exposed `private` schema. State-machine legality (session lifecycle, approval decisions, profile status changes) is enforced by guard triggers, and the three append-only logs (`audit_log`, `email_log`, `volunteer_hours_ledger`) have `UPDATE`/`DELETE` revoked from every role including `service_role`.
- **`src/proxy.ts`** (Next 16's middleware convention) is **UX-only routing**. It reads identity from JWT claims (`getClaims()`, verified locally via JWKS — zero network/DB per request) and redirects between zones; it does **no** data authorization, org scoping, or status enforcement. Each zone layout re-verifies server-side, and every `/api/**` route self-guards. JWT claims are routing hints only — they never appear in any RLS policy.
- **Auth.** Supabase Auth with cookie-native sessions (`@supabase/ssr`). Profiles are provisioned by a `handle_new_user` database trigger on signup (no API call). The identity endpoint is `GET /api/auth/me`.
- **Email.** Transactional email goes through Mailjet (`src/lib/email.ts`); recipients are always resolved from DB rows, never request bodies. Sends are dispatched after the response and logged to `email_log`.

## Local development

1. Copy env and fill in real values:
   ```bash
   cp .env.example .env.local
   ```
   You'll need a Supabase URL + anon/secret keys, Mailjet keys, a Mailjet-verified `EMAIL_FROM`, a `NEXT_PUBLIC_SITE_URL` (`http://localhost:3000` locally), and a `CRON_SECRET`. See `.env.example` for the full annotated list. `EMAIL_DRY_RUN=1` skips real email dispatch (sends are still logged) — handy for local work and smokes.
2. Install and run:
   ```bash
   npm install
   npm run dev
   ```
   Open http://localhost:3000.
3. **Supabase dashboard** one-time setup is required before anything works — see the manual checklist below.

## Database

Schema, RLS policies, helper functions, and seed/reference data are managed entirely through Supabase migrations.

- **Migration mirror policy.** Every applied migration is committed to `supabase/migrations/<version>_<name>.sql`. This directory is the source of truth in the repo and must match the live project's migration history (the tail of `list_migrations`). Never apply a migration to the database without committing its mirror, and never edit an already-applied migration in place — add a new one.
- **Enum-evolution convention.** Adding a value to an enum is a standalone migration (`ALTER TYPE ... ADD VALUE`). Removing or renaming an enum value requires a type-swap migration dance (create the new type, convert columns, drop the old type) — do not attempt it as a one-liner.
- **Template-snapshot semantics.** New organizations get their subject catalog (`org_subjects`) **copied** from the default template (`subject_templates`) at creation time — it is a point-in-time snapshot, not a live link. Editing the template afterward affects **future** org creations only; existing orgs are untouched and managers curate their own catalog from then on.
- **Org-purge caveat.** There is **no organization hard-delete in v1** — orgs are archived (`archived_at`), which hides them from signup dropdowns and freezes new activity while retaining logins and hours history. The console-level cascade escape hatch deletes an org's `profiles` rows but does **NOT** delete the corresponding `auth.users` rows (there is no `public → auth.users` FK), so a true purge also needs an Admin-API pass to delete those auth users. A proper purge script is a post-v1 concern.

## Seeding & admin accounts

Two seed paths, by design:

1. **Default subject template** — shipped as the final rebuild migration (reference data, idempotent `ON CONFLICT DO NOTHING`). It is not a script.
2. **Scire admins** — created by the Scire team via the **Supabase Admin API**; there is no signup path and no committed credentials. One call against the GoTrue admin endpoint (`POST {SUPABASE_URL}/auth/v1/admin/users`, authorized with the secret key from the environment) with a body of the shape:

   ```json
   {
     "email": "<admin email>",
     "password": "<strong password — supplied out of band, never committed>",
     "email_confirm": true,
     "app_metadata": { "kind": "admin" },
     "user_metadata": { "first_name": "…", "last_name": "…" }
   }
   ```

   The `handle_new_user` trigger materializes the admin profile (`kind = admin`, `status = active`, no org) from `app_metadata` — `app_metadata` is service-role-only, so this path cannot be reached from public signup.

All other data is created through the application itself: admins create organizations from the admin panel (each gets a snapshot of the subject template), managers and members register through the public flows.

> **Bootstrap dependency.** At least **one admin AND at least one active organization** must exist before any public signup works — the `handle_new_user` trigger raises if a member/manager signs up against a missing or non-active org. The runbook order is: **apply migrations → register the Supabase auth hook (manual) → create an admin (Admin API, above) → sign in at `/admin-login` → create the first organization from the admin panel**.

## Scripts

- `npm run dev` — dev server
- `npm run build` — production build (type-checked + linted)
- `npm run start` — run the production build
- `npm run lint` — ESLint
- `npm run gen:types` — regenerate `src/types/database.ts` from the live schema

## Deployment

Deploy to **Vercel**.

- **Environment variables.** Set everything from `.env.example` in the Vercel project before merging: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SITE_URL`, `MAILJET_API_KEY`, `MAILJET_API_SECRET`, `EMAIL_FROM`, `EMAIL_FROM_NAME`, `ORG_EMAIL_DAILY_CAP`, and `CRON_SECRET`. Leave `EMAIL_DRY_RUN` unset in production.
- **Cron.** The daily session-reminder job is configured in `vercel.json` (`/api/cron/send-reminders`, schedule `0 13 * * *`). It is gated by `CRON_SECRET` (`Authorization: Bearer <CRON_SECRET>`, compared with `crypto.timingSafeEqual`). Generate the secret with `openssl rand -hex 32` and set it both in Vercel and as the cron's bearer.

## Supabase manual checklist

Some setup lives in the Supabase dashboard and is **not** captured by migrations. Do these once per project before launch:

- Register the custom **access-token hook** (`public.custom_access_token_hook`) under Authentication → Hooks. Without it, JWTs carry no `user_kind` claim and routing breaks.
- Set **Site URL** and **Redirect URLs** to include `/auth/confirm` for production, `http://localhost:3000/**`, and any preview wildcards.
- Turn **Confirm email** ON; configure **custom SMTP** (Mailjet) so verification/reset emails actually send at volume.
- Pre-launch hardening: asymmetric JWT signing keys; Scire-branded email templates using the `token_hash` link format; **leaked-password protection ON** with **minimum password length 10**; secure email change ON; refresh-token rotation ON; anonymous and OAuth sign-ins OFF.
- Verify the Mailjet sender domain (SPF/DKIM) and confirm `EMAIL_FROM` matches a verified sender.
