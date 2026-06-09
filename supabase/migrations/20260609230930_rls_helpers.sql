-- Scire rls_helpers (§2.2 predicates, §3.2 token hook, §1.4 create_organization).
-- Helpers are STABLE SECURITY DEFINER sql with search_path='' so every policy is
-- `org_id = (select private.helper())` (InitPlan once/statement -> zero
-- auth-initplan warnings) and SECURITY DEFINER breaks policy re-entry (42P17
-- structurally impossible). NO inline cross-table EXISTS in any policy.

-- ---- §2.2 policy helpers ---------------------------------------------------
create function private.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.kind = 'admin' and p.status = 'active'
  );
$$;

create function private.managed_org()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select p.org_id from public.profiles p
  where p.id = auth.uid() and p.kind = 'manager' and p.status = 'active';
$$;

create function private.active_member_org()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select p.org_id from public.profiles p
  where p.id = auth.uid() and p.kind = 'member' and p.status = 'active';
$$;

create function private.active_org()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select p.org_id from public.profiles p
  where p.id = auth.uid() and p.status = 'active' and p.kind in ('member', 'manager');
$$;

create function private.can_tutor(p_subject uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.subject_approvals sa
    join public.profiles p on p.id = sa.profile_id
    where sa.org_subject_id = p_subject
      and sa.profile_id = auth.uid()
      and sa.status = 'approved'
      and p.kind = 'member' and p.status = 'active'
  );
$$;

-- ---- §3.2 custom access token hook ----------------------------------------
-- Flat routing-hint claims (user_kind / user_status / org_id). NEVER touches a
-- reserved claim; EXCEPTION-safe (returns the event unchanged on any error so a
-- profile hiccup never blocks token issuance).
create function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_claims jsonb;
  v_kind public.account_kind;
  v_status public.account_status;
  v_org uuid;
begin
  select p.kind, p.status, p.org_id into v_kind, v_status, v_org
    from public.profiles p
    where p.id = (event ->> 'user_id')::uuid;

  v_claims := coalesce(event -> 'claims', '{}'::jsonb);

  if v_kind is not null then
    v_claims := jsonb_set(v_claims, '{user_kind}', to_jsonb(v_kind::text));
    v_claims := jsonb_set(v_claims, '{user_status}', to_jsonb(v_status::text));
    v_claims := jsonb_set(v_claims, '{org_id}', coalesce(to_jsonb(v_org), 'null'::jsonb));
  end if;

  return jsonb_set(event, '{claims}', v_claims);
exception when others then
  return event;
end;
$$;

-- Only GoTrue's auth admin may run the hook.
revoke execute on function public.custom_access_token_hook(jsonb) from public, anon, authenticated;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;

-- The hook's scoped profiles read (documented for advisors). Table grant gives
-- the policy teeth even though the SECURITY DEFINER body already bypasses RLS.
grant usage on schema public to supabase_auth_admin;
grant select on public.profiles to supabase_auth_admin;
create policy profiles_select_auth_hook
  on public.profiles for select
  to supabase_auth_admin
  using (true);

-- ---- §1.4 create_organization — the ONE sanctioned PostgREST RPC ----------
-- SECURITY DEFINER + self-authz (raises unless the caller is an admin); inserts
-- the org and copies ALL template rows in ONE transaction. Invoked with the
-- admin's own Bearer token, so auth.uid() (and the audit trigger) record the
-- real actor. The dialog's subject deselection is a copy-all + soft-deactivate
-- follow-up in the create handler (benign non-atomicity).
create function public.create_organization(p_name text, p_slug text)
returns public.organizations
language plpgsql security definer set search_path = ''
as $$
declare
  v_org public.organizations;
begin
  if not (select private.is_admin()) then
    raise exception 'not_admin' using errcode = 'insufficient_privilege';
  end if;

  insert into public.organizations (name, slug)
  values (p_name, p_slug)
  returning * into v_org;

  insert into public.org_subjects (org_id, name, category, grade_level)
  select v_org.id, t.name, t.category, t.grade_level
  from public.subject_templates t;

  return v_org;
end;
$$;

revoke execute on function public.create_organization(text, text) from public, anon;
grant execute on function public.create_organization(text, text) to authenticated;
