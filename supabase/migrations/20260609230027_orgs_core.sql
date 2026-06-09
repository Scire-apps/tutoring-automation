-- Scire orgs_core (§1.3 tables 1-2, §1.4 handle_new_user, §1.5/§2.4 profiles_guard).
-- RLS ENABLE ships inside each CREATE TABLE. Org-FK delete policy per §2.9/§1.6:
-- FKs -> organizations are ON DELETE RESTRICT (archive-only; org_not_empty 409),
-- except audit_log (SET NULL, later migration). profiles.id -> auth.users CASCADE.

-- ============================================================================
-- organizations
-- ============================================================================
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (btrim(name) <> ''),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  archived_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.organizations enable row level security;

-- Archived orgs free their slug; restore re-validates against live orgs only.
create unique index organizations_slug_active_key
  on public.organizations (slug)
  where archived_at is null;

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function private.set_updated_at();

-- ============================================================================
-- profiles  (id = auth.users.id; one row per auth user; kind exclusivity by CHECK)
-- ============================================================================
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  kind public.account_kind not null,
  org_id uuid null references public.organizations (id) on delete restrict,
  status public.account_status not null default 'pending',
  email text not null unique check (email = lower(email)),
  first_name text not null,
  last_name text not null,
  grade smallint null check (grade between 1 and 13),
  pronouns text null,
  status_note text null,
  activated_at timestamptz null,
  activated_by uuid null references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- admin iff org_id IS NULL.
  constraint profiles_admin_org_excl check ((kind = 'admin') = (org_id is null)),
  -- admins are always active (no pending/suspended admin state).
  constraint profiles_admin_active check (kind <> 'admin' or status = 'active'),
  -- grade/pronouns are member-only attributes.
  constraint profiles_member_only_fields
    check (kind = 'member' or (grade is null and pronouns is null)),
  -- composite-FK target so org-scoped child rows can prove (child.org_id = profile.org_id).
  constraint profiles_id_org_key unique (id, org_id)
);
alter table public.profiles enable row level security;

create index profiles_org_kind_status_idx on public.profiles (org_id, kind, status);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- ============================================================================
-- private.handle_new_user  (§1.4, §3.1) — AFTER INSERT ON auth.users.
-- The converged profile-creation path for public signup AND manager invite.
-- The app_metadata admin branch is FIRST (service-only; seed script sets it).
-- ============================================================================
create function private.handle_new_user()
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
begin
  v_first := coalesce(new.raw_user_meta_data ->> 'first_name', '');
  v_last := coalesce(new.raw_user_meta_data ->> 'last_name', '');

  -- (1) Admin branch FIRST. raw_app_meta_data is service-role-only (set ONLY by
  -- the seed script) — there is no public path to admin.
  if (new.raw_app_meta_data ->> 'kind') = 'admin' then
    v_kind := 'admin';
    v_org_id := null;
    v_status := 'active';
  else
    -- (2) Member/manager from user metadata, clamped to the public kinds.
    case new.raw_user_meta_data ->> 'kind'
      when 'manager' then v_kind := 'manager';
      else v_kind := 'member';
    end case;

    v_org_id := (new.raw_user_meta_data ->> 'org_id')::uuid;

    -- org_id must reference an existing ACTIVE org; signup fails loudly otherwise
    -- (clients pre-validate via the dropdown).
    if v_org_id is null
       or not exists (
         select 1 from public.organizations o
         where o.id = v_org_id and o.archived_at is null
       ) then
      raise exception 'handle_new_user: org_id % is not an active organization', v_org_id
        using errcode = 'foreign_key_violation';
    end if;

    -- No insert path yields an active member/manager.
    v_status := 'pending';
  end if;

  insert into public.profiles (id, kind, org_id, status, email, first_name, last_name)
  values (new.id, v_kind, v_org_id, v_status, lower(new.email), v_first, v_last);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ============================================================================
-- private.sync_profile_email  — mirror auth.users email change onto profiles.
-- ============================================================================
create function private.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles
      set email = lower(new.email)
      where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_change
  after update of email on auth.users
  for each row execute function private.sync_profile_email();

-- ============================================================================
-- private.profiles_guard  (§1.5/§2.4) BEFORE UPDATE.
-- The RLS envelope cannot see OLD; this trigger + the policies together are the
-- boundary. service_role is exempt only where stated (it carries invite-promote
-- and the auth email-sync mirror).
-- ============================================================================
create function private.profiles_guard()
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
  -- kind and org_id are immutable UNCONDITIONALLY (one org for life in v1;
  -- org moves are a post-v1 schema change). Applies to ALL roles incl. service.
  if new.kind is distinct from old.kind then
    raise exception 'profiles_guard: kind is immutable';
  end if;
  if new.org_id is distinct from old.org_id then
    raise exception 'profiles_guard: org_id is immutable';
  end if;
  -- id is the auth.users PK; never reassignable.
  if new.id is distinct from old.id then
    raise exception 'profiles_guard: id is immutable';
  end if;

  -- Service role bypasses the remaining people-management matrix (seed repair,
  -- invite pending->active promote, email sync).
  if v_is_service then
    return new;
  end if;

  -- email is service-only (kept in sync with auth.users by sync_profile_email).
  if new.email is distinct from old.email then
    raise exception 'profiles_guard: email is managed by auth and immutable here';
  end if;

  -- Resolve the acting profile (NULL for unauthenticated — nothing passes).
  select p.kind, p.org_id into v_actor_kind, v_actor_org
    from public.profiles p where p.id = v_actor;

  -- Status / activation / status_note are people-management columns.
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
      -- Managers manage members of their org, and may ONLY activate a pending
      -- peer manager (pending -> active). Active-manager suspension is admin-only.
      if old.kind = 'member' then
        null;
      elsif old.kind = 'manager'
            and old.status = 'pending' and new.status = 'active' then
        null;
      else
        raise exception 'profiles_guard: not permitted to change this manager''s status';
      end if;
    else
      raise exception 'profiles_guard: not permitted to manage this profile';
    end if;
  end if;

  -- Self-service edits are limited to names / grade / pronouns. Any change to a
  -- column not covered above by an authorized actor is rejected here when the
  -- actor is the profile owner mutating a protected column.
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

create trigger profiles_guard
  before update on public.profiles
  for each row execute function private.profiles_guard();
