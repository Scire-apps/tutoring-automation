-- Tutoring Automation Database Schema (Simplified version without RLS policies)

-- Drop existing tables if they exist
DROP TABLE IF EXISTS communications;
DROP TABLE IF EXISTS session_recordings;
DROP TABLE IF EXISTS tutoring_jobs;
DROP TABLE IF EXISTS tutoring_opportunities;
DROP TABLE IF EXISTS subject_approvals;
DROP TABLE IF EXISTS subjects;
DROP TABLE IF EXISTS tutors;
DROP TABLE IF EXISTS admins;
DROP TABLE IF EXISTS schools;

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
    school TEXT NOT NULL DEFAULT 'White Oaks S.S.',
    tutee_first_name TEXT NOT NULL,
    tutee_last_name TEXT NOT NULL,
    tutee_pronouns TEXT,
    tutee_email TEXT NOT NULL,
    grade_level TEXT NOT NULL CHECK (grade_level IN ('9', '10', '11', '12')),
    subject TEXT NOT NULL,
    specific_topic TEXT NOT NULL,
    course_level TEXT NOT NULL CHECK (course_level IN ('ESL', 'Academic', 'ALP', 'IB', 'College', 'University')),
    urgency_level INTEGER NOT NULL CHECK (urgency_level >= 1 AND urgency_level <= 10),
    session_location TEXT NOT NULL CHECK (session_location IN ('In person', 'Online')),
    availability_date TEXT NOT NULL,
    availability_start_time TEXT NOT NULL,
    availability_end_time TEXT NOT NULL,
    availability_formatted TEXT NOT NULL, -- e.g., "13/03/2025, 4-6pm"
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
    scheduled_date DATE,
    scheduled_time TEXT,
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

-- Insert sample data

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