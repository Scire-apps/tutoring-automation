-- Tutoring Automation Database Schema

-- Note: JWT secret is already configured by Supabase

-- Schools Table
CREATE TABLE schools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    domain TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tutors Table
CREATE TABLE tutors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_id UUID NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    school_id UUID REFERENCES schools(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),
    volunteer_hours NUMERIC(10, 2) DEFAULT 0,
    approved_subject_ids UUID[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tutees Table
CREATE TABLE tutees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_id UUID NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    school_id UUID REFERENCES schools(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subjects Table
CREATE TABLE subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    category TEXT,
    grade_level TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (name, category, grade_level)
);

-- Subject Approvals Table
CREATE TABLE subject_approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tutor_id UUID NOT NULL REFERENCES tutors(id),
    subject_id UUID NOT NULL REFERENCES subjects(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    approved_by UUID REFERENCES tutors(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (tutor_id, subject_id)
);

-- Tutoring Opportunities Table
CREATE TABLE tutoring_opportunities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tutee_id UUID REFERENCES tutees(id),
    subject_id UUID NOT NULL REFERENCES subjects(id),
    grade_level TEXT,
    sessions_per_week INT NOT NULL DEFAULT 1 CHECK (sessions_per_week > 0),
    availability JSONB NOT NULL DEFAULT '{}',
    location_preference TEXT,
    additional_notes TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'assigned', 'completed', 'cancelled')),
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tutoring Jobs Table
CREATE TABLE tutoring_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    opportunity_id UUID NOT NULL REFERENCES tutoring_opportunities(id),
    tutor_id UUID NOT NULL REFERENCES tutors(id),
    tutee_id UUID NOT NULL REFERENCES tutees(id),
    subject_id UUID NOT NULL REFERENCES subjects(id),
    finalized_schedule JSONB NOT NULL DEFAULT '[]',
    location TEXT,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Session Recordings Table
CREATE TABLE session_recordings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES tutoring_jobs(id),
    file_path TEXT NOT NULL,
    file_url TEXT,
    duration_seconds INTEGER,
    volunteer_hours NUMERIC(10, 2),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Communications Table
CREATE TABLE communications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES tutoring_jobs(id),
    opportunity_id UUID REFERENCES tutoring_opportunities(id),
    type TEXT NOT NULL CHECK (type IN ('email', 'notification')),
    recipient TEXT NOT NULL,
    subject TEXT,
    content TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Admins Table
CREATE TABLE admins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_id UUID NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    school_id UUID REFERENCES schools(id),
    role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'superadmin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_tutors_school_id ON tutors(school_id);
CREATE INDEX idx_subject_approvals_tutor_id ON subject_approvals(tutor_id);
CREATE INDEX idx_subject_approvals_subject_id ON subject_approvals(subject_id);
CREATE INDEX idx_tutoring_opportunities_status ON tutoring_opportunities(status);
CREATE INDEX idx_tutoring_opportunities_priority ON tutoring_opportunities(priority);
CREATE INDEX idx_tutoring_jobs_tutor_id ON tutoring_jobs(tutor_id);
CREATE INDEX idx_tutoring_jobs_opportunity_id ON tutoring_jobs(opportunity_id);
CREATE INDEX idx_session_recordings_job_id ON session_recordings(job_id);
CREATE INDEX idx_communications_job_id ON communications(job_id);
CREATE INDEX idx_communications_opportunity_id ON communications(opportunity_id);

-- Enable Row Level Security on all tables
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutors ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE subject_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutoring_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutoring_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- Create policies for Row Level Security
-- These are basic policies and should be refined based on specific requirements

-- Schools: Viewable by all authenticated users
CREATE POLICY schools_view_policy ON schools
    FOR SELECT USING (auth.role() = 'authenticated');

-- Tutors: Viewable by admins and the tutor themselves
CREATE POLICY tutors_view_policy ON tutors
    FOR SELECT USING (
        auth.uid() = auth_id OR
        EXISTS (SELECT 1 FROM admins WHERE auth_id = auth.uid())
    );

-- Tutees: Viewable by admins and the tutee themselves
CREATE POLICY tutees_view_policy ON tutees
    FOR SELECT USING (
        auth.uid() = auth_id OR
        EXISTS (SELECT 1 FROM admins WHERE auth_id = auth.uid())
    );

-- Subjects: Viewable by all authenticated users
CREATE POLICY subjects_view_policy ON subjects
    FOR SELECT USING (auth.role() = 'authenticated');

-- Subject Approvals: Viewable by admins and the tutor themselves
CREATE POLICY subject_approvals_view_policy ON subject_approvals
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM tutors WHERE auth_id = auth.uid() AND id = subject_approvals.tutor_id) OR
        EXISTS (SELECT 1 FROM admins WHERE auth_id = auth.uid())
    );

-- Tutoring Opportunities:
--  - Tutors may view all open opportunities
--  - Tutees may view only their own opportunities
--  - Admins may view all
CREATE POLICY tutoring_opportunities_view_policy ON tutoring_opportunities
    FOR SELECT USING (
        (status = 'open' AND EXISTS (SELECT 1 FROM tutors WHERE auth_id = auth.uid())) OR
        EXISTS (SELECT 1 FROM admins WHERE auth_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM tutees WHERE auth_id = auth.uid() AND id = tutoring_opportunities.tutee_id)
    );

-- Tutoring Jobs: Viewable by assigned tutor, related tutee, and admins
CREATE POLICY tutoring_jobs_view_policy ON tutoring_jobs
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM tutors WHERE auth_id = auth.uid() AND id = tutoring_jobs.tutor_id) OR
        EXISTS (SELECT 1 FROM tutees WHERE auth_id = auth.uid() AND id = tutoring_jobs.tutee_id) OR
        EXISTS (SELECT 1 FROM admins WHERE auth_id = auth.uid())
    );

-- Session Recordings: Viewable by the tutor who recorded it and admins
CREATE POLICY session_recordings_view_policy ON session_recordings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM tutoring_jobs
            JOIN tutors ON tutoring_jobs.tutor_id = tutors.id
            WHERE tutoring_jobs.id = session_recordings.job_id AND tutors.auth_id = auth.uid()
        ) OR
        EXISTS (SELECT 1 FROM admins WHERE auth_id = auth.uid())
    );

-- Communications: Viewable by related tutors and admins
CREATE POLICY communications_view_policy ON communications
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM tutoring_jobs
            JOIN tutors ON tutoring_jobs.tutor_id = tutors.id
            WHERE tutoring_jobs.id = communications.job_id AND tutors.auth_id = auth.uid()
        ) OR
        EXISTS (SELECT 1 FROM admins WHERE auth_id = auth.uid())
    );

-- Admins: Viewable by superadmins only
CREATE POLICY admins_view_policy ON admins
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM admins WHERE auth_id = auth.uid() AND role = 'superadmin')
    );

-- Insert some initial data for testing

-- Insert schools
INSERT INTO schools (name, domain) VALUES
('Example High School', 'examplehs.edu'),
('Demo Academy', 'demoacademy.org');

-- Insert subjects
INSERT INTO subjects (name, category, grade_level) VALUES
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