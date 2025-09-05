from flask import Blueprint, request, jsonify
from utils.auth import require_auth, require_admin
from utils.db import get_supabase_client
from utils.cache import TTLCache
import os

help_bp = Blueprint('help', __name__)
_help_admin_cache = TTLCache(max_size=64, ttl_seconds=int(os.environ.get('ADMIN_HELP_TTL', '5')))


@help_bp.route('/api/help/submit', methods=['POST'])
@require_auth
def submit_help_request():
    """Insert a new help request for the authenticated user.

    Body: { urgency: 'urgent'|'non-urgent', description: string }
    Maps urgency to 'high'|'normal' for storage.
    Derives role/tutor_id/tutee_id/school_id and user profile fields.
    """
    supabase = get_supabase_client()
    body = request.get_json() or {}
    urgency_raw = str(body.get('urgency') or '').strip().lower()
    description = (body.get('description') or '').strip()
    if not description:
        return jsonify({'error': 'description_required'}), 400

    urgency = 'high' if urgency_raw == 'urgent' else 'normal'

    # Determine role and profile (prefer tutor, then tutee)
    role = None
    tutor_row = None
    tutee_row = None
    try:
        tutor_row = supabase.table('tutors').select('id, first_name, last_name, email, school_id').eq('auth_id', request.user_id).single().execute()
        if tutor_row.data:
            role = 'tutor'
    except Exception:
        tutor_row = None
    if role is None:
        try:
            tutee_row = supabase.table('tutees').select('id, first_name, last_name, email, school_id, grade').eq('auth_id', request.user_id).single().execute()
            if tutee_row.data:
                role = 'tutee'
        except Exception:
            tutee_row = None

    if role is None:
        return jsonify({'error': 'profile_not_found'}), 404

    if role == 'tutor':
        first_name = tutor_row.data.get('first_name')
        last_name = tutor_row.data.get('last_name')
        email = tutor_row.data.get('email')
        school_id = tutor_row.data.get('school_id')
        user_grade = None
        tutor_id = tutor_row.data.get('id')
        tutee_id = None
    else:
        first_name = tutee_row.data.get('first_name')
        last_name = tutee_row.data.get('last_name')
        email = tutee_row.data.get('email')
        school_id = tutee_row.data.get('school_id')
        user_grade = (tutee_row.data or {}).get('grade')
        tutor_id = None
        tutee_id = tutee_row.data.get('id')

    payload = {
        'auth_id': request.user_id,
        'role': role,
        'tutor_id': tutor_id,
        'tutee_id': tutee_id,
        'school_id': school_id,
        'user_first_name': first_name or '',
        'user_last_name': last_name or '',
        'user_email': email or request.user_email or '',
        'user_grade': user_grade,
        'urgency': urgency,
        'description': description,
    }

    ins = supabase.table('help_questions').insert(payload).execute()
    if not ins.data:
        return jsonify({'error': 'failed_to_submit'}), 500
    return jsonify({'message': 'submitted', 'help': ins.data[0]}), 201


@help_bp.route('/api/admin/help-requests', methods=['GET'])
@require_admin
def list_help_requests_admin():
    """List help requests visible to the admin (scoped by admin's school).

    Returns most recent first.
    """
    supabase = get_supabase_client()
    try:
        admin_res = supabase.table('admins').select('school_id').eq('auth_id', request.user_id).single().execute()
        school_id = (admin_res.data or {}).get('school_id') if admin_res.data else None

        ck = f"help:{request.user_id}:{school_id or 'all'}"
        cached = _help_admin_cache.get(ck)
        if cached is not None:
            return jsonify({'help_requests': cached}), 200

        query = (
            supabase
            .table('help_questions')
            .select('id, auth_id, role, tutor_id, tutee_id, school_id, user_first_name, user_last_name, user_email, user_grade, submitted_at, urgency, description')
            .order('submitted_at', desc=True)
        )
        if school_id:
            query = query.eq('school_id', school_id)
        res = query.limit(100).execute()
        data = res.data or []
        _help_admin_cache.set(ck, data)
        return jsonify({'help_requests': data}), 200
    except Exception as e:
        print(f"Error listing help requests: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@help_bp.route('/api/admin/help-requests/<request_id>', methods=['DELETE'])
@require_admin
def delete_help_request_admin(request_id: str):
    """Mark a help request as resolved by deleting it (scoped by admin's school)."""
    supabase = get_supabase_client()
    try:
        # Scope check
        admin_res = supabase.table('admins').select('school_id').eq('auth_id', request.user_id).single().execute()
        admin_school_id = (admin_res.data or {}).get('school_id') if admin_res.data else None

        row = supabase.table('help_questions').select('school_id').eq('id', request_id).single().execute()
        if not row.data:
            return jsonify({'error': 'not_found'}), 404
        if admin_school_id and row.data.get('school_id') != admin_school_id:
            return jsonify({'error': 'not_in_admin_school_scope'}), 403

        supabase.table('help_questions').delete().eq('id', request_id).execute()
        return jsonify({'message': 'resolved'}), 200
    except Exception as e:
        print(f"Error deleting help request: {e}")
        return jsonify({'error': 'Internal server error'}), 500

