-- Fix RLS policies for admin_invitations table

-- Drop existing policy
DROP POLICY IF EXISTS admin_invitations_policy ON admin_invitations;

-- Create a more permissive policy that allows service-level access
-- This allows operations when using the service key
CREATE POLICY admin_invitations_service_policy ON admin_invitations
    FOR ALL 
    USING (true);

-- Also create a policy for authenticated users
CREATE POLICY admin_invitations_user_policy ON admin_invitations
    FOR ALL 
    USING (
        auth.uid() IS NOT NULL AND
        EXISTS (SELECT 1 FROM admins WHERE auth_id = auth.uid())
    );