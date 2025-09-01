-- =========================================================
-- Tutoring Automation - Supabase schema + RLS
-- Safe to run in a fresh project. Idempotent where possible.
-- =========================================================

-- 0) Extensions and helpers
create extension if not exists pgcrypto; -- gen_random_uuid()
-- (Optional) create extension if not exists "uuid-ossp";

-- Generic trigger to maintain updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- =========================================================
-- 1) Tables (order matters)
-- =========================================================

-- Schools
create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Admins
create table if not exists public.admins (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid not null unique,
  email text not null unique,
  first_name text not null,
  last_name text not null,
  school_id uuid references public.schools(id) on delete set null,
  role text not null default 'admin' check (role = 'admin'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tutors
create table if not exists public.tutors (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid not null unique,
  email text not null unique,
  first_name text not null,
  last_name text not null,
  school_id uuid references public.schools(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','active','suspended')),
  volunteer_hours numeric not null default 0,
  approved_subject_ids uuid[] not null default '{}'::uuid[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tutees
create table if not exists public.tutees (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid not null unique,
  email text not null unique,
  first_name text not null,
  last_name text not null,
  school_id uuid references public.schools(id) on delete set null,
  graduation_year integer,
  subjects jsonb,
  pronouns text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Back-compat table (not used by app logic, but referenced in one admin list select)
-- Lets PostgREST nested select subject:subjects(...) succeed harmlessly even if null
create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  grade_level text
);

-- Subject approvals (embedded subject fields are the source of truth)
create table if not exists public.subject_approvals (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.tutors(id) on delete cascade,
  approved_by uuid references public.admins(id) on delete set null,
  approved_at timestamptz,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  subject_name text check (char_length(subject_name) > 0),
  subject_type text check (subject_type in ('Academic','ALP','IB')),
  subject_grade text check (subject_grade in ('9','10','11','12')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tutor certification requests (for admins to review -> subject_approvals)
create table if not exists public.certification_requests (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.tutors(id) on delete cascade,
  tutor_name text not null,
  subject_name text not null,
  subject_type text not null check (subject_type in ('Academic','ALP','IB')),
  subject_grade text not null check (subject_grade in ('9','10','11','12')),
  tutor_mark text,
  created_at timestamptz not null default now()
);

-- Tutoring opportunities (single-session flow; embedded subject fields)
create table if not exists public.tutoring_opportunities (
  id uuid primary key default gen_random_uuid(),
  tutee_id uuid references public.tutees(id) on delete set null,
  status text not null default 'open' check (status in ('open','assigned','completed','cancelled')),
  priority text not null default 'normal' check (priority in ('low','normal','high')),
  availability jsonb,
  subject_name text check (char_length(subject_name) > 0),
  subject_type text check (subject_type in ('Academic','ALP','IB')),
  subject_grade text check (subject_grade in ('9','10','11','12')),
  language text,
  location_preference text,
  additional_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tutoring jobs (single-session; embedded subject fields + compat subject_id)
create table if not exists public.tutoring_jobs (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.tutors(id) on delete cascade,
  tutee_id uuid not null references public.tutees(id) on delete cascade,
  opportunity_id uuid references public.tutoring_opportunities(id) on delete set null,
  subject_id uuid references public.subjects(id) on delete set null, -- back-compat only
  scheduled_time timestamptz,
  location text,
  opportunity_snapshot jsonb,
  finalized_schedule jsonb not null default '[]'::jsonb,
  subject_name text check (char_length(subject_name) > 0),
  subject_type text check (subject_type in ('Academic','ALP','IB')),
  subject_grade text check (subject_grade in ('9','10','11','12')),
  language text,
  tutee_availability jsonb,
  duration_minutes integer check (duration_minutes >= 0 and duration_minutes <= 720),
  desired_duration_minutes integer check (desired_duration_minutes >= 60 and desired_duration_minutes <= 180),
  status text not null default 'pending_tutee_scheduling'
    check (status in ('pending_tutee_scheduling','pending_tutor_scheduling','scheduled','cancelled')),
  additional_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Jobs awaiting admin verification (after tutor completion)
create table if not exists public.awaiting_verification_jobs (
  id uuid primary key, -- same id as the original job
  opportunity_id uuid,
  tutor_id uuid not null references public.tutors(id) on delete cascade,
  tutee_id uuid not null references public.tutees(id) on delete cascade,
  subject_name text not null check (char_length(subject_name) > 0),
  subject_type text not null check (subject_type in ('Academic','ALP','IB')),
  subject_grade text not null check (subject_grade in ('9','10','11','12')),
  language text default 'English',
  tutee_availability jsonb,
  desired_duration_minutes integer,
  scheduled_time timestamptz,
  duration_minutes integer,
  opportunity_snapshot jsonb,
  location text,
  status text not null default 'awaiting_admin_verification',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Past (verified) jobs archive
create table if not exists public.past_jobs (
  id uuid primary key, -- same id as the original job
  opportunity_id uuid,
  tutor_id uuid not null references public.tutors(id) on delete cascade,
  tutee_id uuid not null references public.tutees(id) on delete cascade,
  subject_name text not null check (char_length(subject_name) > 0),
  subject_type text not null check (subject_type in ('Academic','ALP','IB')),
  subject_grade text not null check (subject_grade in ('9','10','11','12')),
  language text,
  tutee_availability jsonb,
  desired_duration_minutes integer,
  scheduled_time timestamptz,
  duration_minutes integer,
  opportunity_snapshot jsonb,
  location text,
  verified_by uuid references public.admins(id) on delete set null,
  verified_at timestamptz,
  awarded_volunteer_hours numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Communications log
create table if not exists public.communications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.tutoring_jobs(id) on delete cascade,
  opportunity_id uuid references public.tutoring_opportunities(id) on delete cascade,
  type text not null check (type in ('email','notification')),
  recipient text not null,
  subject text,
  content text,
  status text not null default 'pending' check (status in ('pending','sent','failed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Session recordings (soft-reference to job_id; keep unique but no FK)
create table if not exists public.session_recordings (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique,
  recording_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =========================================================
-- 2) Indexes
-- =========================================================
create index if not exists idx_tutors_auth_id on public.tutors(auth_id);
create index if not exists idx_tutees_auth_id on public.tutees(auth_id);
create index if not exists idx_jobs_tutor_id on public.tutoring_jobs(tutor_id);
create index if not exists idx_jobs_tutee_id on public.tutoring_jobs(tutee_id);
create index if not exists idx_jobs_status on public.tutoring_jobs(status);
create index if not exists idx_jobs_created_at on public.tutoring_jobs(created_at desc);
create index if not exists idx_opps_status on public.tutoring_opportunities(status);
create index if not exists idx_opps_tutee_id on public.tutoring_opportunities(tutee_id);
create index if not exists idx_opps_created_at on public.tutoring_opportunities(created_at desc);
create index if not exists idx_awaiting_tutor_id on public.awaiting_verification_jobs(tutor_id);
create index if not exists idx_past_jobs_tutor_id on public.past_jobs(tutor_id);
create index if not exists idx_subject_approvals_tutor on public.subject_approvals(tutor_id, status, subject_type, subject_grade);
create index if not exists idx_cert_requests_tutor on public.certification_requests(tutor_id);

-- =========================================================
-- 3) Updated-at triggers
-- =========================================================
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_set_updated_at_schools') then
    create trigger trg_set_updated_at_schools before update on public.schools
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_set_updated_at_admins') then
    create trigger trg_set_updated_at_admins before update on public.admins
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_set_updated_at_tutors') then
    create trigger trg_set_updated_at_tutors before update on public.tutors
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_set_updated_at_tutees') then
    create trigger trg_set_updated_at_tutees before update on public.tutees
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_set_updated_at_subject_approvals') then
    create trigger trg_set_updated_at_subject_approvals before update on public.subject_approvals
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_set_updated_at_tutoring_opportunities') then
    create trigger trg_set_updated_at_tutoring_opportunities before update on public.tutoring_opportunities
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_set_updated_at_tutoring_jobs') then
    create trigger trg_set_updated_at_tutoring_jobs before update on public.tutoring_jobs
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_set_updated_at_awaiting_verification_jobs') then
    create trigger trg_set_updated_at_awaiting_verification_jobs before update on public.awaiting_verification_jobs
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_set_updated_at_past_jobs') then
    create trigger trg_set_updated_at_past_jobs before update on public.past_jobs
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_set_updated_at_communications') then
    create trigger trg_set_updated_at_communications before update on public.communications
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_set_updated_at_session_recordings') then
    create trigger trg_set_updated_at_session_recordings before update on public.session_recordings
    for each row execute function public.set_updated_at();
  end if;
  
  -- Help questions updated_at trigger will be created after table definition
end$$;

-- Helper: check if current user is an admin
-- NOTE: Placed after tables are created to avoid dependency errors
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.admins a
    where a.auth_id = auth.uid()
  );
$$;

-- =========================================================
-- 4) Row Level Security (RLS) policies
-- keep data safe if any client accesses tables directly.
-- =========================================================

-- Enable RLS
alter table public.schools enable row level security;
alter table public.admins enable row level security;
alter table public.tutors enable row level security;
alter table public.tutees enable row level security;
alter table public.subjects enable row level security;
alter table public.subject_approvals enable row level security;
alter table public.certification_requests enable row level security;
alter table public.tutoring_opportunities enable row level security;
alter table public.tutoring_jobs enable row level security;
alter table public.awaiting_verification_jobs enable row level security;
alter table public.past_jobs enable row level security;
alter table public.communications enable row level security;
alter table public.session_recordings enable row level security;
-- New table help_questions will be enabled after creation

-- Schools: public read, writes by admins
drop policy if exists "public can read schools" on public.schools;
create policy "public can read schools"
  on public.schools for select
  to anon, authenticated
  using (true);

drop policy if exists "admins manage schools" on public.schools;
create policy "admins manage schools"
  on public.schools for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Admins: only admins can read/manage
drop policy if exists "admins read admins" on public.admins;
create policy "admins read admins"
  on public.admins for select
  to authenticated
  using (auth.uid() = auth_id);

drop policy if exists "admins write admins" on public.admins;
create policy "admins write admins"
  on public.admins for all
  to authenticated
  using (auth.uid() = auth_id)
  with check (auth.uid() = auth_id);

-- Tutors: self read/write; admins full
drop policy if exists "tutors self select or admin" on public.tutors;
create policy "tutors self select or admin"
  on public.tutors for select
  to authenticated
  using (public.is_admin() or auth.uid() = auth_id);

drop policy if exists "tutors self upsert" on public.tutors;
create policy "tutors self upsert"
  on public.tutors for insert
  to authenticated
  with check (auth.uid() = auth_id);

drop policy if exists "tutors self update or admin" on public.tutors;
create policy "tutors self update or admin"
  on public.tutors for update
  to authenticated
  using (public.is_admin() or auth.uid() = auth_id)
  with check (public.is_admin() or auth.uid() = auth_id);

drop policy if exists "tutors delete admin only" on public.tutors;
create policy "tutors delete admin only"
  on public.tutors for delete
  to authenticated
  using (public.is_admin());

-- Tutees: self read/write; admins full
drop policy if exists "tutees self select or admin" on public.tutees;
create policy "tutees select self admin or same school tutor"
  on public.tutees for select
  to authenticated
  using (
    public.is_admin()
    or auth.uid() = auth_id
    or exists (
      select 1
      from public.tutors tu
      where tu.auth_id = auth.uid()
        and tu.school_id is not null
        and tu.school_id = tutees.school_id
    )
  );

drop policy if exists "tutees self upsert" on public.tutees;
create policy "tutees self upsert"
  on public.tutees for insert
  to authenticated
  with check (auth.uid() = auth_id);

drop policy if exists "tutees self update or admin" on public.tutees;
create policy "tutees self update or admin"
  on public.tutees for update
  to authenticated
  using (public.is_admin() or auth.uid() = auth_id)
  with check (public.is_admin() or auth.uid() = auth_id);

drop policy if exists "tutees delete admin only" on public.tutees;
create policy "tutees delete admin only"
  on public.tutees for delete
  to authenticated
  using (public.is_admin());

-- Subjects (compat): restrict to admins
drop policy if exists "subjects admin only" on public.subjects;
create policy "subjects admin only"
  on public.subjects for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Subject approvals: tutor can read own, admin manage
drop policy if exists "approvals select own or admin" on public.subject_approvals;
create policy "approvals select own or admin"
  on public.subject_approvals for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.tutors t
      where t.id = subject_approvals.tutor_id and t.auth_id = auth.uid()
    )
  );

drop policy if exists "approvals write admin only" on public.subject_approvals;
create policy "approvals write admin only"
  on public.subject_approvals for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Certification requests: tutors create/list own; admin list/manage
drop policy if exists "cert req select own or admin" on public.certification_requests;
create policy "cert req select own or admin"
  on public.certification_requests for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.tutors t
      where t.id = certification_requests.tutor_id and t.auth_id = auth.uid()
    )
  );

drop policy if exists "cert req insert by tutor only" on public.certification_requests;
create policy "cert req insert by tutor only"
  on public.certification_requests for insert
  to authenticated
  with check (
    exists (
      select 1 from public.tutors t
      where t.id = certification_requests.tutor_id and t.auth_id = auth.uid()
    )
  );

drop policy if exists "cert req delete admin only" on public.certification_requests;
create policy "cert req delete admin only"
  on public.certification_requests for delete
  to authenticated
  using (public.is_admin());

-- Opportunities: admin all; tutee own; tutors see 'open'
drop policy if exists "opps select admin tutee or tutor open" on public.tutoring_opportunities;
create policy "opps select admin tutee or tutor open"
  on public.tutoring_opportunities for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.tutees te
      where te.id = tutoring_opportunities.tutee_id and te.auth_id = auth.uid()
    )
    or (
      exists (select 1 from public.tutors tu where tu.auth_id = auth.uid())
      and tutoring_opportunities.status = 'open'
    )
  );

drop policy if exists "opps insert by tutee only" on public.tutoring_opportunities;
create policy "opps insert by tutee only"
  on public.tutoring_opportunities for insert
  to authenticated
  with check (
    exists (
      select 1 from public.tutees te
      where te.id = tutoring_opportunities.tutee_id and te.auth_id = auth.uid()
    )
  );

drop policy if exists "opps update tutee own open or admin" on public.tutoring_opportunities;
create policy "opps update tutee own open or admin"
  on public.tutoring_opportunities for update
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.tutees te
      where te.id = tutoring_opportunities.tutee_id and te.auth_id = auth.uid()
    )
  )
  with check (
    public.is_admin()
    or (
      exists (
        select 1 from public.tutees te
        where te.id = tutoring_opportunities.tutee_id and te.auth_id = auth.uid()
      )
      and tutoring_opportunities.status = 'open'
    )
  );

drop policy if exists "opps delete admin only" on public.tutoring_opportunities;
create policy "opps delete admin only"
  on public.tutoring_opportunities for delete
  to authenticated
  using (public.is_admin());

-- Jobs: admin all; tutor/tutee own read; updates restricted to owners or admin; deletes tutor owner or admin
drop policy if exists "jobs select own or admin" on public.tutoring_jobs;
create policy "jobs select own or admin"
  on public.tutoring_jobs for select
  to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.tutors tu where tu.id = tutoring_jobs.tutor_id and tu.auth_id = auth.uid())
    or exists (select 1 from public.tutees te where te.id = tutoring_jobs.tutee_id and te.auth_id = auth.uid())
  );

drop policy if exists "jobs insert admin or tutor self" on public.tutoring_jobs;
create policy "jobs insert admin or tutor self"
  on public.tutoring_jobs for insert
  to authenticated
  with check (
    public.is_admin()
    or exists (select 1 from public.tutors tu where tu.id = tutoring_jobs.tutor_id and tu.auth_id = auth.uid())
  );

drop policy if exists "jobs update owners or admin" on public.tutoring_jobs;
create policy "jobs update owners or admin"
  on public.tutoring_jobs for update
  to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.tutors tu where tu.id = tutoring_jobs.tutor_id and tu.auth_id = auth.uid())
    or exists (select 1 from public.tutees te where te.id = tutoring_jobs.tutee_id and te.auth_id = auth.uid())
  )
  with check (
    public.is_admin()
    or exists (select 1 from public.tutors tu where tu.id = tutoring_jobs.tutor_id and tu.auth_id = auth.uid())
    or exists (select 1 from public.tutees te where te.id = tutoring_jobs.tutee_id and te.auth_id = auth.uid())
  );

drop policy if exists "jobs delete admin or tutor owner" on public.tutoring_jobs;
create policy "jobs delete admin or tutor owner"
  on public.tutoring_jobs for delete
  to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.tutors tu where tu.id = tutoring_jobs.tutor_id and tu.auth_id = auth.uid())
  );

-- Awaiting verification: admin all; tutor can see own; insert by tutor/admin
drop policy if exists "awaiting select own or admin" on public.awaiting_verification_jobs;
create policy "awaiting select own or admin"
  on public.awaiting_verification_jobs for select
  to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.tutors tu where tu.id = awaiting_verification_jobs.tutor_id and tu.auth_id = auth.uid())
  );

drop policy if exists "awaiting insert tutor or admin" on public.awaiting_verification_jobs;
create policy "awaiting insert tutor or admin"
  on public.awaiting_verification_jobs for insert
  to authenticated
  with check (
    public.is_admin()
    or exists (select 1 from public.tutors tu where tu.id = awaiting_verification_jobs.tutor_id and tu.auth_id = auth.uid())
  );

-- Split update and delete into separate policies to avoid syntax error
drop policy if exists "awaiting update admin only" on public.awaiting_verification_jobs;
create policy "awaiting update admin only"
  on public.awaiting_verification_jobs for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "awaiting delete admin only" on public.awaiting_verification_jobs;
create policy "awaiting delete admin only"
  on public.awaiting_verification_jobs for delete
  to authenticated
  using (public.is_admin());

-- Past jobs: admin all; tutors can read own
drop policy if exists "past select own or admin" on public.past_jobs;
create policy "past select own or admin"
  on public.past_jobs for select
  to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.tutors tu where tu.id = past_jobs.tutor_id and tu.auth_id = auth.uid())
  );

drop policy if exists "past write admin only" on public.past_jobs;
create policy "past write admin only"
  on public.past_jobs for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Communications: admin only
drop policy if exists "comms admin only" on public.communications;
create policy "comms admin only"
  on public.communications for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Session recordings: admin; tutors can manage for their own job
drop policy if exists "recordings select own or admin" on public.session_recordings;
create policy "recordings select own or admin"
  on public.session_recordings for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.tutoring_jobs j
      join public.tutors tu on tu.id = j.tutor_id
      where j.id = session_recordings.job_id and tu.auth_id = auth.uid()
    )
  );

-- Split insert and update to avoid combined action syntax
drop policy if exists "recordings insert tutor or admin" on public.session_recordings;
create policy "recordings insert tutor or admin"
  on public.session_recordings for insert
  to authenticated
  with check (
    public.is_admin()
    or exists (
      select 1
      from public.tutoring_jobs j
      join public.tutors tu on tu.id = j.tutor_id
      where j.id = session_recordings.job_id
        and tu.auth_id = auth.uid()
    )
  );

drop policy if exists "recordings update tutor or admin" on public.session_recordings;
create policy "recordings update tutor or admin"
  on public.session_recordings for update
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.tutoring_jobs j
      join public.tutors tu on tu.id = j.tutor_id
      where j.id = session_recordings.job_id
        and tu.auth_id = auth.uid()
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1
      from public.tutoring_jobs j
      join public.tutors tu on tu.id = j.tutor_id
      where j.id = session_recordings.job_id
        and tu.auth_id = auth.uid()
    )
  );

drop policy if exists "recordings delete admin only" on public.session_recordings;
create policy "recordings delete admin only"
  on public.session_recordings for delete
  to authenticated
  using (public.is_admin());

-- (No storage bucket setup required: session_recordings.recording_url stores external links)

-- =========================================================
-- 5) Help Questions (support requests)
-- =========================================================

create table if not exists public.help_questions (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid not null,
  role text not null check (role in ('tutor','tutee')),
  tutor_id uuid references public.tutors(id) on delete set null,
  tutee_id uuid references public.tutees(id) on delete set null,
  school_id uuid references public.schools(id) on delete set null,
  user_first_name text not null,
  user_last_name text not null,
  user_email text not null,
  user_grade text,
  submitted_at timestamptz not null default now(),
  urgency text not null default 'normal' check (urgency in ('low','normal','high')),
  description text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for help_questions
create index if not exists idx_help_questions_auth_id on public.help_questions(auth_id);
create index if not exists idx_help_questions_school_id on public.help_questions(school_id);
create index if not exists idx_help_questions_submitted_at on public.help_questions(submitted_at desc);

-- updated_at trigger for help_questions
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_set_updated_at_help_questions') then
    create trigger trg_set_updated_at_help_questions before update on public.help_questions
    for each row execute function public.set_updated_at();
  end if;
end$$;

-- Enable RLS
alter table public.help_questions enable row level security;

-- RLS policies for help_questions
-- Tutors/tutees: may insert their own request; may read only their own rows.
-- Admins: may read/update/delete requests from users within the same school.

drop policy if exists "hq select self or admin same school" on public.help_questions;
create policy "hq select self or admin same school"
  on public.help_questions for select
  to authenticated
  using (
    auth.uid() = auth_id
    or exists (
      select 1 from public.admins a
      where a.auth_id = auth.uid() and a.school_id = help_questions.school_id
    )
  );

drop policy if exists "hq insert self only" on public.help_questions;
create policy "hq insert self only"
  on public.help_questions for insert
  to authenticated
  with check (auth.uid() = auth_id);

drop policy if exists "hq update admin same school" on public.help_questions;
create policy "hq update admin same school"
  on public.help_questions for update
  to authenticated
  using (
    exists (
      select 1 from public.admins a
      where a.auth_id = auth.uid() and a.school_id = help_questions.school_id
    )
  )
  with check (
    exists (
      select 1 from public.admins a
      where a.auth_id = auth.uid() and a.school_id = help_questions.school_id
    )
  );

drop policy if exists "hq delete admin same school" on public.help_questions;
create policy "hq delete admin same school"
  on public.help_questions for delete
  to authenticated
  using (
    exists (
      select 1 from public.admins a
      where a.auth_id = auth.uid() and a.school_id = help_questions.school_id
    )
  );
