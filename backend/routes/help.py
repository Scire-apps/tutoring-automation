from flask import Blueprint, request, jsonify
from utils.auth import require_auth
from utils.db import get_supabase_client

help_bp = Blueprint('help', __name__)


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
            tutee_row = supabase.table('tutees').select('id, first_name, last_name, email, school_id, graduation_year').eq('auth_id', request.user_id).single().execute()
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
        gy = tutee_row.data.get('graduation_year')
        try:
            from datetime import datetime
            current_year = datetime.utcnow().year
            if gy:
                years_left = int(gy) - current_year
                user_grade = {4: '9', 3: '10', 2: '11', 1: '12'}.get(years_left, '12')
            else:
                user_grade = None
        except Exception:
            user_grade = None
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


