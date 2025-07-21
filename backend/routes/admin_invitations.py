from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta, timezone
import secrets
import uuid
from utils.db import get_supabase_client
from utils.auth import require_superadmin, require_admin

admin_invitations_bp = Blueprint('admin_invitations', __name__)

@admin_invitations_bp.route('/api/admin/invitations/test', methods=['GET'])
def test_endpoint():
    """Test endpoint to verify the blueprint is working"""
    return jsonify({'message': 'Admin invitations blueprint is working!'}), 200

@admin_invitations_bp.route('/api/admin/invitations', methods=['POST'])
@require_superadmin
def create_invitation():
    """Create a new admin invitation"""
    try:
        print("=== CREATE INVITATION API CALLED ===")
        data = request.get_json()
        print(f"Received data: {data}")
        
        # Validate required fields
        required_fields = ['email', 'role']
        for field in required_fields:
            if field not in data:
                print(f"Missing field: {field}")
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        email = data['email']
        role = data['role']
        school_id = data.get('school_id')
        
        print(f"Parsed: email={email}, role={role}, school_id={school_id}")
        
        # Get the authenticated user's admin ID from the database
        supabase = get_supabase_client()
        admin_result = supabase.table('admins').select('id').eq('auth_id', request.user_id).single().execute()
        
        if not admin_result.data:
            return jsonify({'error': 'Admin record not found'}), 403
            
        invited_by_id = admin_result.data['id']
        
        # Validate role
        if role not in ['admin', 'superadmin']:
            print(f"Invalid role: {role}")
            return jsonify({'error': 'Invalid role'}), 400
        
        # Validate school_id for admin role
        if role == 'admin' and not school_id:
            print("School ID required for admin role")
            return jsonify({'error': 'School ID is required for admin role'}), 400
        
        # Generate invitation token
        invitation_token = secrets.token_urlsafe(32)
        print(f"Generated token: {invitation_token}")
        
        # Set expiration (7 days from now)
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        print(f"Expires at: {expires_at}")
        
        # Create invitation record
        print("Getting Supabase client...")
        supabase = get_supabase_client()
        
        invitation_data = {
            'email': email,
            'role': role,
            'school_id': school_id,
            'invited_by': invited_by_id,
            'invitation_token': invitation_token,
            'expires_at': expires_at.isoformat(),
            'status': 'pending'
        }
        
        print(f"Creating invitation with data: {invitation_data}")
        
        result = supabase.table('admin_invitations').insert(invitation_data).execute()
        print(f"Insert result: {result}")
        
        if not result.data:
            print("Insert failed - no data returned")
            return jsonify({'error': 'Failed to create invitation - no data returned'}), 500
        
        invitation = result.data[0]
        print(f"Created invitation: {invitation}")
        
        # Generate invitation URL for manual sharing
        import os
        frontend_url = os.environ.get('FRONTEND_URL', request.host_url.rstrip('/'))
        invitation_url = f"{frontend_url}/auth/admin/register?token={invitation_token}"
        print(f"Generated invitation URL: {invitation_url}")
        
        print("=== INVITATION CREATED SUCCESSFULLY ===")
        return jsonify({
            'message': 'Invitation created successfully',
            'invitation_id': invitation['id'],
            'invitation_url': invitation_url,
            'expires_at': invitation['expires_at']
        }), 201
        
    except Exception as e:
        print(f"=== ERROR CREATING INVITATION: {e} ===")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500

@admin_invitations_bp.route('/api/admin/invitations/verify/<token>', methods=['GET'])
def verify_invitation(token):
    """Verify an invitation token"""
    try:
        supabase = get_supabase_client()
        
        # Find invitation by token
        result = supabase.table('admin_invitations').select('*').eq('invitation_token', token).single().execute()
        
        if not result.data:
            return jsonify({'error': 'Invalid invitation token'}), 404
        
        invitation = result.data
        
        # Check if invitation is expired
        expires_at = datetime.fromisoformat(invitation['expires_at'].replace('Z', '+00:00'))
        if datetime.utcnow().replace(tzinfo=expires_at.tzinfo) > expires_at:
            return jsonify({'error': 'Invitation has expired'}), 400
        
        # Check if invitation is already used
        if invitation['status'] != 'pending':
            return jsonify({'error': 'Invitation has already been used'}), 400
        
        # Return invitation data
        return jsonify({
            'email': invitation['email'],
            'role': invitation['role'],
            'school_id': invitation['school_id'],
            'expires_at': invitation['expires_at']
        }), 200
        
    except Exception as e:
        print(f"Error verifying invitation: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@admin_invitations_bp.route('/api/admin/invitations/use/<token>', methods=['POST'])
def use_invitation(token):
    """Mark an invitation as used"""
    try:
        supabase = get_supabase_client()
        
        # Update invitation status
        result = supabase.table('admin_invitations').update({
            'status': 'used',
            'used_at': datetime.utcnow().isoformat()
        }).eq('invitation_token', token).execute()
        
        if not result.data:
            return jsonify({'error': 'Failed to update invitation'}), 500
        
        return jsonify({'message': 'Invitation marked as used'}), 200
        
    except Exception as e:
        print(f"Error using invitation: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@admin_invitations_bp.route('/api/admin/invitations', methods=['GET'])
@require_superadmin
def list_invitations():
    """List all invitations (for superadmins)"""
    try:
        supabase = get_supabase_client()
        
        # Get all invitations with related data
        result = supabase.table('admin_invitations').select('''
            *,
            invited_by_admin:invited_by(first_name, last_name, email),
            school:schools(name)
        ''').order('created_at', desc=True).execute()
        
        invitations = result.data or []
        
        return jsonify({'invitations': invitations}), 200
        
    except Exception as e:
        print(f"Error listing invitations: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@admin_invitations_bp.route('/api/admin/invitations/<invitation_id>', methods=['DELETE'])
@require_superadmin
def cancel_invitation(invitation_id):
    """Cancel an invitation"""
    try:
        supabase = get_supabase_client()
        
        # Update invitation status to cancelled
        result = supabase.table('admin_invitations').update({
            'status': 'cancelled'
        }).eq('id', invitation_id).execute()
        
        if not result.data:
            return jsonify({'error': 'Invitation not found'}), 404
        
        return jsonify({'message': 'Invitation cancelled successfully'}), 200
        
    except Exception as e:
        print(f"Error cancelling invitation: {e}")
        return jsonify({'error': 'Internal server error'}), 500