from flask import Blueprint, request, jsonify, current_app
import os
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

        # Embedded subject schema
        if school_id:
            tutees_res = supabase.table('tutees').select('id').eq('school_id', school_id).execute()
            tutee_ids = [t['id'] for t in (tutees_res.data or [])]
        else:
            tutee_ids = None

        query = supabase.table('tutoring_opportunities').select('*').order('created_at', desc=True)
        if tutee_ids and len(tutee_ids) > 0:
            query = query.in_('tutee_id', tutee_ids)
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

        # Build base query (related entity embedding removed under RLS constraints)
        query = supabase.table('tutoring_jobs').select('*').order('created_at', desc=True)

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
                .select('*')
                .in_('tutor_id', tutor_ids or ['00000000-0000-0000-0000-000000000000'])
                .order('created_at', desc=True)
                .execute()
            )
            jobs_by_tutees = (
                supabase
                .table('tutoring_jobs')
                .select('*')
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


@tutor_management_bp.route('/api/admin/awaiting-verification', methods=['GET'])
@require_admin
def list_awaiting_verification_jobs():
    """List all jobs awaiting admin verification."""
    try:
        supabase = get_supabase_client()
        res = supabase.table('awaiting_verification_jobs').select('*').order('created_at', desc=True).execute()
        return jsonify({'jobs': res.data or []}), 200
    except Exception as e:
        print(f"Error listing awaiting verification jobs: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@tutor_management_bp.route('/api/admin/awaiting-verification/<job_id>/recording', methods=['GET'])
@require_admin
def get_recording_link_for_job(job_id: str):
    """Fetch the session recording link for a given job id (from session_recordings)."""
    try:
        supabase = get_supabase_client()
        rec = supabase.table('session_recordings').select('recording_url').eq('job_id', job_id).single().execute()
        return jsonify({'recording_url': (rec.data or {}).get('recording_url')}), 200
    except Exception as e:
        print(f"Error fetching recording link: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@tutor_management_bp.route('/api/admin/awaiting-verification/<job_id>/verify', methods=['POST'])
@require_admin
def verify_completed_job(job_id: str):
    """Admin verifies a completed job: move to past_jobs and award hours.

    Body: { awarded_hours: number }
    """
    try:
        supabase = get_supabase_client()
        data = request.get_json() or {}
        awarded_hours = float(data.get('awarded_hours') or 0)
        if awarded_hours < 0:
            return jsonify({'error': 'awarded_hours must be non-negative'}), 400

        # Load awaiting job
        aw = supabase.table('awaiting_verification_jobs').select('*').eq('id', job_id).single().execute()
        if not aw.data:
            return jsonify({'error': 'Awaiting verification job not found'}), 404

        # Identify admin
        admin_res = supabase.table('admins').select('id').eq('auth_id', request.user_id).single().execute()
        if not admin_res.data:
            return jsonify({'error': 'Admin not found'}), 403

        # Move to past_jobs
        import datetime
        now = datetime.datetime.utcnow().isoformat() + 'Z'
        pj_row = {
            'id': aw.data['id'],
            'opportunity_id': aw.data.get('opportunity_id'),
            'tutor_id': aw.data.get('tutor_id'),
            'tutee_id': aw.data.get('tutee_id'),
            'subject_name': aw.data.get('subject_name'),
            'subject_type': aw.data.get('subject_type'),
            'subject_grade': aw.data.get('subject_grade'),
            'language': aw.data.get('language') or ((aw.data.get('opportunity_snapshot') or {}) if isinstance(aw.data.get('opportunity_snapshot'), dict) else {}).get('language') or 'English',
            'tutee_availability': aw.data.get('tutee_availability'),
            'desired_duration_minutes': aw.data.get('desired_duration_minutes'),
            'scheduled_time': aw.data.get('scheduled_time'),
            'duration_minutes': aw.data.get('duration_minutes'),
            'opportunity_snapshot': aw.data.get('opportunity_snapshot'),
            'location': aw.data.get('location'),
            'verified_by': admin_res.data['id'],
            'verified_at': now,
            'awarded_volunteer_hours': awarded_hours
        }
        ins = supabase.table('past_jobs').insert(pj_row).execute()
        if not ins.data:
            return jsonify({'error': 'failed_to_archive_job'}), 500

        # Update tutor hours
        try:
            tutor_id = aw.data.get('tutor_id')
            if tutor_id and awarded_hours:
                tutor = supabase.table('tutors').select('volunteer_hours').eq('id', tutor_id).single().execute()
                current = float((tutor.data or {}).get('volunteer_hours') or 0)
                supabase.table('tutors').update({'volunteer_hours': current + float(awarded_hours)}).eq('id', tutor_id).execute()
        except Exception:
            pass

        # Remove communications and awaiting row
        supabase.table('communications').delete().eq('job_id', job_id).execute()
        supabase.table('awaiting_verification_jobs').delete().eq('id', job_id).execute()

        return jsonify({'message': 'Job verified and archived'}), 200
    except Exception as e:
        import traceback
        print(f"Error verifying job: {e}\n{traceback.format_exc()}")
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
        
        # Embedded subject model: approvals are stored with subject_name/type/grade
        approvals = supabase.table('subject_approvals').select('*').eq('tutor_id', tutor_id).execute()

        return jsonify({
            'tutor': tutor,
            'approved_subject_ids': [],
            'available_subjects': [],
            'subject_approvals': approvals.data or []
        }), 200
        
    except Exception as e:
        print(f"Error getting tutor details: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@tutor_management_bp.route('/api/admin/tutors/<tutor_id>/approvals', methods=['GET'])
@require_admin
def list_tutor_approvals(tutor_id):
    """List subject approvals for a tutor (embedded subject fields)"""
    try:
        supabase = get_supabase_client()
        res = supabase.table('subject_approvals').select('*').eq('tutor_id', tutor_id).execute()
        return jsonify({'subject_approvals': res.data or []}), 200
    except Exception as e:
        print(f"Error listing tutor approvals: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@tutor_management_bp.route('/api/admin/tutors/<tutor_id>/subjects', methods=['POST'])
@require_admin
def update_subject_approvals(tutor_id):
    """Update subject approvals for a tutor (embedded subject fields)"""
    try:
        data = request.get_json()
        subject_id = data.get('subject_id')  # deprecated
        subject_name = (data.get('subject_name') or '').strip()
        subject_type = (data.get('subject_type') or '').strip()
        subject_grade = str(data.get('subject_grade') or '').strip()
        action = data.get('action')  # 'approve', 'reject', or 'remove'
        
        if not action:
            return jsonify({'error': 'action is required'}), 400
        
        # Validate embedded subject fields when approving/rejecting
        if action != 'remove':
            if not subject_name or not subject_type or not subject_grade:
                return jsonify({'error': 'subject_name, subject_type, subject_grade are required'}), 400
        
        if action not in ['approve', 'reject', 'remove']:
            return jsonify({'error': 'Invalid action'}), 400
        
        supabase = get_supabase_client()
        
        # Get the admin ID from the authenticated user
        admin_result = supabase.table('admins').select('id').eq('auth_id', request.user_id).single().execute()
        if not admin_result.data:
            return jsonify({'error': 'Admin record not found'}), 403
        
        admin_id = admin_result.data['id']
        
        # Deprecated subjects table path removed; we now embed subject fields

        # Fetch tutor basic info (array column may not exist in some deployments)
        tutor_row = supabase.table('tutors').select('first_name, last_name, email').eq('id', tutor_id).single().execute()
        if not tutor_row.data:
            return jsonify({'error': 'Tutor not found'}), 404
        # No more approved_subject_ids column maintenance; subject_approvals is source of truth

        # Write into subject_approvals (embedded fields)
        try:
            if action == 'approve':
                existing = supabase.table('subject_approvals').select('id').eq('tutor_id', tutor_id).eq('subject_name', subject_name).eq('subject_type', subject_type).eq('subject_grade', subject_grade).limit(1).execute()
                now_iso = datetime.now(timezone.utc).isoformat()
                if existing.data and len(existing.data) > 0:
                    supabase.table('subject_approvals').update({
                        'status': 'approved',
                        'approved_by': admin_id,
                        'approved_at': now_iso
                    }).eq('tutor_id', tutor_id).eq('subject_name', subject_name).eq('subject_type', subject_type).eq('subject_grade', subject_grade).execute()
                else:
                    supabase.table('subject_approvals').insert({
                        'tutor_id': tutor_id,
                        'subject_name': subject_name,
                        'subject_type': subject_type,
                        'subject_grade': subject_grade,
                        'status': 'approved',
                        'approved_by': admin_id,
                        'approved_at': now_iso
                    }).execute()
            else:
                existing = supabase.table('subject_approvals').select('id').eq('tutor_id', tutor_id).eq('subject_name', subject_name).eq('subject_type', subject_type).eq('subject_grade', subject_grade).limit(1).execute()
                if existing.data and len(existing.data) > 0:
                    if action == 'reject':
                        supabase.table('subject_approvals').update({
                            'status': 'rejected',
                            'approved_by': admin_id,
                            'approved_at': None
                        }).eq('tutor_id', tutor_id).eq('subject_name', subject_name).eq('subject_type', subject_type).eq('subject_grade', subject_grade).execute()
                    else:
                        supabase.table('subject_approvals').delete().eq('tutor_id', tutor_id).eq('subject_name', subject_name).eq('subject_type', subject_type).eq('subject_grade', subject_grade).execute()
        except Exception as e:
            import traceback
            print(f"Subject approvals write failed: {e}\n{traceback.format_exc()}")
            return jsonify({'error': 'Failed to update subject approvals', 'details': str(e)}), 500
        
        # Send email notification for approval/rejection (not for removal)
        if action in ['approve', 'reject']:
            try:
                # Get admin details
                admin_details = supabase.table('admins').select('first_name, last_name').eq('id', admin_id).single().execute()
                
                if tutor_row.data and admin_details.data:
                    from utils.email_service import get_email_service
                    
                    tutor_name = f"{tutor_row.data['first_name']} {tutor_row.data['last_name']}"
                    admin_name = f"{admin_details.data['first_name']} {admin_details.data['last_name']}"
                    
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
    """Return subject options; names loaded from subjects.txt (repo root)."""
    try:
        names: list[str] = []
        try:
            subjects_file_path = os.path.abspath(os.path.join(current_app.root_path, '..', 'subjects.txt'))
            if os.path.exists(subjects_file_path):
                with open(subjects_file_path, 'r') as f:
                    raw = f.read()
                    # Support comma or newline-separated values
                    if ',' in raw:
                        names = [s.strip() for s in raw.split(',') if s.strip()]
                    else:
                        names = [s.strip() for s in raw.splitlines() if s.strip()]
            else:
                names = ['math','english','history']
        except Exception:
            # Fallback
            names = ['math','english','history']
        names_payload = [{'name': n[0].upper() + n[1:] if n else n} for n in names]
        return jsonify({
            'subjects': names_payload,
            'types': ['Academic','ALP','IB'],
            'grades': ['9','10','11','12']
        }), 200
    except Exception as e:
        return jsonify({'subjects': [], 'types': ['Academic','ALP','IB'], 'grades': ['9','10','11','12']}), 200

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


@tutor_management_bp.route('/api/admin/tutors/<tutor_id>/history', methods=['GET'])
@require_admin
def get_tutor_history(tutor_id: str):
    """Return past jobs (verified) for a specific tutor."""
    try:
        supabase = get_supabase_client()
        res = supabase.table('past_jobs').select('*').eq('tutor_id', tutor_id).order('created_at', desc=True).execute()
        return jsonify({'jobs': res.data or []}), 200
    except Exception as e:
        print(f"Error fetching tutor history: {e}")
        return jsonify({'error': 'Internal server error'}), 500


# ===============================
# Certification Requests (Admin)
# ===============================

@tutor_management_bp.route('/api/admin/certification-requests', methods=['GET'])
@require_admin
def list_certification_requests_admin():
    """Admin lists certification requests for tutors in their school."""
    try:
        supabase = get_supabase_client()

        # Determine admin school
        admin_res = supabase.table('admins').select('school_id').eq('auth_id', request.user_id).single().execute()
        school_id = (admin_res.data or {}).get('school_id') if admin_res.data else None

        # If admin has a school, filter tutors by that school and pull their requests
        if school_id:
            tutors_res = supabase.table('tutors').select('id').eq('school_id', school_id).execute()
            tutor_ids = [t['id'] for t in (tutors_res.data or [])]
            if not tutor_ids:
                return jsonify({'requests': []}), 200
            reqs = (
                supabase
                .table('certification_requests')
                .select('*')
                .in_('tutor_id', tutor_ids)
                .order('created_at', desc=True)
                .execute()
            )
            return jsonify({'requests': reqs.data or []}), 200

        # No school restriction: return all (super admin case)
        reqs = supabase.table('certification_requests').select('*').order('created_at', desc=True).execute()
        return jsonify({'requests': reqs.data or []}), 200
    except Exception as e:
        print(f"Error listing certification requests: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@tutor_management_bp.route('/api/admin/certification-requests/<request_id>', methods=['DELETE'])
@require_admin
def delete_certification_request(request_id: str):
    """Admin rejects a certification request: delete the request row."""
    try:
        supabase = get_supabase_client()
        # Ensure the request exists and, if admin has a school, is within scope
        admin_res = supabase.table('admins').select('school_id').eq('auth_id', request.user_id).single().execute()
        school_id = (admin_res.data or {}).get('school_id') if admin_res.data else None

        req_res = supabase.table('certification_requests').select('*').eq('id', request_id).single().execute()
        if not req_res.data:
            return jsonify({'error': 'Request not found'}), 404

        if school_id:
            tutor_res = supabase.table('tutors').select('school_id').eq('id', req_res.data.get('tutor_id')).single().execute()
            if not tutor_res.data or tutor_res.data.get('school_id') != school_id:
                return jsonify({'error': 'not_in_admin_school_scope'}), 403

        supabase.table('certification_requests').delete().eq('id', request_id).execute()
        return jsonify({'message': 'Certification request deleted'}), 200
    except Exception as e:
        print(f"Error deleting certification request: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@tutor_management_bp.route('/api/admin/certification-requests/<request_id>/approve', methods=['POST'])
@require_admin
def approve_certification_request(request_id: str):
    """Admin approves a certification request: create subject_approval and delete the request.

    This endpoint reads the certification request row (subject_name/type/grade and tutor_id),
    writes an approved row into subject_approvals, and then removes the certification request.
    """
    try:
        supabase = get_supabase_client()

        # Identify admin for audit fields
        admin_row = supabase.table('admins').select('id, school_id').eq('auth_id', request.user_id).single().execute()
        if not admin_row.data:
            return jsonify({'error': 'Admin record not found'}), 403
        admin_id = admin_row.data['id']
        admin_school_id = admin_row.data.get('school_id')

        # Load request
        req_res = supabase.table('certification_requests').select('*').eq('id', request_id).single().execute()
        if not req_res.data:
            return jsonify({'error': 'Request not found'}), 404
        req_row = req_res.data

        # Scope check: if admin has a school, tutor must belong to it
        if admin_school_id:
            tutor_res = supabase.table('tutors').select('school_id').eq('id', req_row.get('tutor_id')).single().execute()
            if not tutor_res.data or tutor_res.data.get('school_id') != admin_school_id:
                return jsonify({'error': 'not_in_admin_school_scope'}), 403

        subject_name = (req_row.get('subject_name') or '').strip()
        subject_type = (req_row.get('subject_type') or '').strip()
        subject_grade = str(req_row.get('subject_grade') or '').strip()
        tutor_id = req_row.get('tutor_id')

        if not (tutor_id and subject_name and subject_type and subject_grade):
            return jsonify({'error': 'invalid_request_row'}), 400

        # Upsert approval as approved
        from datetime import datetime, timezone
        now_iso = datetime.now(timezone.utc).isoformat()
        existing = (
            supabase.table('subject_approvals')
            .select('id')
            .eq('tutor_id', tutor_id)
            .eq('subject_name', subject_name)
            .eq('subject_type', subject_type)
            .eq('subject_grade', subject_grade)
            .limit(1)
            .execute()
        )
        if existing.data and len(existing.data) > 0:
            supabase.table('subject_approvals').update({
                'status': 'approved',
                'approved_by': admin_id,
                'approved_at': now_iso
            }).eq('tutor_id', tutor_id).eq('subject_name', subject_name).eq('subject_type', subject_type).eq('subject_grade', subject_grade).execute()
        else:
            supabase.table('subject_approvals').insert({
                'tutor_id': tutor_id,
                'subject_name': subject_name,
                'subject_type': subject_type,
                'subject_grade': subject_grade,
                'status': 'approved',
                'approved_by': admin_id,
                'approved_at': now_iso
            }).execute()

        # Delete certification request after approval
        supabase.table('certification_requests').delete().eq('id', request_id).execute()

        return jsonify({'message': 'Certification approved and request removed'}), 200
    except Exception as e:
        import traceback
        print(f"Error approving certification request: {e}\n{traceback.format_exc()}")
        return jsonify({'error': 'Internal server error'}), 500