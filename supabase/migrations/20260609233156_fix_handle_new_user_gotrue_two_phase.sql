-- Reviewer fix (BLOCKER): the admin bootstrap (scripts/seed-admins) failed with
-- "handle_new_user: org_id <NULL> is not an active organization". Root cause: GoTrue's
-- admin.createUser({ app_metadata }) writes auth.users in TWO phases — the initial
-- INSERT carries raw_app_meta_data = {"provider":"email","providers":["email"]} WITHOUT
-- the custom app_metadata, then a follow-up UPDATE (same request) merges in kind:admin.
-- The original AFTER-INSERT-only trigger therefore never saw kind='admin', fell into the
-- member/manager branch, and RAISEd on the absent org_id, aborting createUser entirely.
-- (Empirically confirmed: a direct INSERT carrying kind=admin DOES materialize the admin
-- profile correctly; the post-merge row carries kind=admin — proving the two-phase order.)
--
-- Fix: provision on AFTER INSERT OR UPDATE and make admin detection two-phase-safe while
-- keeping "app_metadata is the ONLY admin channel" intact (public signup can never forge
-- raw_app_meta_data, which is service-role-only). Security-critical invariant preserved:
-- a public signup can NEVER reach the admin branch.
--   * Admin IFF raw_app_meta_data->>'kind' = 'admin' (works at the merge UPDATE, or at
--     INSERT for the SQL-direct path). Idempotent: if the profile already exists, no-op.
--   * Non-admin member/manager provisioning runs on INSERT only and still RAISEs loudly on
--     a missing/inactive org_id — BUT only when an org_id intent is actually present, i.e.
--     a real public signup (the dropdown always sends org_id). When NEITHER an admin signal
--     NOR an org_id is present at INSERT (exactly the admin createUser pre-merge shape), we
--     DEFER (create nothing, raise nothing) and let the app_metadata-merge UPDATE complete
--     the admin profile. A genuinely metadata-less signup simply yields no profile (the API
--     guards surface that as 500 profile_missing per §7.4) — it can never escalate to admin.

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind public.account_kind;
  v_org_id uuid;
  v_status public.account_status;
  v_first text;
  v_last text;
  v_meta_kind text;
begin
  -- Idempotency: never create a second profile (the two-phase createUser fires this
  -- trigger on both the INSERT and the app_metadata-merge UPDATE).
  if exists (select 1 from public.profiles p where p.id = new.id) then
    return new;
  end if;

  v_first := coalesce(new.raw_user_meta_data ->> 'first_name', '');
  v_last := coalesce(new.raw_user_meta_data ->> 'last_name', '');

  -- (1) Admin branch FIRST. raw_app_meta_data is service-role-only (set ONLY by the seed
  -- script) — there is no public path to admin. Visible at INSERT for SQL-direct inserts
  -- and at the merge UPDATE for GoTrue admin.createUser.
  if (new.raw_app_meta_data ->> 'kind') = 'admin' then
    insert into public.profiles (id, kind, org_id, status, email, first_name, last_name)
    values (new.id, 'admin', null, 'active', lower(new.email), v_first, v_last);
    return new;
  end if;

  -- (2) Public member/manager signup is provisioned at INSERT only.
  if tg_op <> 'INSERT' then
    return new;
  end if;

  v_meta_kind := new.raw_user_meta_data ->> 'kind';
  v_org_id := (new.raw_user_meta_data ->> 'org_id')::uuid;

  -- Defer the admin createUser pre-merge shape (no admin signal yet AND no signup intent):
  -- create nothing, raise nothing; the app_metadata-merge UPDATE will provision the admin.
  if v_org_id is null and v_meta_kind is null then
    return new;
  end if;

  case v_meta_kind
    when 'manager' then v_kind := 'manager';
    else v_kind := 'member';
  end case;

  -- A real public signup carries org_id; it must reference an ACTIVE org or fail loudly.
  if v_org_id is null
     or not exists (
       select 1 from public.organizations o
       where o.id = v_org_id and o.archived_at is null
     ) then
    raise exception 'handle_new_user: org_id % is not an active organization', v_org_id
      using errcode = 'foreign_key_violation';
  end if;

  v_status := 'pending';  -- no insert path yields an active member/manager.

  insert into public.profiles (id, kind, org_id, status, email, first_name, last_name)
  values (new.id, v_kind, v_org_id, v_status, lower(new.email), v_first, v_last);

  return new;
end;
$$;

-- Fire on INSERT and UPDATE so the GoTrue app_metadata-merge UPDATE can complete the admin
-- profile. (The separate on_auth_user_email_change trigger handles email sync; this one is
-- idempotent and only acts when no profile exists yet, so coexistence is safe.)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update on auth.users
  for each row execute function private.handle_new_user();
