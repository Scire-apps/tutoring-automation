-- Tutoring Automation - Complete Supabase Schema (clean setup)
-- Run this whole script in the Supabase SQL editor on a fresh project.

-- 1) Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- 2) Tables

-- Schools
create table public.schools (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  domain text not null unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Tutors
create table public.tutors (
  id uuid primary key default uuid_generate_v4(),
  auth_id uuid not null unique,
  email text not null unique,
  first_name text not null,
  last_name text not null,
  school_id uuid references public.schools(id),
  status text not null default 'pending' check (status in ('pending','active','suspended')),
  volunteer_hours numeric(10,2) default 0,
  approved_subject_ids uuid[] default '{}'::uuid[], -- denormalized helper (not enforced)
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Tutees
create table public.tutees (
  id uuid primary key default uuid_generate_v4(),
  auth_id uuid not null unique,
  email text not null unique,
  first_name text not null,
  last_name text not null,
  school_id uuid references public.schools(id),
  graduation_year int,
  subjects jsonb, -- array of subject names
  pronouns text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Subjects table removed. Subject data is now embedded per row (name, type, grade)

-- Admins (initially allows 'admin' and 'superadmin'; merged below)
create table public.admins (
  id uuid primary key default uuid_generate_v4(),
  auth_id uuid not null unique,
  email text not null unique,
  first_name text not null,
  last_name text not null,
  school_id uuid references public.schools(id),
  role text not null default 'admin' check (role in ('admin','superadmin')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.subject_approvals (
  id uuid primary key default uuid_generate_v4(),
  tutor_id uuid not null references public.tutors(id),
  subject_name text not null check (subject_name in ('Math','English','Science')),
  subject_type text not null check (subject_type in ('Academic','ALP','IB')),
  subject_grade text not null check (subject_grade in ('9','10','11','12')),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  approved_by uuid references public.admins(id),
  approved_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(tutor_id, subject_name, subject_type, subject_grade)
);

create table public.tutoring_opportunities (
  id uuid primary key default uuid_generate_v4(),
  tutee_id uuid references public.tutees(id),
  subject_name text not null check (subject_name in ('Math','English','Science')),
  subject_type text not null check (subject_type in ('Academic','ALP','IB')),
  subject_grade text not null check (subject_grade in ('9','10','11','12')),
  sessions_per_week int not null default 1 check (sessions_per_week > 0),
  availability jsonb default null, -- single-session flow: initially null; later a date map {"YYYY-MM-DD":["HH:MM-HH:MM"]}
  location_preference text,
  additional_notes text,
  status text not null default 'open' check (status in ('open','assigned','completed','cancelled')),
  priority text not null default 'normal' check (priority in ('low','normal','high')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.tutoring_jobs (
  id uuid primary key default uuid_generate_v4(),
  opportunity_id uuid references public.tutoring_opportunities(id) on delete set null,
  tutor_id uuid not null references public.tutors(id),
  tutee_id uuid not null references public.tutees(id),
  subject_name text not null check (subject_name in ('Math','English','Science')),
  subject_type text not null check (subject_type in ('Academic','ALP','IB')),
  subject_grade text not null check (subject_grade in ('9','10','11','12')),
  -- single-session scheduling fields
  tutee_availability jsonb, -- {"YYYY-MM-DD":["HH:MM-HH:MM", ...]}
  desired_duration_minutes int, -- 60..180
  scheduled_time timestamptz,
  duration_minutes int,
  opportunity_snapshot jsonb, -- denormalized details at time of acceptance
  location text,
  status text not null default 'pending_tutee_scheduling' check (status in ('pending_tutee_scheduling','pending_tutor_scheduling','scheduled','cancelled')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Session recordings: store an external link per job
create table public.session_recordings (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid not null, -- references the job id across its lifecycle
  recording_url text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(job_id)
);

-- Jobs awaiting admin verification (mirror of tutoring_jobs)
create table public.awaiting_verification_jobs (
  id uuid primary key, -- use original job id for continuity
  opportunity_id uuid,
  tutor_id uuid not null references public.tutors(id),
  tutee_id uuid not null references public.tutees(id),
  subject_name text not null check (subject_name in ('Math','English','Science')),
  subject_type text not null check (subject_type in ('Academic','ALP','IB')),
  subject_grade text not null check (subject_grade in ('9','10','11','12')),
  tutee_availability jsonb,
  desired_duration_minutes int,
  scheduled_time timestamptz,
  duration_minutes int,
  opportunity_snapshot jsonb,
  location text,
  status text not null default 'awaiting_admin_verification',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Archive of completed/verified jobs
create table public.past_jobs (
  id uuid primary key, -- keep same id for traceability
  opportunity_id uuid,
  tutor_id uuid not null references public.tutors(id),
  tutee_id uuid not null references public.tutees(id),
  subject_name text not null check (subject_name in ('Math','English','Science')),
  subject_type text not null check (subject_type in ('Academic','ALP','IB')),
  subject_grade text not null check (subject_grade in ('9','10','11','12')),
  tutee_availability jsonb,
  desired_duration_minutes int,
  scheduled_time timestamptz,
  duration_minutes int,
  opportunity_snapshot jsonb,
  location text,
  verified_by uuid references public.admins(id),
  verified_at timestamptz,
  awarded_volunteer_hours numeric(10,2) default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Communications (email/notifications)
create table public.communications (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid references public.tutoring_jobs(id),
  opportunity_id uuid references public.tutoring_opportunities(id),
  type text not null check (type in ('email','notification')),
  recipient text not null,
  subject text,
  content text,
  status text not null default 'pending' check (status in ('pending','sent','failed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3) Indexes
create index idx_tutors_school_id on public.tutors(school_id);
create index idx_tutoring_opportunities_status on public.tutoring_opportunities(status);
create index idx_tutoring_opportunities_priority on public.tutoring_opportunities(priority);
create index idx_tutoring_opportunities_tutee_id on public.tutoring_opportunities(tutee_id);
-- Subject composite indexes for faster matching
create index idx_tutoring_opportunities_subject on public.tutoring_opportunities(subject_name, subject_type, subject_grade);
create index idx_tutoring_jobs_tutor_id on public.tutoring_jobs(tutor_id);
create index idx_tutoring_jobs_tutee_id on public.tutoring_jobs(tutee_id);
create index idx_tutoring_jobs_opportunity_id on public.tutoring_jobs(opportunity_id);
create index idx_tutoring_jobs_subject on public.tutoring_jobs(subject_name, subject_type, subject_grade);
create index idx_session_recordings_job_id on public.session_recordings(job_id);
create index idx_awaiting_verification_tutor_id on public.awaiting_verification_jobs(tutor_id);
create index idx_past_jobs_tutor_id on public.past_jobs(tutor_id);
create index idx_communications_job_id on public.communications(job_id);
create index idx_communications_opportunity_id on public.communications(opportunity_id);
create index idx_subject_approvals_tutor_id on public.subject_approvals(tutor_id);
create index idx_subject_approvals_subject_id on public.subject_approvals(subject_id);

-- 4) Enable RLS
alter table public.schools enable row level security;
alter table public.tutors enable row level security;
alter table public.tutees enable row level security;
alter table public.subject_approvals enable row level security;
alter table public.tutoring_opportunities enable row level security;
alter table public.tutoring_jobs enable row level security;
alter table public.session_recordings enable row level security;
alter table public.awaiting_verification_jobs enable row level security;
alter table public.past_jobs enable row level security;
alter table public.communications enable row level security;
alter table public.admins enable row level security;

-- 5) Policies

-- Schools: readable by any authenticated user
create policy schools_select on public.schools
  for select using (auth.role() = 'authenticated');

-- Tutors: self + admins
create policy tutors_select on public.tutors
  for select using (
    auth.uid() = auth_id or exists (select 1 from public.admins where auth_id = auth.uid())
  );
create policy tutors_insert_self on public.tutors
  for insert with check (auth.uid() = auth_id);
create policy tutors_update_self on public.tutors
  for update using (auth.uid() = auth_id) with check (auth.uid() = auth_id);

-- Tutees: self + admins
create policy tutees_select on public.tutees
  for select using (
    auth.uid() = auth_id or exists (select 1 from public.admins where auth_id = auth.uid())
  );
create policy tutees_insert_self on public.tutees
  for insert with check (auth.uid() = auth_id);
create policy tutees_update_self on public.tutees
  for update using (auth.uid() = auth_id) with check (auth.uid() = auth_id);


-- Subject approvals: tutor themselves or admins
create policy subject_approvals_select on public.subject_approvals
  for select using (
    exists (select 1 from public.tutors where auth_id = auth.uid() and id = subject_approvals.tutor_id)
    or exists (select 1 from public.admins where auth_id = auth.uid())
  );

-- Tutoring opportunities:
-- - Tutors can view all open
-- - Tutees can view their own
-- - Admins can view all
create policy tutoring_opportunities_select on public.tutoring_opportunities
  for select using (
    (status = 'open' and exists (select 1 from public.tutors where auth_id = auth.uid()))
    or exists (select 1 from public.admins where auth_id = auth.uid())
    or exists (select 1 from public.tutees where auth_id = auth.uid() and id = tutoring_opportunities.tutee_id)
  );
-- Allow tutees to insert their own records (optional; backend uses service role anyway)
create policy tutoring_opportunities_insert_tutee on public.tutoring_opportunities
  for insert with check (
    exists (select 1 from public.tutees where auth_id = auth.uid() and id = tutee_id)
  );
-- Allow tutees to update their own records (optional)
create policy tutoring_opportunities_update_tutee on public.tutoring_opportunities
  for update using (
    exists (select 1 from public.tutees where auth_id = auth.uid() and id = tutee_id)
  ) with check (
    exists (select 1 from public.tutees where auth_id = auth.uid() and id = tutee_id)
  );

-- Tutoring jobs: visible to assigned tutor, related tutee, or admins
create policy tutoring_jobs_select on public.tutoring_jobs
  for select using (
    exists (select 1 from public.tutors where auth_id = auth.uid() and id = tutoring_jobs.tutor_id)
    or exists (select 1 from public.tutees where auth_id = auth.uid() and id = tutoring_jobs.tutee_id)
    or exists (select 1 from public.admins where auth_id = auth.uid())
  );

-- Awaiting verification jobs: visible to admins and assigned tutor
create policy awaiting_verification_select on public.awaiting_verification_jobs
  for select using (
    exists (select 1 from public.admins where auth_id = auth.uid()) or
    exists (select 1 from public.tutors where auth_id = auth.uid() and id = awaiting_verification_jobs.tutor_id)
  );

-- Past jobs: visible to admins and assigned tutor (and related tutee)
create policy past_jobs_select on public.past_jobs
  for select using (
    exists (select 1 from public.admins where auth_id = auth.uid()) or
    exists (select 1 from public.tutors where auth_id = auth.uid() and id = past_jobs.tutor_id) or
    exists (select 1 from public.tutees where auth_id = auth.uid() and id = past_jobs.tutee_id)
  );

-- Session recordings: visible to assigned tutor, related tutee, or admins
create policy session_recordings_select on public.session_recordings
  for select using (
    exists (
      select 1 from public.tutoring_jobs
      join public.tutors on tutoring_jobs.tutor_id = tutors.id
      where tutoring_jobs.id = session_recordings.job_id and tutors.auth_id = auth.uid()
    )
    or exists (
      select 1 from public.tutoring_jobs
      join public.tutees on tutoring_jobs.tutee_id = tutees.id
      where tutoring_jobs.id = session_recordings.job_id and tutees.auth_id = auth.uid()
    )
    or exists (select 1 from public.admins where auth_id = auth.uid())
  );

-- Allow tutors to insert/update their own job's recording link
create policy session_recordings_upsert on public.session_recordings
  for insert with check (
    exists (
      select 1 from public.tutoring_jobs
      join public.tutors on tutoring_jobs.tutor_id = tutors.id
      where tutoring_jobs.id = session_recordings.job_id and tutors.auth_id = auth.uid()
    )
  );

create policy session_recordings_update on public.session_recordings
  for update using (
    exists (
      select 1 from public.tutoring_jobs
      join public.tutors on tutoring_jobs.tutor_id = tutors.id
      where tutoring_jobs.id = session_recordings.job_id and tutors.auth_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.tutoring_jobs
      join public.tutors on tutoring_jobs.tutor_id = tutors.id
      where tutoring_jobs.id = session_recordings.job_id and tutors.auth_id = auth.uid()
    )
  );

-- Communications: visible to related tutor, related tutee, or admins
create policy communications_select on public.communications
  for select using (
    exists (
      select 1 from public.tutoring_jobs
      join public.tutors on tutoring_jobs.tutor_id = tutors.id
      where tutoring_jobs.id = communications.job_id and tutors.auth_id = auth.uid()
    )
    or exists (
      select 1 from public.tutoring_jobs
      join public.tutees on tutoring_jobs.tutee_id = tutees.id
      where tutoring_jobs.id = communications.job_id and tutees.auth_id = auth.uid()
    )
    or exists (select 1 from public.admins where auth_id = auth.uid())
  );

-- Admins: only superadmins can read admin rows (will be replaced by merge block below)
create policy admins_select on public.admins
  for select using (
    exists (select 1 from public.admins where auth_id = auth.uid() and role = 'superadmin')
  );

-- 6) Seed data (optional)
insert into public.schools (name, domain) values
('Example High School', 'examplehs.edu'),
('Demo Academy', 'demoacademy.org');

-- Subject seeds removed (no subjects table)

-- 7) Merge superadmin into admin (idempotent)
-- 1) Normalize existing data: make every admin row use 'admin'
UPDATE public.admins
SET role = 'admin'
WHERE role IS DISTINCT FROM 'admin';

-- 2) Replace the CHECK constraint to allow only 'admin'
ALTER TABLE public.admins
  DROP CONSTRAINT IF EXISTS admins_role_check;

ALTER TABLE public.admins
  ADD CONSTRAINT admins_role_check CHECK (role IN ('admin'));

-- 3) Update RLS policy on admins table to allow any admin to view
-- Drop old policy that required role='superadmin'
DROP POLICY IF EXISTS admins_view_policy ON public.admins;

-- New policy: any authenticated user who is an admin can select the admins table
CREATE POLICY admins_view_policy ON public.admins
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.admins a WHERE a.auth_id = auth.uid())
  );
