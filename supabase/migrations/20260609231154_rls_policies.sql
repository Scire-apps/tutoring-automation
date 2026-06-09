-- Scire rls_policies (§2.3). ONE permissive policy per table+action; every helper
-- wrapped (select private.helper()) so the InitPlan evaluates once per statement
-- (zero auth-initplan warnings). Claims NEVER appear here — enforcement is always
-- DB-fresh via the private helpers. Deny-by-default: anything unlisted is denied.

-- ============================================================================
-- organizations  — anon/auth read active; admin full CRUD (delete archived only;
-- FK RESTRICT enforces "empty").
-- ============================================================================
create policy organizations_select on public.organizations
  for select to anon, authenticated
  using (archived_at is null or (select private.is_admin()));

create policy organizations_insert on public.organizations
  for insert to authenticated
  with check ((select private.is_admin()));

create policy organizations_update on public.organizations
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy organizations_delete on public.organizations
  for delete to authenticated
  using ((select private.is_admin()) and archived_at is not null);

-- ============================================================================
-- profiles  — self + admin + managed-org + active org-mates (read only). UPDATE
-- drops the org-mates branch; the guard trigger pins which columns/transitions.
-- NO INSERT / DELETE policies (trigger provisions; auth.users cascade deletes).
-- ============================================================================
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or (select private.is_admin())
    or org_id = (select private.managed_org())
    or (status = 'active' and org_id = (select private.active_org()))
  );

create policy profiles_update on public.profiles
  for update to authenticated
  using (
    id = (select auth.uid())
    or (select private.is_admin())
    or org_id = (select private.managed_org())
  )
  with check (
    id = (select auth.uid())
    or (select private.is_admin())
    or org_id = (select private.managed_org())
  );

-- The token hook's scoped read (idempotent re-assert; first created with the hook
-- in rls_helpers so the hook works the instant it is registered).
drop policy if exists profiles_select_auth_hook on public.profiles;
create policy profiles_select_auth_hook on public.profiles
  for select to supabase_auth_admin
  using (true);

-- ============================================================================
-- subject_templates  — admin only (the create_organization RPC reads them as a
-- SECURITY DEFINER owner, bypassing RLS, so members never need template access).
-- ============================================================================
create policy subject_templates_select on public.subject_templates
  for select to authenticated using ((select private.is_admin()));
create policy subject_templates_insert on public.subject_templates
  for insert to authenticated with check ((select private.is_admin()));
create policy subject_templates_update on public.subject_templates
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy subject_templates_delete on public.subject_templates
  for delete to authenticated using ((select private.is_admin()));

-- ============================================================================
-- org_subjects  — active org members read; managers/admins manage. DELETE is
-- admin-only (FK RESTRICT blocks referenced rows; managers soft-deactivate).
-- ============================================================================
create policy org_subjects_select on public.org_subjects
  for select to authenticated
  using ((select private.is_admin()) or org_id = (select private.active_org()));

create policy org_subjects_insert on public.org_subjects
  for insert to authenticated
  with check ((select private.is_admin()) or org_id = (select private.managed_org()));

create policy org_subjects_update on public.org_subjects
  for update to authenticated
  using ((select private.is_admin()) or org_id = (select private.managed_org()))
  with check ((select private.is_admin()) or org_id = (select private.managed_org()));

create policy org_subjects_delete on public.org_subjects
  for delete to authenticated
  using ((select private.is_admin()));

-- ============================================================================
-- subject_approvals  — own | org | admin. INSERT: member self-request (pending,
-- not direct) | manager direct-grant (approved, decided_by=self) | admin.
-- UPDATE lanes are role-disjoint (managed_org() is NULL for members); the member
-- lane can only land in withdrawn/pending (never approves itself).
-- ============================================================================
create policy subject_approvals_select on public.subject_approvals
  for select to authenticated
  using (
    (select private.is_admin())
    or org_id = (select private.managed_org())
    or profile_id = (select auth.uid())
  );

create policy subject_approvals_insert on public.subject_approvals
  for insert to authenticated
  with check (
    (select private.is_admin())
    or (org_id = (select private.managed_org())
        and status = 'approved' and direct_grant = true
        and decided_by = (select auth.uid()))
    or (profile_id = (select auth.uid())
        and org_id = (select private.active_member_org())
        and status = 'pending' and direct_grant = false)
  );

create policy subject_approvals_update on public.subject_approvals
  for update to authenticated
  using (
    (select private.is_admin())
    or org_id = (select private.managed_org())
    or (profile_id = (select auth.uid()) and status in ('pending', 'rejected', 'withdrawn'))
  )
  with check (
    (select private.is_admin())
    or org_id = (select private.managed_org())
    or (profile_id = (select auth.uid()) and status in ('pending', 'withdrawn'))
  );

-- ============================================================================
-- sessions  — admin | managed-org | (active-member-org AND (requester self |
-- claimer self | open)). UPDATE uses the SAME shape USING + WITH CHECK: the
-- open-branch enables the third-party claim (USING) and its claimed/open result
-- (CHECK); the sessions_guard trigger pins the actual transition legality.
-- ============================================================================
create policy sessions_select on public.sessions
  for select to authenticated
  using (
    (select private.is_admin())
    or org_id = (select private.managed_org())
    or (org_id = (select private.active_member_org())
        and (requester_id = (select auth.uid())
             or tutor_id = (select auth.uid())
             or status = 'open'))
  );

create policy sessions_insert on public.sessions
  for insert to authenticated
  with check (
    (select private.is_admin())
    or org_id = (select private.managed_org())
    or (requester_id = (select auth.uid())
        and org_id = (select private.active_member_org())
        and status = 'open' and tutor_id is null)
  );

create policy sessions_update on public.sessions
  for update to authenticated
  using (
    (select private.is_admin())
    or org_id = (select private.managed_org())
    or (org_id = (select private.active_member_org())
        and (requester_id = (select auth.uid())
             or tutor_id = (select auth.uid())
             or status = 'open'))
  )
  with check (
    (select private.is_admin())
    or org_id = (select private.managed_org())
    or (org_id = (select private.active_member_org())
        and (requester_id = (select auth.uid())
             or tutor_id = (select auth.uid())
             or status = 'open'))
  );

create policy sessions_delete on public.sessions
  for delete to authenticated
  using ((select private.is_admin()));

-- ============================================================================
-- volunteer_hours_ledger  — own | org | admin read. INSERT is adjustments ONLY
-- (manager awarded_by=self | admin); awards are written by the verify trigger as
-- a SECURITY DEFINER owner (bypasses this). NO update/delete (append-only).
-- ============================================================================
create policy volunteer_hours_ledger_select on public.volunteer_hours_ledger
  for select to authenticated
  using (
    (select private.is_admin())
    or org_id = (select private.managed_org())
    or profile_id = (select auth.uid())
  );

create policy volunteer_hours_ledger_insert on public.volunteer_hours_ledger
  for insert to authenticated
  with check (
    kind = 'adjustment'
    and (
      (select private.is_admin())
      or (org_id = (select private.managed_org()) and awarded_by = (select auth.uid()))
    )
  );

-- ============================================================================
-- help_requests  — own | org | admin read; active-member self INSERT; manager /
-- admin resolve (UPDATE). NO delete (soft resolve).
-- ============================================================================
create policy help_requests_select on public.help_requests
  for select to authenticated
  using (
    (select private.is_admin())
    or org_id = (select private.managed_org())
    or profile_id = (select auth.uid())
  );

create policy help_requests_insert on public.help_requests
  for insert to authenticated
  with check (
    profile_id = (select auth.uid())
    and org_id = (select private.active_member_org())
  );

create policy help_requests_update on public.help_requests
  for update to authenticated
  using ((select private.is_admin()) or org_id = (select private.managed_org()))
  with check ((select private.is_admin()) or org_id = (select private.managed_org()));

-- ============================================================================
-- email_log  — manager org | admin read only. Writes via the service-confined
-- log lib (no INSERT grant/policy). NO update/delete (append-only).
-- ============================================================================
create policy email_log_select on public.email_log
  for select to authenticated
  using ((select private.is_admin()) or org_id = (select private.managed_org()));

-- ============================================================================
-- audit_log  — admin all; manager org rows only (org_id NULL invisible). Written
-- by definer triggers + the sanctioned RPC. SELECT only.
-- ============================================================================
create policy audit_log_select on public.audit_log
  for select to authenticated
  using (
    (select private.is_admin())
    or (org_id is not null and org_id = (select private.managed_org()))
  );
