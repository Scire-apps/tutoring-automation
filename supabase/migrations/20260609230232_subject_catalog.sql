-- Scire subject_catalog (§1.3 tables 3-5). Tables only (+ their guard / updated_at
-- triggers that carry no forward dependency); the create_organization RPC moves
-- to step 7, the *_audit triggers to step 6 (need audit_log). RLS ENABLE inside
-- each CREATE TABLE. Composite FKs target UNIQUE(id, org_id) so cross-org rows
-- are structurally unrepresentable (MATCH SIMPLE: a NULL key skips pair check).

-- ============================================================================
-- subject_templates  — admin default catalog; edits affect FUTURE org creations.
-- ============================================================================
create table public.subject_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text null,
  grade_level smallint null check (grade_level between 1 and 13),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subject_templates_triple_key unique nulls not distinct (name, category, grade_level)
);
alter table public.subject_templates enable row level security;

create trigger subject_templates_set_updated_at
  before update on public.subject_templates
  for each row execute function private.set_updated_at();

-- ============================================================================
-- org_subjects  — per-org catalog copied from templates at org creation.
-- ============================================================================
create table public.org_subjects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete restrict,
  name text not null,
  category text null,
  grade_level smallint null check (grade_level between 1 and 13),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint org_subjects_triple_key
    unique nulls not distinct (org_id, name, category, grade_level),
  -- composite-FK target for sessions / subject_approvals.
  constraint org_subjects_id_org_key unique (id, org_id)
);
alter table public.org_subjects enable row level security;

create index org_subjects_org_active_idx on public.org_subjects (org_id, active);

create trigger org_subjects_set_updated_at
  before update on public.org_subjects
  for each row execute function private.set_updated_at();

-- ============================================================================
-- subject_approvals  — request queue + grant record UNIFIED; rows never deleted.
-- Same-row model: re-request flips the SAME row back to pending (history = audit).
-- ============================================================================
create table public.subject_approvals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete restrict,
  profile_id uuid not null,
  org_subject_id uuid not null,
  status public.approval_status not null default 'pending',
  evidence text null,
  decision_note text null,
  direct_grant boolean not null default false,
  decided_by uuid null references public.profiles (id) on delete set null,
  decided_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- member-initiated requests must carry evidence; direct grants may not.
  constraint subject_approvals_evidence_ck check (status = 'pending' or evidence is not null),
  -- a direct grant only exists in the approved/revoked states.
  constraint subject_approvals_direct_grant_ck
    check (not direct_grant or status in ('approved', 'revoked')),
  -- decided_* are set together iff the row reached a decided status.
  constraint subject_approvals_decided_ck check (
    (status in ('approved', 'rejected', 'revoked')) = (decided_by is not null and decided_at is not null)
  ),
  -- one row per (member, subject); re-request flips this row.
  constraint subject_approvals_member_subject_key unique (profile_id, org_subject_id),
  -- composite FKs keep approvals within a single org.
  constraint subject_approvals_profile_fk
    foreign key (profile_id, org_id) references public.profiles (id, org_id),
  constraint subject_approvals_subject_fk
    foreign key (org_subject_id, org_id) references public.org_subjects (id, org_id) on delete cascade
);
alter table public.subject_approvals enable row level security;

create index subject_approvals_org_status_idx on public.subject_approvals (org_id, status);
create index subject_approvals_profile_idx on public.subject_approvals (profile_id);
create index subject_approvals_org_subject_idx on public.subject_approvals (org_subject_id);

create trigger subject_approvals_set_updated_at
  before update on public.subject_approvals
  for each row execute function private.set_updated_at();

-- ============================================================================
-- private.approvals_guard  (§1.5/§2.4) BEFORE INSERT/UPDATE.
-- member_id must be a member (blocks manager self-grant); member/org/subject
-- immutable on update. Transition legality (who may move which status) is
-- enforced jointly with the RLS WITH CHECK policies in step 8.
-- ============================================================================
create function private.approvals_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind public.account_kind;
begin
  if tg_op = 'INSERT' then
    select p.kind into v_kind from public.profiles p where p.id = new.profile_id;
    if v_kind is distinct from 'member' then
      raise exception 'approvals_guard: subject approvals belong to members only';
    end if;
  elsif tg_op = 'UPDATE' then
    if (new.profile_id is distinct from old.profile_id)
       or (new.org_id is distinct from old.org_id)
       or (new.org_subject_id is distinct from old.org_subject_id) then
      raise exception 'approvals_guard: member / org / subject are immutable';
    end if;
  end if;
  return new;
end;
$$;

create trigger subject_approvals_guard
  before insert or update on public.subject_approvals
  for each row execute function private.approvals_guard();
