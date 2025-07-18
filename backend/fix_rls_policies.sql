-- Fix RLS policies for the admins table

-- First, enable RLS on the admins table if not already enabled
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Admins can view their own record" ON admins;
DROP POLICY IF EXISTS "Superadmins can view all admin records" ON admins;
DROP POLICY IF EXISTS "Admins can update their own record" ON admins;
DROP POLICY IF EXISTS "Superadmins can update all admin records" ON admins;

-- Create policies for viewing admin records
CREATE POLICY "Admins can view their own record"
  ON admins
  FOR SELECT
  USING (auth.uid() = auth_id);

CREATE POLICY "Superadmins can view all admin records"
  ON admins
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_id = auth.uid()
      AND admins.role = 'superadmin'
    )
  );

-- Create policies for updating admin records
CREATE POLICY "Admins can update their own record"
  ON admins
  FOR UPDATE
  USING (auth.uid() = auth_id);

CREATE POLICY "Superadmins can update all admin records"
  ON admins
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_id = auth.uid()
      AND admins.role = 'superadmin'
    )
  );

-- Create a temporary bypass policy for development
-- IMPORTANT: Remove this in production!
CREATE POLICY "Allow all operations for development"
  ON admins
  FOR ALL
  USING (true);

-- Fix RLS policies for the tutors table
ALTER TABLE tutors ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Tutors can view their own record" ON tutors;
DROP POLICY IF EXISTS "Admins can view all tutor records" ON tutors;
DROP POLICY IF EXISTS "Tutors can update their own record" ON tutors;
DROP POLICY IF EXISTS "Admins can update all tutor records" ON tutors;

-- Create policies for viewing tutor records
CREATE POLICY "Tutors can view their own record"
  ON tutors
  FOR SELECT
  USING (auth.uid() = auth_id);

CREATE POLICY "Admins can view all tutor records"
  ON tutors
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_id = auth.uid()
    )
  );

-- Create policies for updating tutor records
CREATE POLICY "Tutors can update their own record"
  ON tutors
  FOR UPDATE
  USING (auth.uid() = auth_id);

CREATE POLICY "Admins can update all tutor records"
  ON tutors
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_id = auth.uid()
    )
  );

-- Create a temporary bypass policy for development
-- IMPORTANT: Remove this in production!
CREATE POLICY "Allow all operations for development"
  ON tutors
  FOR ALL
  USING (true);