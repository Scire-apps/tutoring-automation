# Tutoring Automation — LMS

A learning-management app for high-school tutoring clubs (HDSB / WOSS Tutoring). It connects **tutees** who request help, **tutors** who volunteer (and earn verified volunteer hours), and **admins** who approve tutor subjects, verify sessions, and award hours.

This is a single **Next.js 15 (App Router) monolith** — the UI and the entire API live in one app. It was migrated from a former split architecture (Flask API + separate Next.js frontend) into one standard Next.js application backed by **Supabase** (Postgres + Auth + RLS).

## Architecture

- **UI**: App Router pages under `src/app/**` (React 19, Tailwind v4, hand-written design system).
- **API**: route handlers under `src/app/api/**/route.ts` — every endpoint the app needs, same-origin (`/api/...`).
- **Server libs** (`src/lib/`):
  - `supabase/server.ts` — `createUserClient(token)` (RLS-bound, used by virtually all routes) and `createServiceClient()` (service-role; used only by the cron route).
  - `auth.ts` — `requireAuth` / `requireAdmin` request guards.
  - `domain.ts` — business rules (subject-approval matching, duration/availability validation, HDSB email scrubbing).
  - `email.ts` / `reminders.ts` — transactional email via Mailjet + the session-reminder job.
  - `subjects.ts` — master subject list.
- **Client** (`src/services/`): `supabase.ts` (browser client) and `api.ts` (typed fetch wrapper, same-origin).
- **Auth model**: Supabase Auth. Authorization is enforced by **Postgres Row Level Security**; API routes act as the signed-in user (their JWT is forwarded to PostgREST). Roles are derived from the `admins` / `tutors` / `tutees` tables.
- **Database**: schema, RLS policies, and helper functions are managed via Supabase migrations.

## Local development

1. Copy env: `cp .env.example .env.local` and fill in the values (Supabase URL + publishable/secret keys, Mailjet keys, a Mailjet-verified `EMAIL_FROM`, a `CRON_SECRET`). Keep `NEXT_PUBLIC_API_URL` **empty** (same-origin).
2. Install and run:
   ```bash
   npm install
   npm run dev
   ```
   Open http://localhost:3000.
3. **Supabase dashboard (one-time):** under Authentication → URL Configuration, add `http://localhost:3000/**` to the allowed redirect URLs (needed for email-confirmation / password-reset links during local testing).

## Roles & key flows

- **Tutee**: register (@hdsb.ca) → create a tutoring request → after a tutor accepts, set availability → attend the scheduled session. Can ask for help.
- **Tutor**: register → request subject certification → (once approved) browse open requests, accept one, schedule within the tutee's availability, then submit a recording link and mark complete. Earns volunteer hours once an admin verifies.
- **Admin**: approve/reject tutor subject certifications, manage tutor status, verify completed sessions and award volunteer hours, resolve help requests. Admins are school-scoped.

Note: a single `@hdsb.ca` email can hold both a tutor and a tutee account via `+tutor` / `+tutee` address tagging (transparently scrubbed for delivery and display).

## Scripts

- `npm run dev` — dev server
- `npm run build` — production build (type-checked + linted)
- `npm run start` — run the production build
- `npm run lint` — ESLint

## Deployment

Deploy to Vercel. The session-reminder cron is configured in `vercel.json` (`/api/cron/send-reminders`, gated by `CRON_SECRET`). Set all environment variables from `.env.example` in the Vercel project.
