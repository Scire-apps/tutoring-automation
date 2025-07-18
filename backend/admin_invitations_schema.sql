-- Admin Invitations Table for secure admin registration

CREATE TABLE admin_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'superadmin')),
    school_id UUID REFERENCES schools(id),
    invited_by UUID NOT NULL REFERENCES admins(id),
    invitation_token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'used', 'expired', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_admin_invitations_token ON admin_invitations(invitation_token);
CREATE INDEX idx_admin_invitations_email ON admin_invitations(email);
CREATE INDEX idx_admin_invitations_status ON admin_invitations(status);
CREATE INDEX idx_admin_invitations_expires_at ON admin_invitations(expires_at);

-- Enable Row Level Security
ALTER TABLE admin_invitations ENABLE ROW LEVEL SECURITY;

-- Create policy for admin invitations
CREATE POLICY admin_invitations_policy ON admin_invitations
    FOR ALL USING (
        EXISTS (SELECT 1 FROM admins WHERE auth_id = auth.uid())
    );