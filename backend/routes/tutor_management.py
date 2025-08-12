from flask import Blueprint, request, jsonify
from datetime import datetime, timezone
from utils.db import get_supabase_client
from utils.auth import require_admin

tutor_management_bp = Blueprint('tutor_management', __name__)

@tutor_management_bp.route('/api/admin/me', methods=['GET'])
@require_admin
def get_admin_me():
    """Return current admin profile with school info"""
    try:
        supabase = get_supabase_client()
        admin_res = supabase.table('admins').select('*, school:schools(name,domain)').eq('auth_id', request.user_id).single().execute()
        if not admin_res.data:
            return jsonify({'error': 'Admin not found'}), 404
        return jsonify({'admin': admin_res.data}), 200
    except Exception as e:
        print(f"Error fetching admin me: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@tutor_management_bp.route('/api/admin/tutors', methods=['GET'])
@require_admin
def list_tutors_for_admin():
    """List tutors; if admin has a school_id, filter to that school, else return all"""
    try:
        supabase = get_supabase_client()
        admin_res = supabase.table('admins').select('school_id').eq('auth_id', request.user_id).single().execute()
        school_id = admin_res.data.get('school_id') if admin_res.data else None
        # Note: supabase-py uses 'desc=True' rather than 'ascending=False'
        query = supabase.table('tutors').select('*, school:schools(name,domain)').order('created_at', desc=True)
        if school_id:
            query = query.eq('school_id', school_id)
        tutors_res = query.execute()
        return jsonify({'tutors': tutors_res.data or []}), 200
    except Exception as e:
        print(f"Error listing tutors for admin: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@tutor_management_bp.route('/api/admin/schools', methods=['GET'])
@require_admin
def list_schools_for_admin():
    """List schools (all)."""
    try:
        supabase = get_supabase_client()
        schools_res = supabase.table('schools').select('*').order('name').execute()
        return jsonify({'schools': schools_res.data or []}), 200
    except Exception as e:
        print(f"Error listing schools: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@tutor_management_bp.route('/api/admin/opportunities', methods=['GET'])
@require_admin
def list_opportunities_for_admin():
    """List tutoring opportunities with related tutee and subject.
    If admin has a school, scope results to that school (by tutee.school_id).
    Supports both legacy and new schemas via a safe fallback.
    """
    try:
        supabase = get_supabase_client()
        # Determine admin school
        admin_res = supabase.table('admins').select('school_id').eq('auth_id', request.user_id).single().execute()
        school_id = admin_res.data.get('school_id') if admin_res.data else None

        # Preferred (new schema with relations)
        try:
            if school_id:
                # Collect tutee ids for this school and filter by tutee_id
                tutees_res = supabase.table('tutees').select('id').eq('school_id', school_id).execute()
                tutee_ids = [t['id'] for t in (tutees_res.data or [])]
            else:
                tutee_ids = None

            query = (
                supabase
                .table('tutoring_opportunities')
                .select('''
                    id, tutee_id, subject_id, grade_level, status, created_at,
                    tutee:tutees(id, first_name, last_name, email, school_id),
                    subject:subjects(id, name, category, grade_level)
                ''')
                .order('created_at', desc=True)
            )
            if tutee_ids and len(tutee_ids) > 0:
                query = query.in_('tutee_id', tutee_ids)
            res = query.limit(50).execute()
            return jsonify({'opportunities': res.data or []}), 200
        except Exception:
            # Fallback for legacy schema columns
            query = supabase.table('tutoring_opportunities').select(
                'id, tutee_first_name, tutee_last_name, subject, grade_level, status, created_at, school'
            ).order('created_at', desc=True)
            if school_id:
                # legacy: filter by school name value in row
                school_res = supabase.table('schools').select('name').eq('id', school_id).single().execute()
                if school_res.data:
                    query = query.eq('school', school_res.data.get('name'))
            res = query.limit(50).execute()
            return jsonify({'opportunities': res.data or []}), 200
    except Exception as e:
        print(f"Error listing opportunities for admin: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@tutor_management_bp.route('/api/admin/jobs', methods=['GET'])
@require_admin
def list_jobs_for_admin():
    """List tutoring jobs with related tutor, tutee and subject; filter by admin's school if assigned"""
    try:
        supabase = get_supabase_client()

        # Determine admin school for scoping
        admin_res = supabase.table('admins').select('school_id').eq('auth_id', request.user_id).single().execute()
        school_id = admin_res.data.get('school_id') if admin_res.data else None

        # Build base query with related entities
        query = (
            supabase
            .table('tutoring_jobs')
            .select('''
                *,
                tutor:tutors(id, first_name, last_name, email, school_id, school:schools(name,domain)),
                tutee:tutees(id, first_name, last_name, email, school_id),
                subject:subjects(id, name, category, grade_level)
            ''')
            .order('created_at', desc=True)
        )

        # If admin has school, limit using IDs for reliability
        if school_id:
            tutor_ids = []
            tutee_ids = []
            try:
                tutors_res = supabase.table('tutors').select('id').eq('school_id', school_id).execute()
                tutor_ids = [t['id'] for t in (tutors_res.data or [])]
            except Exception:
                tutor_ids = []
            try:
                tutees_res = supabase.table('tutees').select('id').eq('school_id', school_id).execute()
                tutee_ids = [t['id'] for t in (tutees_res.data or [])]
            except Exception:
                tutee_ids = []

            jobs_by_tutors = (
                supabase
                .table('tutoring_jobs')
                .select('''
                    *,
                    tutor:tutors(id, first_name, last_name, email, school_id, school:schools(name,domain)),
                    tutee:tutees(id, first_name, last_name, email, school_id),
                    subject:subjects(id, name, category, grade_level)
                ''')
                .in_('tutor_id', tutor_ids or ['00000000-0000-0000-0000-000000000000'])
                .order('created_at', desc=True)
                .execute()
            )
            jobs_by_tutees = (
                supabase
                .table('tutoring_jobs')
                .select('''
                    *,
                    tutor:tutors(id, first_name, last_name, email, school_id, school:schools(name,domain)),
                    tutee:tutees(id, first_name, last_name, email, school_id),
                    subject:subjects(id, name, category, grade_level)
                ''')
                .in_('tutee_id', tutee_ids or ['00000000-0000-0000-0000-000000000000'])
                .order('created_at', desc=True)
                .execute()
            )
            seen = set()
            merged = []
            for res in [jobs_by_tutors, jobs_by_tutees]:
                for row in (res.data or []):
                    if row['id'] not in seen:
                        seen.add(row['id'])
                        merged.append(row)
            return jsonify({'jobs': merged}), 200

        res = query.execute()
        return jsonify({'jobs': res.data or []}), 200
    except Exception as e:
        print(f"Error listing jobs for admin: {e}")
        return jsonify({'error': 'Internal server error'}), 500

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
        
        # Get all available subjects
        subjects_result = supabase.table('subjects').select('*').order('category, name').execute()
        
        # Also include current subject approvals with subject details
        approvals = supabase.table('subject_approvals').select('''
            *,
            subject:subjects(id, name, category, grade_level)
        ''').eq('tutor_id', tutor_id).execute()

        return jsonify({
            'tutor': tutor,
            'approved_subject_ids': tutor.get('approved_subject_ids', []) if isinstance(tutor, dict) else [],
            'available_subjects': subjects_result.data or [],
            'subject_approvals': approvals.data or []
        }), 200
        
    except Exception as e:
        print(f"Error getting tutor details: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@tutor_management_bp.route('/api/admin/tutors/<tutor_id>/approvals', methods=['GET'])
@require_admin
def list_tutor_approvals(tutor_id):
    """List subject approvals for a tutor with subject details"""
    try:
        supabase = get_supabase_client()
        res = supabase.table('subject_approvals').select('''
            *,
            subject:subjects(id, name, category, grade_level)
        ''').eq('tutor_id', tutor_id).execute()
        return jsonify({'subject_approvals': res.data or []}), 200
    except Exception as e:
        print(f"Error listing tutor approvals: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@tutor_management_bp.route('/api/admin/tutors/<tutor_id>/subjects', methods=['POST'])
@require_admin
def update_subject_approvals(tutor_id):
    """Update subject approvals for a tutor"""
    try:
        data = request.get_json()
        subject_id = data.get('subject_id')
        subject_name = data.get('subject_name')
        subject_category = data.get('subject_category')
        subject_grade_level = data.get('subject_grade_level')
        action = data.get('action')  # 'approve', 'reject', or 'remove'
        
        if not action:
            return jsonify({'error': 'action is required'}), 400
        
        # If subject_id not provided and we are not removing, try to resolve/create by name
        if action != 'remove' and not subject_id:
            if not subject_name:
                return jsonify({'error': 'subject_id or subject_name is required'}), 400
        
        if action not in ['approve', 'reject', 'remove']:
            return jsonify({'error': 'Invalid action'}), 400
        
        supabase = get_supabase_client()
        
        # Get the admin ID from the authenticated user
        admin_result = supabase.table('admins').select('id').eq('auth_id', request.user_id).single().execute()
        if not admin_result.data:
            return jsonify({'error': 'Admin record not found'}), 403
        
        admin_id = admin_result.data['id']
        
        # If we need a subject_id and it's missing, find or create the subject
        if action != 'remove' and not subject_id:
            # Try to find by (name, category, grade_level) using limit(1) to avoid errors
            find_q = supabase.table('subjects').select('id').eq('name', subject_name)
            if subject_category:
                find_q = find_q.eq('category', subject_category)
            if subject_grade_level:
                find_q = find_q.eq('grade_level', subject_grade_level)
            found = find_q.limit(1).execute()
            if found.data and len(found.data) > 0 and found.data[0].get('id'):
                subject_id = found.data[0]['id']
            else:
                # Create subject (handle unique conflicts by re-selecting)
                insert_payload = {
                    'name': subject_name,
                    'category': subject_category,
                    'grade_level': subject_grade_level
                }
                try:
                    created = supabase.table('subjects').insert(insert_payload).select('id').execute()
                    if created.data and len(created.data) > 0:
                        subject_id = created.data[0]['id']
                    else:
                        # Fallback select
                        fallback = supabase.table('subjects').select('id').eq('name', subject_name)
                        if subject_category:
                            fallback = fallback.eq('category', subject_category)
                        if subject_grade_level:
                            fallback = fallback.eq('grade_level', subject_grade_level)
                        fb = fallback.limit(1).execute()
                        if not fb.data or len(fb.data) == 0:
                            return jsonify({'error': 'Failed to create subject (not found after insert)'}), 500
                        subject_id = fb.data[0]['id']
                except Exception as e:
                    # Likely unique violation; select existing
                    fallback = supabase.table('subjects').select('id').eq('name', subject_name)
                    if subject_category:
                        fallback = fallback.eq('category', subject_category)
                    if subject_grade_level:
                        fallback = fallback.eq('grade_level', subject_grade_level)
                    fb = fallback.limit(1).execute()
                    if not fb.data or len(fb.data) == 0:
                        return jsonify({'error': 'Failed to create/find subject', 'details': str(e)}), 500
                    subject_id = fb.data[0]['id']

        # Fetch tutor basic info (array column may not exist in some deployments)
        tutor_row = supabase.table('tutors').select('first_name, last_name, email, approved_subject_ids').eq('id', tutor_id).single().execute()
        if not tutor_row.data:
            return jsonify({'error': 'Tutor not found'}), 404
        current_ids = (tutor_row.data.get('approved_subject_ids') or []) if isinstance(tutor_row.data, dict) else []
        
        updated_ids = list(current_ids)
        if action == 'approve':
            if subject_id not in updated_ids:
                updated_ids.append(subject_id)
        else:  # 'reject' and 'remove' both result in removal
            updated_ids = [sid for sid in updated_ids if sid != subject_id]
        
        # Update the tutor record (array of approved subject IDs) when column exists
        try:
            supabase.table('tutors').update({
                'approved_subject_ids': updated_ids
            }).eq('id', tutor_id).execute()
        except Exception as e:
            # Column may not exist; proceed since subject_approvals is source of truth
            print(f"Skipping approved_subject_ids update: {e}")

        # Also mirror into subject_approvals as a history/log
        try:
            if action == 'approve':
                # Manual upsert: check then update/insert
                existing = (
                    supabase
                    .table('subject_approvals')
                    .select('id')
                    .eq('tutor_id', tutor_id)
                    .eq('subject_id', subject_id)
                    .limit(1)
                    .execute()
                )
                now_iso = datetime.now(timezone.utc).isoformat()
                if existing.data and len(existing.data) > 0:
                    supabase.table('subject_approvals').update({
                        'status': 'approved',
                        'approved_by': admin_id,
                        'approved_at': now_iso
                    }).eq('tutor_id', tutor_id).eq('subject_id', subject_id).execute()
                else:
                    supabase.table('subject_approvals').insert({
                        'tutor_id': tutor_id,
                        'subject_id': subject_id,
                        'status': 'approved',
                        'approved_by': admin_id,
                        'approved_at': now_iso
                    }).execute()
            else:
                # remove or mark as rejected
                existing = (
                    supabase
                    .table('subject_approvals')
                    .select('id')
                    .eq('tutor_id', tutor_id)
                    .eq('subject_id', subject_id)
                    .limit(1)
                    .execute()
                )
                if existing.data and len(existing.data) > 0:
                    if action == 'reject':
                        supabase.table('subject_approvals').update({
                            'status': 'rejected',
                            'approved_by': admin_id,
                            'approved_at': None
                        }).eq('tutor_id', tutor_id).eq('subject_id', subject_id).execute()
                    else:
                        supabase.table('subject_approvals').delete().eq('tutor_id', tutor_id).eq('subject_id', subject_id).execute()
        except Exception as e:
            import traceback
            print(f"Subject approvals write failed: {e}\n{traceback.format_exc()}")
            return jsonify({'error': 'Failed to update subject approvals', 'details': str(e)}), 500
        
        # Send email notification for approval/rejection (not for removal)
        if action in ['approve', 'reject']:
            try:
                # Get subject details
                subject_result = supabase.table('subjects').select('name').eq('id', subject_id).single().execute()
                # Get admin details
                admin_details = supabase.table('admins').select('first_name, last_name').eq('id', admin_id).single().execute()
                
                if tutor_row.data and subject_result.data and admin_details.data:
                    from utils.email_service import get_email_service
                    
                    tutor_name = f"{tutor_row.data['first_name']} {tutor_row.data['last_name']}"
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
                        tutor_row.data['email'],
                        subject_line,
                        html_body
                    )
                    print(f"Approval notification sent to {tutor_row.data['email']} for {subject_name}: {action}")
                    
            except Exception as e:
                print(f"Failed to send approval notification email: {e}")
                # Don't fail the entire operation if email fails
        
        return jsonify({'message': f'Subject approval {action}d successfully', 'subject_id': subject_id}), 200
        
    except Exception as e:
        import traceback
        print(f"Error updating subject approvals: {e}\n{traceback.format_exc()}")
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500

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