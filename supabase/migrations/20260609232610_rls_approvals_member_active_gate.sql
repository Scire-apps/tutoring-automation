-- Reviewer fix (§2.1/§2.3): the subject_approvals_update member lane keyed only on
-- profile_id = auth.uid(), with NO active-status gate — so a non-active (pending /
-- suspended / rejected) member could flip their OWN approval row pending<->withdrawn
-- or re-request via direct PostgREST, breaking the binding "PM/PG see ZERO org data
-- structurally" invariant. The INSERT lane already gates on active_member_org(); this
-- aligns UPDATE to the same shape (and to the sessions member lane). Active members
-- keep full withdraw / re-request capability; non-active members get nothing.
drop policy if exists subject_approvals_update on public.subject_approvals;
create policy subject_approvals_update on public.subject_approvals
  for update to authenticated
  using (
    (select private.is_admin())
    or org_id = (select private.managed_org())
    or (profile_id = (select auth.uid())
        and org_id = (select private.active_member_org())
        and status in ('pending', 'rejected', 'withdrawn'))
  )
  with check (
    (select private.is_admin())
    or org_id = (select private.managed_org())
    or (profile_id = (select auth.uid())
        and org_id = (select private.active_member_org())
        and status in ('pending', 'withdrawn'))
  );
