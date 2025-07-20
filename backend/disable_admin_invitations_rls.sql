-- Temporarily disable RLS for admin_invitations table to fix insertion issues

-- Drop all existing policies
DROP POLICY IF EXISTS admin_invitations_policy ON admin_invitations;
DROP POLICY IF EXISTS admin_invitations_service_policy ON admin_invitations;
DROP POLICY IF EXISTS admin_invitations_user_policy ON admin_invitations;
DROP POLICY IF EXISTS "Allow authenticated users to manage invitations" ON admin_invitations;

-- Disable Row Level Security entirely for this table
ALTER TABLE admin_invitations DISABLE ROW LEVEL SECURITY;