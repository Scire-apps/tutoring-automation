-- Scire hours_audit (§1.3 tables 7-10). The three append-only logs (bigint
-- identity) + help_requests; the audit-writer trigger suite (sessions_audit was
-- created in step 5); ledger_balance_guard; and the three append-only REVOKEs
-- (binding service_role too) right after the CREATEs. RLS ENABLE inside each
-- CREATE TABLE. audit_log.target_id is text so heterogeneous targets (uuid +
-- bigint keys) share one column.

-- ============================================================================
-- audit_log  — append-only; written ONLY by definer triggers + the sanctioned
-- audit RPC. org_id SET NULL on org delete (org snapshot lives in metadata).
-- ============================================================================
create table public.audit_log (
  id bigint generated always as identity primary key,
  org_id uuid null references public.organizations (id) on delete set null,
  actor_id uuid null references public.profiles (id) on delete set null,
  actor_kind public.account_kind null,
  action text not null,
  target_table text null,
  target_id text null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.audit_log enable row level security;

create index audit_log_org_idx on public.audit_log (org_id, created_at desc);
create index audit_log_actor_idx on public.audit_log (actor_id);
create index audit_log_target_idx on public.audit_log (target_table, target_id);

-- ============================================================================
-- email_log  — replaces communications; one row per recipient (batch_id groups
-- a broadcast). Writes go through the service-confined log lib (no authenticated
-- INSERT grant).
-- ============================================================================
create table public.email_log (
  id bigint generated always as identity primary key,
  org_id uuid null references public.organizations (id) on delete restrict,
  sender_id uuid null references public.profiles (id) on delete set null,
  recipient_id uuid null references public.profiles (id) on delete set null,
  recipient_email text not null,
  subject text not null,
  body text null,
  kind text null,
  status public.email_status not null,
  session_id uuid null references public.sessions (id) on delete set null,
  batch_id uuid null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.email_log enable row level security;

create index email_log_org_idx on public.email_log (org_id, created_at desc);
create index email_log_sender_idx on public.email_log (sender_id);
create index email_log_recipient_idx on public.email_log (recipient_id);
create index email_log_session_idx on public.email_log (session_id);
create index email_log_batch_idx on public.email_log (batch_id);

-- ============================================================================
-- volunteer_hours_ledger  — append-only. Awards written ONLY by the verify
-- trigger; adjustments INSERTed by manager/admin. Totals are always SUM.
-- ============================================================================
create table public.volunteer_hours_ledger (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations (id) on delete restrict,
  profile_id uuid not null,
  session_id uuid null references public.sessions (id) on delete set null,
  kind public.ledger_kind not null,
  hours numeric(4,2) not null check (abs(hours) between 0.25 and 24 and (kind <> 'award' or hours > 0)),
  note text null,
  awarded_by uuid null references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  -- a session can be awarded at most once.
  constraint volunteer_hours_ledger_award_session_key unique (session_id, kind)
    deferrable initially immediate,
  -- keep ledger rows within the holder's org.
  constraint volunteer_hours_ledger_profile_fk
    foreign key (profile_id, org_id) references public.profiles (id, org_id)
);
alter table public.volunteer_hours_ledger enable row level security;

-- Partial unique: at most ONE award row per session (double award impossible).
create unique index volunteer_hours_ledger_award_unique
  on public.volunteer_hours_ledger (session_id)
  where kind = 'award';

create index volunteer_hours_ledger_profile_idx on public.volunteer_hours_ledger (profile_id);
create index volunteer_hours_ledger_org_idx on public.volunteer_hours_ledger (org_id);
create index volunteer_hours_ledger_session_idx on public.volunteer_hours_ledger (session_id);

-- ============================================================================
-- help_requests  — org-scoped queue; mutable (status flips to resolved).
-- ============================================================================
create table public.help_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete restrict,
  profile_id uuid null references public.profiles (id) on delete set null,
  urgency public.urgency_level not null default 'normal',
  description text not null,
  status public.help_status not null default 'open',
  resolved_by uuid null references public.profiles (id) on delete set null,
  resolved_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- resolved_* are set together iff the request is resolved.
  constraint help_requests_resolved_ck
    check ((status = 'resolved') = (resolved_by is not null and resolved_at is not null))
);
alter table public.help_requests enable row level security;

create index help_requests_org_status_idx on public.help_requests (org_id, status, created_at desc);
create index help_requests_profile_idx on public.help_requests (profile_id);

create trigger help_requests_set_updated_at
  before update on public.help_requests
  for each row execute function private.set_updated_at();

-- ============================================================================
-- Append-only REVOKEs (§1.1/§2.5) — bind service_role too. The definer triggers
-- write as the table owner (postgres), bypassing these grants; nobody else may
-- mutate history. Re-asserted idempotently in step 9.
-- ============================================================================
revoke update, delete, truncate on public.audit_log from anon, authenticated, service_role;
revoke update, delete, truncate on public.email_log from anon, authenticated, service_role;
revoke update, delete, truncate on public.volunteer_hours_ledger from anon, authenticated, service_role;

-- ============================================================================
-- private.ledger_balance_guard  BEFORE INSERT — a member's running total may
-- never go negative (a correction can't overdraw earned hours).
-- ============================================================================
create function private.ledger_balance_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total numeric;
begin
  select coalesce(sum(l.hours), 0) into v_total
    from public.volunteer_hours_ledger l
    where l.profile_id = new.profile_id;
  if v_total + new.hours < 0 then
    raise exception 'ledger_balance_guard: adjustment would drive the balance negative';
  end if;
  return new;
end;
$$;

create trigger volunteer_hours_ledger_balance_guard
  before insert on public.volunteer_hours_ledger
  for each row execute function private.ledger_balance_guard();

-- ============================================================================
-- Audit writers (§2.9). One shared definer helper snapshots the actor; each
-- table's trigger calls it. sessions_audit already shipped in step 5.
-- ============================================================================
create function private.log_audit(
  p_action text,
  p_org uuid,
  p_target_table text,
  p_target_id text,
  p_metadata jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_kind public.account_kind;
begin
  select p.kind into v_actor_kind from public.profiles p where p.id = v_actor;
  insert into public.audit_log (org_id, actor_id, actor_kind, action, target_table, target_id, metadata)
  values (p_org, v_actor, v_actor_kind, p_action, p_target_table, p_target_id, coalesce(p_metadata, '{}'));
end;
$$;

-- profiles: audit people-management status changes.
create function private.profiles_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prefix text := case when new.kind = 'manager' then 'manager.' else 'member.' end;
  v_verb text;
begin
  if new.status is distinct from old.status then
    v_verb := case new.status
                when 'active' then 'activated'
                when 'rejected' then 'rejected'
                when 'suspended' then 'suspended'
                else new.status::text
              end;
    perform private.log_audit(
      v_prefix || v_verb, new.org_id, 'profiles', new.id::text,
      jsonb_build_object('from', old.status::text, 'to', new.status::text, 'kind', new.kind::text)
    );
  end if;
  return new;
end;
$$;

create trigger profiles_audit
  after update on public.profiles
  for each row execute function private.profiles_audit();

-- subject_approvals: audit creation + decision transitions.
create function private.approvals_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.log_audit(
      case when new.direct_grant then 'subject_approval.granted' else 'subject_approval.requested' end,
      new.org_id, 'subject_approvals', new.id::text,
      jsonb_build_object('status', new.status::text, 'org_subject_id', new.org_subject_id)
    );
  elsif new.status is distinct from old.status then
    perform private.log_audit(
      'subject_approval.' || new.status::text,
      new.org_id, 'subject_approvals', new.id::text,
      jsonb_build_object('from', old.status::text, 'to', new.status::text)
    );
  end if;
  return new;
end;
$$;

create trigger subject_approvals_audit
  after insert or update on public.subject_approvals
  for each row execute function private.approvals_audit();

-- org_subjects: audit catalog changes.
create function private.org_subjects_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.log_audit('org.subject.created', new.org_id, 'org_subjects', new.id::text,
      jsonb_build_object('name', new.name, 'active', new.active));
  elsif tg_op = 'UPDATE' and new.active is distinct from old.active then
    perform private.log_audit(
      case when new.active then 'org.subject.reactivated' else 'org.subject.deactivated' end,
      new.org_id, 'org_subjects', new.id::text, jsonb_build_object('name', new.name));
  end if;
  return new;
end;
$$;

create trigger org_subjects_audit
  after insert or update on public.org_subjects
  for each row execute function private.org_subjects_audit();

-- organizations: audit org lifecycle.
create function private.organizations_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.log_audit('org.created', new.id, 'organizations', new.id::text,
      jsonb_build_object('name', new.name, 'slug', new.slug));
  elsif tg_op = 'UPDATE' then
    if (old.archived_at is null) and (new.archived_at is not null) then
      perform private.log_audit('org.archived', new.id, 'organizations', new.id::text, '{}');
    elsif (old.archived_at is not null) and (new.archived_at is null) then
      perform private.log_audit('org.restored', new.id, 'organizations', new.id::text, '{}');
    elsif (new.name is distinct from old.name) or (new.slug is distinct from old.slug) then
      perform private.log_audit('org.updated', new.id, 'organizations', new.id::text,
        jsonb_build_object('name', new.name, 'slug', new.slug));
    end if;
  end if;
  return new;
end;
$$;

create trigger organizations_audit
  after insert or update on public.organizations
  for each row execute function private.organizations_audit();

-- volunteer_hours_ledger: audit every ledger write (award + adjustment).
create function private.ledger_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.log_audit(
    case when new.kind = 'award' then 'hours.awarded' else 'hours.adjusted' end,
    new.org_id, 'volunteer_hours_ledger', new.id::text,
    jsonb_build_object('hours', new.hours, 'profile_id', new.profile_id, 'session_id', new.session_id)
  );
  return new;
end;
$$;

create trigger volunteer_hours_ledger_audit
  after insert on public.volunteer_hours_ledger
  for each row execute function private.ledger_audit();
