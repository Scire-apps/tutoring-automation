-- Scire sessions_marketplace (§1.3 table 6, §1.5/§2.4 state machine). ONE table
-- for the whole lifecycle; no row moves, soft cancel, full timeline in audit_log.
-- NO session RPCs: claim and verify are single guarded UPDATEs. RLS ENABLE inside
-- CREATE TABLE. sessions_guard enforces transition legality; sessions_verify_award
-- writes the ledger atomically. The guard references private.can_tutor and the
-- audit/verify triggers reference audit_log / volunteer_hours_ledger, all created
-- in later steps — plpgsql late-binds, and no session row is written before then.

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete restrict,
  requester_id uuid not null,
  tutor_id uuid null,
  org_subject_id uuid not null,
  status public.session_status not null default 'open',
  priority public.priority_level not null default 'normal',
  language text null,
  location_preference public.location_preference not null,
  notes text not null,
  availability jsonb null,
  duration_minutes int null check (duration_minutes between 60 and 180 and duration_minutes % 30 = 0),
  scheduled_at timestamptz null,
  location text null,
  recording_url text null,
  completed_at timestamptz null,
  verification_note text null,
  verified_at timestamptz null,
  verified_by uuid null references public.profiles (id) on delete set null,
  awarded_hours numeric(4,2) null check (awarded_hours > 0 and awarded_hours <= 24),
  cancelled_at timestamptz null,
  cancelled_by uuid null references public.profiles (id) on delete set null,
  cancelled_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- composite FKs keep every session within one org (cross-org unrepresentable).
  constraint sessions_requester_fk
    foreign key (requester_id, org_id) references public.profiles (id, org_id),
  constraint sessions_tutor_fk
    foreign key (tutor_id, org_id) references public.profiles (id, org_id),
  constraint sessions_subject_fk
    foreign key (org_subject_id, org_id) references public.org_subjects (id, org_id) on delete restrict,
  -- a tutor never tutors their own request.
  constraint sessions_tutor_not_requester check (tutor_id is null or tutor_id <> requester_id),
  -- open requests carry no claimer.
  constraint sessions_open_no_tutor check (status <> 'open' or tutor_id is null),
  -- a claimed-or-later (non-cancelled) request has a claimer.
  constraint sessions_claimed_has_tutor
    check (status in ('open', 'cancelled') or tutor_id is not null),
  -- availability + duration exist from availability_set onward.
  constraint sessions_availability_present check (
    status not in ('availability_set', 'scheduled', 'completed', 'needs_changes', 'verified')
    or (availability is not null and duration_minutes is not null)
  ),
  -- a scheduled-or-later session has a scheduled time.
  constraint sessions_scheduled_present check (
    status not in ('scheduled', 'completed', 'needs_changes', 'verified')
    or scheduled_at is not null
  ),
  -- completed / needs_changes / verified carry the recording + completion stamp.
  constraint sessions_completed_present check (
    status not in ('completed', 'needs_changes', 'verified')
    or (completed_at is not null and recording_url is not null)
  ),
  -- needs_changes carries the manager's note.
  constraint sessions_needs_changes_note check (status <> 'needs_changes' or verification_note is not null),
  -- verified carries the verification stamp + awarded hours.
  constraint sessions_verified_present check (
    status <> 'verified' or (verified_at is not null and awarded_hours is not null)
  ),
  -- cancellation stamp is set iff (and only iff) the session is cancelled.
  constraint sessions_cancelled_iff check ((status = 'cancelled') = (cancelled_at is not null))
);
alter table public.sessions enable row level security;

-- Board: open requests, newest first.
create index sessions_open_board_idx on public.sessions (org_id, created_at desc) where status = 'open';
-- General org lists.
create index sessions_org_status_idx on public.sessions (org_id, status, created_at desc);
-- My-requests / my-sessions.
create index sessions_requester_status_idx on public.sessions (requester_id, status);
create index sessions_tutor_status_idx on public.sessions (tutor_id, status);
-- Subject usage counts + FK.
create index sessions_org_subject_idx on public.sessions (org_subject_id);
-- Reminder cron.
create index sessions_scheduled_idx on public.sessions (scheduled_at) where status = 'scheduled';

create trigger sessions_set_updated_at
  before update on public.sessions
  for each row execute function private.set_updated_at();

-- ============================================================================
-- private.sessions_guard  (§1.5/§2.4) BEFORE INSERT/UPDATE.
-- The RLS envelope cannot see OLD; this trigger is the transition authority.
-- Elevated = admin OR active manager of the row's org (any legal transition,
-- audited). Non-elevated = requester | claimer | the atomic third-party claim.
-- ============================================================================
create function private.sessions_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_service boolean := (current_setting('request.jwt.claims', true) is null)
                          or (auth.role() = 'service_role');
  v_uid uuid := auth.uid();
  v_kind public.account_kind;
  v_status public.account_status;
  v_org uuid;
  v_elevated boolean;
  v_is_requester boolean;
  v_is_claimer boolean;
begin
  if tg_op = 'INSERT' then
    -- Identity / lifecycle pins: a new session is always a clean open request.
    if new.status <> 'open' then
      raise exception 'sessions_guard: new sessions must be open';
    end if;
    if new.tutor_id is not null
       or new.availability is not null
       or new.duration_minutes is not null
       or new.scheduled_at is not null
       or new.location is not null
       or new.recording_url is not null
       or new.completed_at is not null
       or new.verification_note is not null
       or new.verified_at is not null
       or new.verified_by is not null
       or new.awarded_hours is not null
       or new.cancelled_at is not null
       or new.cancelled_by is not null
       or new.cancelled_reason is not null then
      raise exception 'sessions_guard: lifecycle fields must be empty on a new request';
    end if;

    if v_is_service then
      return new;
    end if;

    select p.kind, p.status, p.org_id into v_kind, v_status, v_org
      from public.profiles p where p.id = v_uid;
    v_elevated := (v_kind = 'admin')
                  or (v_kind = 'manager' and v_status = 'active' and v_org = new.org_id);

    -- Non-elevated requesters open their OWN request at normal priority.
    if not v_elevated then
      if new.requester_id <> v_uid then
        raise exception 'sessions_guard: you may only open your own request';
      end if;
      if new.priority <> 'normal' then
        raise exception 'sessions_guard: priority is manager-set';
      end if;
    end if;
    return new;
  end if;

  -- ----- UPDATE -----------------------------------------------------------
  -- Identity columns are immutable for everyone.
  if (new.id is distinct from old.id)
     or (new.org_id is distinct from old.org_id)
     or (new.requester_id is distinct from old.requester_id)
     or (new.org_subject_id is distinct from old.org_subject_id)
     or (new.created_at is distinct from old.created_at) then
    raise exception 'sessions_guard: id / org / requester / subject are immutable';
  end if;

  if v_is_service then
    return new;
  end if;

  -- Terminal states accept no further changes (corrections = ledger adjustments).
  if old.status in ('verified', 'cancelled') then
    raise exception 'sessions_guard: % is terminal', old.status;
  end if;

  select p.kind, p.status, p.org_id into v_kind, v_status, v_org
    from public.profiles p where p.id = v_uid;
  v_elevated := (v_kind = 'admin')
                or (v_kind = 'manager' and v_status = 'active' and v_org = old.org_id);
  v_is_requester := (v_uid = old.requester_id);
  v_is_claimer := (old.tutor_id is not null and v_uid = old.tutor_id);

  -- ===== Elevated (admin / org manager): any legal edge in the §1.5 machine ===
  if v_elevated then
    if old.status = 'open' and new.status = 'cancelled' then
      return new;
    elsif old.status = 'claimed' and new.status in ('availability_set', 'open', 'cancelled') then
      return new;
    elsif old.status = 'availability_set' and new.status in ('availability_set', 'scheduled', 'open', 'cancelled') then
      return new;
    elsif old.status = 'scheduled' and new.status in ('completed', 'open', 'cancelled') then
      return new;
    elsif old.status = 'completed' and new.status in ('verified', 'needs_changes', 'cancelled') then
      return new;
    elsif old.status = 'needs_changes' and new.status in ('verified', 'completed', 'cancelled') then
      return new;
    -- In-state priority bump (and other same-status manager edits).
    elsif new.status = old.status then
      return new;
    else
      raise exception 'sessions_guard: illegal manager transition % -> %', old.status, new.status;
    end if;
  end if;

  -- ===== Third-party atomic CLAIM (open + no claimer -> claimed, sets self) ====
  if old.status = 'open' and old.tutor_id is null
     and new.status = 'claimed' and new.tutor_id = v_uid then
    -- ONLY status + tutor_id may change; everything else stays put.
    if (new.priority is distinct from old.priority)
       or (new.language is distinct from old.language)
       or (new.location_preference is distinct from old.location_preference)
       or (new.notes is distinct from old.notes)
       or (new.availability is distinct from old.availability)
       or (new.duration_minutes is distinct from old.duration_minutes)
       or (new.scheduled_at is distinct from old.scheduled_at)
       or (new.location is distinct from old.location)
       or (new.recording_url is distinct from old.recording_url) then
      raise exception 'sessions_guard: a claim may change only status and tutor';
    end if;
    if not private.can_tutor(old.org_subject_id) then
      raise exception 'sessions_guard: not approved to tutor this subject';
    end if;
    return new;
  end if;

  -- ===== Requester (the learner) =============================================
  if v_is_requester then
    -- Set availability + duration after a claim.
    if old.status = 'claimed' and new.status = 'availability_set' then
      return new;
    -- Edit availability while still in availability_set.
    elsif old.status = 'availability_set' and new.status = 'availability_set' then
      return new;
    -- Cancel any pre-completed status (terminal).
    elsif old.status in ('open', 'claimed', 'availability_set', 'scheduled')
          and new.status = 'cancelled' then
      return new;
    else
      raise exception 'sessions_guard: requester may not move % -> %', old.status, new.status;
    end if;
  end if;

  -- ===== Claimer (the tutor) =================================================
  if v_is_claimer then
    -- Schedule the agreed slot.
    if old.status = 'availability_set' and new.status = 'scheduled' then
      return new;
    -- Release the claim back to the board (clears tutor + downstream fields;
    -- the table CHECKs enforce open => tutor/availability/etc. are NULL).
    elsif old.status in ('claimed', 'availability_set', 'scheduled') and new.status = 'open'
          and new.tutor_id is null then
      return new;
    -- Edit the recording link while scheduled or after a change request.
    elsif old.status in ('scheduled', 'needs_changes') and new.status = old.status then
      return new;
    -- Mark complete (recording required by the table CHECK).
    elsif old.status = 'scheduled' and new.status = 'completed' then
      return new;
    -- Resubmit after a change request.
    elsif old.status = 'needs_changes' and new.status = 'completed' then
      return new;
    else
      raise exception 'sessions_guard: claimer may not move % -> %', old.status, new.status;
    end if;
  end if;

  raise exception 'sessions_guard: not permitted to modify this session';
end;
$$;

create trigger sessions_guard
  before insert or update on public.sessions
  for each row execute function private.sessions_guard();

-- ============================================================================
-- private.sessions_audit  — append the session timeline to audit_log.
-- (audit_log is created in step 6; plpgsql late-binds the reference.)
-- ============================================================================
create function private.sessions_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_kind public.account_kind;
  v_action text;
begin
  select p.kind into v_actor_kind from public.profiles p where p.id = v_actor;

  if tg_op = 'INSERT' then
    v_action := 'session.created';
  elsif new.status is distinct from old.status then
    v_action := 'session.' || new.status::text;
  else
    v_action := 'session.updated';
  end if;

  insert into public.audit_log (org_id, actor_id, actor_kind, action, target_table, target_id, metadata)
  values (
    new.org_id, v_actor, v_actor_kind, v_action, 'sessions', new.id,
    jsonb_build_object(
      'from', case when tg_op = 'UPDATE' then old.status::text else null end,
      'to', new.status::text
    )
  );
  return new;
end;
$$;

create trigger sessions_audit
  after insert or update on public.sessions
  for each row execute function private.sessions_audit();

-- ============================================================================
-- private.sessions_verify_award  AFTER UPDATE -> 'verified'.
-- Writes the volunteer-hours award atomically with the verify UPDATE; the
-- partial UNIQUE(session_id) WHERE kind='award' makes a double award impossible.
-- (volunteer_hours_ledger is created in step 6; plpgsql late-binds.)
-- ============================================================================
create function private.sessions_verify_award()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'verified' and old.status is distinct from 'verified' then
    insert into public.volunteer_hours_ledger
      (org_id, profile_id, session_id, kind, hours, note, awarded_by)
    values
      (new.org_id, new.tutor_id, new.id, 'award', new.awarded_hours, new.verification_note, new.verified_by);
  end if;
  return new;
end;
$$;

create trigger sessions_verify_award
  after update on public.sessions
  for each row execute function private.sessions_verify_award();
