-- Scire grants_hardening (§2.5). Default privileges revoked, then explicit
-- least-privilege re-grants. Append-only REVOKEs (binding service_role) are
-- re-asserted idempotently. Private-schema EXECUTE is tightened to authenticated
-- ONLY (anon/public revoked). Residual sweep: split the org SELECT into
-- role-scoped policies so anon never evaluates a private helper, drop a redundant
-- ledger constraint, and scope the token-hook EXECUTE to supabase_auth_admin.

-- ---- Table privileges: wipe anon/authenticated, then re-grant per §2.1 ------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- organizations: admin CRUD (rows gated by policy); anon reads only (id, name).
grant select, insert, update, delete on public.organizations to authenticated;
grant select (id, name) on public.organizations to anon;

-- profiles: SELECT + UPDATE only (NO insert/delete — trigger provisions, cascade
-- deletes).
grant select, update on public.profiles to authenticated;

-- subject_templates: admin-managed (policy restricts to admins).
grant select, insert, update, delete on public.subject_templates to authenticated;

-- org_subjects: members read, managers/admins write, admin deletes.
grant select, insert, update, delete on public.org_subjects to authenticated;

-- subject_approvals: no delete (rows never deleted; soft lifecycle).
grant select, insert, update on public.subject_approvals to authenticated;

-- sessions: admin deletes; everyone else via policy + guard.
grant select, insert, update, delete on public.sessions to authenticated;

-- volunteer_hours_ledger: append-only (SELECT + INSERT-adjustment only).
grant select, insert on public.volunteer_hours_ledger to authenticated;

-- help_requests: no delete (soft resolve).
grant select, insert, update on public.help_requests to authenticated;

-- email_log / audit_log: read only (writes via service lib / definer triggers).
grant select on public.email_log to authenticated;
grant select on public.audit_log to authenticated;

-- ---- Append-only at the grant layer (re-assert; binds service_role too) -----
revoke update, delete, truncate on public.audit_log from anon, authenticated, service_role;
revoke update, delete, truncate on public.email_log from anon, authenticated, service_role;
revoke update, delete, truncate on public.volunteer_hours_ledger from anon, authenticated, service_role;

-- ---- private schema: USAGE + EXECUTE to authenticated ONLY ------------------
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
-- Helpers are evaluated by policies as the querying (authenticated) role; anon
-- and public get nothing, now and for future functions.
revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;
alter default privileges in schema private revoke execute on functions from public, anon;

-- ---- Residual sweep --------------------------------------------------------
-- Org SELECT, split by role: anon's path carries NO private-helper call (so anon
-- never needs private EXECUTE); the admin "see archived" branch is authenticated.
drop policy if exists organizations_select on public.organizations;
create policy organizations_select_anon on public.organizations
  for select to anon
  using (archived_at is null);
create policy organizations_select_auth on public.organizations
  for select to authenticated
  using (archived_at is null or (select private.is_admin()));

-- The partial UNIQUE(session_id) WHERE kind='award' is the sole double-award
-- guard (§1.3 table 7); drop the broader composite constraint that would also
-- block two adjustments referencing one session.
alter table public.volunteer_hours_ledger
  drop constraint if exists volunteer_hours_ledger_award_session_key;

-- Token hook: EXECUTE to supabase_auth_admin only (§3.2).
revoke execute on function public.custom_access_token_hook(jsonb) from service_role;
