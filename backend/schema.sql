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
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Subjects
create table public.subjects (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  category text,
  grade_level text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(name, category, grade_level)
);

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

-- Subject approvals (source of truth for tutor qualification)
create table public.subject_approvals (
  id uuid primary key default uuid_generate_v4(),
  tutor_id uuid not null references public.tutors(id),
  subject_id uuid not null references public.subjects(id),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  approved_by uuid references public.admins(id), -- admin who approved/rejected
  approved_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(tutor_id, subject_id)
);

-- Tutoring opportunities (created by tutees)
create table public.tutoring_opportunities (
  id uuid primary key default uuid_generate_v4(),
  tutee_id uuid references public.tutees(id),
  subject_id uuid not null references public.subjects(id),
  grade_level text,
  sessions_per_week int not null default 1 check (sessions_per_week > 0),
  availability jsonb not null default '{}'::jsonb, -- e.g. {"Mon":["16:00-17:00"], ...}
  location_preference text,
  additional_notes text,
  status text not null default 'open' check (status in ('open','assigned','completed','cancelled')),
  priority text not null default 'normal' check (priority in ('low','normal','high')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Tutoring jobs (created when tutor accepts an opportunity)
create table public.tutoring_jobs (
  id uuid primary key default uuid_generate_v4(),
  opportunity_id uuid not null references public.tutoring_opportunities(id),
  tutor_id uuid not null references public.tutors(id),
  tutee_id uuid not null references public.tutees(id),
  subject_id uuid not null references public.subjects(id),
  finalized_schedule jsonb not null default '[]'::jsonb, -- array of {date, time} (optional)
  scheduled_time timestamptz, -- single scheduled datetime used by scheduling flow
  location text,
  status text not null default 'scheduled' check (status in ('scheduled','completed','cancelled')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Session recordings
create table public.session_recordings (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid not null references public.tutoring_jobs(id),
  file_path text not null,
  file_url text,
  duration_seconds int,
  volunteer_hours numeric(10,2),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
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
create index idx_tutoring_opportunities_subject_id on public.tutoring_opportunities(subject_id);
create index idx_tutoring_jobs_tutor_id on public.tutoring_jobs(tutor_id);
create index idx_tutoring_jobs_tutee_id on public.tutoring_jobs(tutee_id);
create index idx_tutoring_jobs_opportunity_id on public.tutoring_jobs(opportunity_id);
create index idx_tutoring_jobs_subject_id on public.tutoring_jobs(subject_id);
create index idx_session_recordings_job_id on public.session_recordings(job_id);
create index idx_communications_job_id on public.communications(job_id);
create index idx_communications_opportunity_id on public.communications(opportunity_id);
create index idx_subject_approvals_tutor_id on public.subject_approvals(tutor_id);
create index idx_subject_approvals_subject_id on public.subject_approvals(subject_id);

-- 4) Enable RLS
alter table public.schools enable row level security;
alter table public.tutors enable row level security;
alter table public.tutees enable row level security;
alter table public.subjects enable row level security;
alter table public.subject_approvals enable row level security;
alter table public.tutoring_opportunities enable row level security;
alter table public.tutoring_jobs enable row level security;
alter table public.session_recordings enable row level security;
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

-- Subjects: readable by any authenticated user
create policy subjects_select on public.subjects
  for select using (auth.role() = 'authenticated');

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

insert into public.subjects (name, category, grade_level) values
('Algebra', 'Mathematics', 'High School'),
('Geometry', 'Mathematics', 'High School'),
('Biology', 'Science', 'High School'),
('Chemistry', 'Science', 'High School'),
('Physics', 'Science', 'High School'),
('English Literature', 'Language Arts', 'High School'),
('World History', 'Social Studies', 'High School'),
('Computer Science', 'Technology', 'High School'),
('Spanish', 'Foreign Language', 'High School'),
('French', 'Foreign Language', 'High School');

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
