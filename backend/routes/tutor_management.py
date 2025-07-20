from flask import Blueprint, request, jsonify
from utils.db import get_supabase_client
from utils.auth import require_admin

tutor_management_bp = Blueprint('tutor_management', __name__)

@tutor_management_bp.route('/api/admin/tutors/<tutor_id>', methods=['GET'])
@require_admin
def get_tutor_details(tutor_id):
    """Get detailed tutor information including subject approvals"""
    try:
        supabase = get_supabase_client()
        
        # Get tutor details
        tutor_result = supabase.table('tutors').select('''
            *,
            school:schools(name, domain)
        ''').eq('id', tutor_id).single().execute()
        
        if not tutor_result.data:
            return jsonify({'error': 'Tutor not found'}), 404
        
        tutor = tutor_result.data
        
        # Get subject approvals for this tutor
        approvals_result = supabase.table('subject_approvals').select('''
            *,
            subject:subjects(id, name, category, grade_level),
            approved_by_admin:approved_by(first_name, last_name, email)
        ''').eq('tutor_id', tutor_id).execute()
        
        # Get all available subjects
        subjects_result = supabase.table('subjects').select('*').order('category, name').execute()
        
        return jsonify({
            'tutor': tutor,
            'subject_approvals': approvals_result.data or [],
            'available_subjects': subjects_result.data or []
        }), 200
        
    except Exception as e:
        print(f"Error getting tutor details: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@tutor_management_bp.route('/api/admin/tutors/<tutor_id>/subjects', methods=['POST'])
@require_admin
def update_subject_approvals(tutor_id):
    """Update subject approvals for a tutor"""
    try:
        data = request.get_json()
        subject_id = data.get('subject_id')
        action = data.get('action')  # 'approve', 'reject', or 'remove'
        
        if not subject_id or not action:
            return jsonify({'error': 'subject_id and action are required'}), 400
        
        if action not in ['approve', 'reject', 'remove']:
            return jsonify({'error': 'Invalid action'}), 400
        
        supabase = get_supabase_client()
        
        # Get the admin ID from the authenticated user
        admin_result = supabase.table('admins').select('id').eq('auth_id', request.user_id).single().execute()
        if not admin_result.data:
            return jsonify({'error': 'Admin record not found'}), 403
        
        admin_id = admin_result.data['id']
        
        if action == 'remove':
            # Remove the subject approval
            result = supabase.table('subject_approvals').delete().eq('tutor_id', tutor_id).eq('subject_id', subject_id).execute()
        else:
            # Check if approval already exists
            existing_result = supabase.table('subject_approvals').select('*').eq('tutor_id', tutor_id).eq('subject_id', subject_id).single().execute()
            
            if existing_result.data:
                # Update existing approval
                result = supabase.table('subject_approvals').update({
                    'status': 'approved' if action == 'approve' else 'rejected',
                    'approved_by': admin_id,
                    'approved_at': 'now()' if action == 'approve' else None
                }).eq('tutor_id', tutor_id).eq('subject_id', subject_id).execute()
            else:
                # Create new approval
                result = supabase.table('subject_approvals').insert({
                    'tutor_id': tutor_id,
                    'subject_id': subject_id,
                    'status': 'approved' if action == 'approve' else 'rejected',
                    'approved_by': admin_id,
                    'approved_at': 'now()' if action == 'approve' else None
                }).execute()
        
        # Send email notification for approval/rejection (not for removal)
        if action in ['approve', 'reject']:
            try:
                # Get tutor details
                tutor_result = supabase.table('tutors').select('first_name, last_name, email').eq('id', tutor_id).single().execute()
                # Get subject details
                subject_result = supabase.table('subjects').select('name').eq('id', subject_id).single().execute()
                # Get admin details
                admin_details = supabase.table('admins').select('first_name, last_name').eq('id', admin_id).single().execute()
                
                if tutor_result.data and subject_result.data and admin_details.data:
                    from utils.email_service import get_email_service
                    
                    tutor_name = f"{tutor_result.data['first_name']} {tutor_result.data['last_name']}"
                    admin_name = f"{admin_details.data['first_name']} {admin_details.data['last_name']}"
                    subject_name = subject_result.data['name']
                    
                    # Create approval notification data
                    approval_details = {
                        'subject': subject_name,
                        'status': 'approved' if action == 'approve' else 'rejected',
                        'admin_name': admin_name
                    }
                    
                    # Send email notification
                    email_service = get_email_service()
                    if action == 'approve':
                        subject_line = f"Subject Approval: You're now approved for {subject_name}"
                        html_body = f"""
                        <html>
                        <body>
                            <h2>Subject Approval Notification</h2>
                            <p>Hello {tutor_name},</p>
                            <p>Great news! You have been approved to tutor <strong>{subject_name}</strong>.</p>
                            <p>You can now apply for tutoring opportunities in this subject area.</p>
                            <p>Approved by: {admin_name}</p>
                            <p>Log into the tutoring platform to start browsing available opportunities!</p>
                            <p>Thank you for volunteering!</p>
                        </body>
                        </html>
                        """
                    else:
                        subject_line = f"Subject Approval Update: {subject_name}"
                        html_body = f"""
                        <html>
                        <body>
                            <h2>Subject Approval Update</h2>
                            <p>Hello {tutor_name},</p>
                            <p>We have reviewed your request to tutor <strong>{subject_name}</strong>.</p>
                            <p>Status: <strong>Not Approved</strong></p>
                            <p>Reviewed by: {admin_name}</p>
                            <p>If you have questions about this decision, please contact your school administrator.</p>
                            <p>Thank you for your interest in tutoring!</p>
                        </body>
                        </html>
                        """
                    
                    email_service.send_email(
                        tutor_result.data['email'],
                        subject_line,
                        html_body
                    )
                    print(f"Approval notification sent to {tutor_result.data['email']} for {subject_name}: {action}")
                    
            except Exception as e:
                print(f"Failed to send approval notification email: {e}")
                # Don't fail the entire operation if email fails
        
        return jsonify({'message': f'Subject approval {action}d successfully'}), 200
        
    except Exception as e:
        print(f"Error updating subject approvals: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@tutor_management_bp.route('/api/admin/subjects', methods=['GET'])
@require_admin
def get_all_subjects():
    """Get all available subjects"""
    try:
        supabase = get_supabase_client()
        
        result = supabase.table('subjects').select('*').order('category, name').execute()
        
        return jsonify({'subjects': result.data or []}), 200
        
    except Exception as e:
        print(f"Error getting subjects: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@tutor_management_bp.route('/api/admin/tutors/<tutor_id>/status', methods=['PUT'])
@require_admin
def update_tutor_status(tutor_id):
    """Update tutor status (active, pending, suspended)"""
    try:
        data = request.get_json()
        status = data.get('status')
        
        if not status or status not in ['active', 'pending', 'suspended']:
            return jsonify({'error': 'Invalid status'}), 400
        
        supabase = get_supabase_client()
        
        result = supabase.table('tutors').update({
            'status': status
        }).eq('id', tutor_id).execute()
        
        if not result.data:
            return jsonify({'error': 'Tutor not found'}), 404
        
        return jsonify({'message': 'Tutor status updated successfully'}), 200
        
    except Exception as e:
        print(f"Error updating tutor status: {e}")
        return jsonify({'error': 'Internal server error'}), 500