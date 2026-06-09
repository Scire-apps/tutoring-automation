-- Reviewer fix (§2.4 vs §5.7/§7.2/§6.3 reconciliation): the profiles_guard peer-manager
-- branch permitted ONLY pending->active, but the manager panel (§5.7), the API surface
-- (§7.2 POST /api/manage/managers/[id]/reject) and the admin panel (§6.3) all specify that
-- a manager may also REJECT a pending peer manager (pending->rejected + status_note + email).
-- As shipped, that endpoint would be dead-on-arrival (guard RAISE). Allow pending->rejected
-- for a same-org peer manager IN ADDITION to pending->active. Security posture is preserved:
-- a manager still may act ONLY on a PENDING peer (never suspend/restore/touch an ACTIVE peer
-- manager — that stays admin-only, the anti rogue-manager-lockout rule), and still never on
-- itself. Admin retains full control over all manager statuses.

create or replace function private.profiles_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_service boolean := (current_setting('request.jwt.claims', true) is null)
                          or (auth.role() = 'service_role');
  v_actor uuid := auth.uid();
  v_actor_kind public.account_kind;
  v_actor_org uuid;
begin
  if new.kind is distinct from old.kind then
    raise exception 'profiles_guard: kind is immutable';
  end if;
  if new.org_id is distinct from old.org_id then
    raise exception 'profiles_guard: org_id is immutable';
  end if;
  if new.id is distinct from old.id then
    raise exception 'profiles_guard: id is immutable';
  end if;

  if v_is_service then
    return new;
  end if;

  if new.email is distinct from old.email then
    raise exception 'profiles_guard: email is managed by auth and immutable here';
  end if;

  select p.kind, p.org_id into v_actor_kind, v_actor_org
    from public.profiles p where p.id = v_actor;

  if (new.status is distinct from old.status)
     or (new.status_note is distinct from old.status_note)
     or (new.activated_at is distinct from old.activated_at)
     or (new.activated_by is distinct from old.activated_by) then

    if v_actor_kind = 'admin' then
      null;  -- admins manage any profile.
    elsif v_actor_kind = 'manager'
          and v_actor_org is not null
          and v_actor_org = old.org_id
          and v_actor <> old.id then
      -- Managers manage members of their org; for PEER managers they may only act on a
      -- PENDING peer, moving it to active (approve) or rejected (reject). Active-manager
      -- suspension/restore stays admin-only.
      if old.kind = 'member' then
        null;
      elsif old.kind = 'manager'
            and old.status = 'pending' and new.status in ('active', 'rejected') then
        null;
      else
        raise exception 'profiles_guard: not permitted to change this manager''s status';
      end if;
    else
      raise exception 'profiles_guard: not permitted to manage this profile';
    end if;
  end if;

  if v_actor = old.id
     and v_actor_kind is distinct from 'admin'
     and ((new.status is distinct from old.status)
       or (new.status_note is distinct from old.status_note)
       or (new.activated_at is distinct from old.activated_at)
       or (new.activated_by is distinct from old.activated_by)) then
    raise exception 'profiles_guard: cannot change your own status';
  end if;

  return new;
end;
$$;
