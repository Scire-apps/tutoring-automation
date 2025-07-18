-- Fix RLS policies to allow middleware to work properly
-- This addresses the redirect loop issue by allowing proper admin role checking

-- First, let's simplify the admins table policies
DROP POLICY IF EXISTS "Admins can view their own record" ON admins;
DROP POLICY IF EXISTS "Superadmins can view all admin records" ON admins;
DROP POLICY IF EXISTS "Admins can update their own record" ON admins;
DROP POLICY IF EXISTS "Superadmins can update all admin records" ON admins;
DROP POLICY IF EXISTS "Allow all operations for development" ON admins;

-- Create a simple policy that allows authenticated users to read admin records
-- This is needed for middleware to check if a user is an admin
CREATE POLICY "Allow authenticated users to read admin records"
  ON admins
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Allow admins to update their own records
CREATE POLICY "Admins can update their own record"
  ON admins
  FOR UPDATE
  USING (auth.uid() = auth_id);

-- Allow insert for new admin registrations
CREATE POLICY "Allow admin registration"
  ON admins
  FOR INSERT
  WITH CHECK (true);

-- Simplify admin_invitations policies
DROP POLICY IF EXISTS admin_invitations_policy ON admin_invitations;
DROP POLICY IF EXISTS admin_invitations_service_policy ON admin_invitations;
DROP POLICY IF EXISTS admin_invitations_user_policy ON admin_invitations;

-- Create simple policy for admin invitations
CREATE POLICY "Allow authenticated users to manage invitations"
  ON admin_invitations
  FOR ALL
  USING (auth.role() = 'authenticated');

-- Simplify tutors table policies
DROP POLICY IF EXISTS "Tutors can view their own record" ON tutors;
DROP POLICY IF EXISTS "Admins can view all tutor records" ON tutors;
DROP POLICY IF EXISTS "Tutors can update their own record" ON tutors;
DROP POLICY IF EXISTS "Admins can update all tutor records" ON tutors;
DROP POLICY IF EXISTS "Allow all operations for development" ON tutors;

-- Create simple policies for tutors
CREATE POLICY "Allow authenticated users to read tutor records"
  ON tutors
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Tutors can update their own record"
  ON tutors
  FOR UPDATE
  USING (auth.uid() = auth_id);

CREATE POLICY "Allow tutor registration"
  ON tutors
  FOR INSERT
  WITH CHECK (true);