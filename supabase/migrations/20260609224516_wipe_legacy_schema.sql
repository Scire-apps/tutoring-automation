-- Scire teardown (§9.1). Explicit ordered drops, children-first; NOT
-- `DROP SCHEMA public CASCADE` (public carries Supabase-managed grants).
-- Valid ONLY under G1's asserted preconditions: exactly the 3 throwaway test
-- users, 0 storage objects/buckets, every auth.* FK ON DELETE CASCADE, no
-- custom auth-schema triggers. NEVER run on a DB with real users.

-- (1) Drop the 14 legacy tables, children-first. CASCADE clears their 42
-- policies / 12 triggers / indexes / FKs in one shot.
drop table if exists public.help_questions cascade;
drop table if exists public.communications cascade;
drop table if exists public.session_recordings cascade;
drop table if exists public.past_jobs cascade;
drop table if exists public.awaiting_verification_jobs cascade;
drop table if exists public.tutoring_jobs cascade;
drop table if exists public.tutoring_opportunities cascade;
drop table if exists public.certification_requests cascade;
drop table if exists public.subject_approvals cascade;
drop table if exists public.subjects cascade;
drop table if exists public.tutees cascade;
drop table if exists public.tutors cascade;
drop table if exists public.admins cascade;
drop table if exists public.schools cascade;

-- (2) Drop the legacy public helper functions.
drop function if exists public.is_admin() cascade;
drop function if exists public.set_updated_at() cascade;

-- (3) Drop the private schema (legacy is_tutor_at_school / is_tutee_at_school).
drop schema if exists private cascade;

-- (4) Delete the 3 throwaway test users via SQL (atomic with teardown; the two
-- SQL risks are verifiably absent per G1). Legacy SQL stays recoverable from
-- supabase_migrations.schema_migrations.statements.
delete from auth.users;
