from models.base import BaseModel
from datetime import datetime, timedelta
import secrets

class AdminInvitation(BaseModel):
    def __init__(self):
        super().__init__('admin_invitations')
    
    def create_invitation(self, email, role, invited_by_id=None, invited_by=None, school_id=None, expires_in_days=7):
        """Create a new admin invitation"""
        # Handle both parameter names for backward compatibility
        inviter_id = invited_by_id or invited_by
        if not inviter_id:
            raise ValueError("Either invited_by_id or invited_by must be provided")
            
        invitation_token = secrets.token_urlsafe(32)
        expires_at = datetime.utcnow() + timedelta(days=expires_in_days)
        
        invitation_data = {
            'email': email,
            'role': role,
            'school_id': school_id,
            'invited_by': inviter_id,
            'invitation_token': invitation_token,
            'expires_at': expires_at.isoformat(),
            'status': 'pending'
        }
        
        return self.create(invitation_data)
    
    def find_by_token(self, token):
        """Find invitation by token"""
        result = self.supabase.table(self.table_name).select('*').eq('invitation_token', token).single().execute()
        return result.data if result.data else None
    
    def verify_token(self, token):
        """Verify if token is valid and not expired"""
        invitation = self.find_by_token(token)
        
        if not invitation:
            return False, "Invalid invitation token"
        
        # Check if expired
        expires_at = datetime.fromisoformat(invitation['expires_at'].replace('Z', '+00:00'))
        if datetime.utcnow().replace(tzinfo=expires_at.tzinfo) > expires_at:
            return False, "Invitation has expired"
        
        # Check if already used
        if invitation['status'] != 'pending':
            return False, "Invitation has already been used"
        
        return True, invitation
    
    def mark_as_used(self, token):
        """Mark invitation as used"""
        return self.supabase.table(self.table_name).update({
            'status': 'used',
            'used_at': datetime.utcnow().isoformat()
        }).eq('invitation_token', token).execute()
    
    def cancel_invitation(self, invitation_id):
        """Cancel an invitation"""
        return self.update(invitation_id, {'status': 'cancelled'})
    
    def get_all_with_details(self):
        """Get all invitations with related data"""
        return self.supabase.table(self.table_name).select('''
            *,
            invited_by_admin:invited_by(first_name, last_name, email),
            school:schools(name)
        ''').order('created_at', desc=True).execute()
    
    def cleanup_expired(self):
        """Mark expired invitations as expired"""
        current_time = datetime.utcnow().isoformat()
        return self.supabase.table(self.table_name).update({
            'status': 'expired'
        }).lt('expires_at', current_time).eq('status', 'pending').execute()