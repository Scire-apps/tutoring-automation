from flask import Blueprint, jsonify, request
from utils.auth import require_auth
from utils.db import get_supabase_client

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/api/auth/role', methods=['GET'])
@require_auth
def get_role():
    """Return role of current user: superadmin|admin|tutor|tutee|null
    Never raise uncaught errors; fallback to role None to avoid frontend hard failure.
    """
    try:
        supabase = get_supabase_client()
        user_id = request.user_id

        # Check admin first
        try:
            admin_res = supabase.table('admins').select('role').eq('auth_id', user_id).single().execute()
            if admin_res.data:
                return jsonify({ 'role': admin_res.data.get('role') }), 200
        except Exception:
            # Ignore and continue
            pass

        # Tutor
        try:
            tutor_res = supabase.table('tutors').select('id').eq('auth_id', user_id).single().execute()
            if tutor_res.data:
                return jsonify({ 'role': 'tutor' }), 200
        except Exception:
            pass

        # Tutee
        try:
            tutee_res = supabase.table('tutees').select('id').eq('auth_id', user_id).single().execute()
            if tutee_res.data:
                return jsonify({ 'role': 'tutee' }), 200
        except Exception:
            pass

        return jsonify({ 'role': None }), 200
    except Exception as e:
        # Final safety net: do not 500 on role checks
        return jsonify({ 'role': None, 'error': 'role_check_failed' }), 200


@auth_bp.route('/api/account/ensure', methods=['POST'])
@require_auth
def ensure_account():
    """Ensure a tutor or tutee row exists for the current user, without creating cross-role records.

    Hard rules:
    - If the user already exists as an admin, do nothing here (admins are managed separately).
    - If the user already exists as a tutor, only upsert the tutor record.
    - If the user already exists as a tutee, only upsert the tutee record.
    - If the user has no role yet, create only the requested account_type (tutor or tutee).
    """
    supabase = get_supabase_client()
    payload = request.get_json() or {}
    requested_type = payload.get('account_type')  # 'tutor' | 'tutee'
    first_name = payload.get('first_name')
    last_name = payload.get('last_name')
    school_id = payload.get('school_id')
    email = request.user_email
    auth_id = request.user_id

    if requested_type not in ['tutor', 'tutee']:
        return jsonify({ 'error': 'account_type is required' }), 400

    # Detect existing role bindings
    existing_role = None  # 'admin' | 'tutor' | 'tutee' | None
    try:
        a = supabase.table('admins').select('id').eq('auth_id', auth_id).single().execute()
        if a.data:
            existing_role = 'admin'
    except Exception:
        pass
    if existing_role != 'admin':
        try:
            t = supabase.table('tutors').select('id').eq('auth_id', auth_id).single().execute()
            if t.data:
                existing_role = 'tutor'
        except Exception:
            pass
        if existing_role != 'tutor':
            try:
                te = supabase.table('tutees').select('id').eq('auth_id', auth_id).single().execute()
                if te.data:
                    existing_role = 'tutee'
            except Exception:
                pass

    # Admins: do not create a tutor/tutee implicitly
    if existing_role == 'admin':
        return jsonify({ 'status': 'admin_exists' }), 200

    # If user already has a role, force the operation to that role to avoid cross-creation
    effective_type = existing_role if existing_role in ['tutor', 'tutee'] else requested_type
    table = 'tutors' if effective_type == 'tutor' else 'tutees'

    # Check exists first
    try:
        exists = supabase.table(table).select('id').eq('auth_id', auth_id).single().execute()
        if exists.data:
            return jsonify({ 'status': 'exists', 'id': exists.data['id'] }), 200
    except Exception:
        # continue to create/update
        pass

    # Build data for insert/update
    data = {
        'auth_id': auth_id,
        'email': email,
        'first_name': first_name or '',
        'last_name': last_name or '',
        'school_id': school_id
    }
    if effective_type == 'tutor':
        data.update({ 'status': 'pending', 'volunteer_hours': 0 })
    else:
        # tutee defaults for new columns
        # graduation_year, subjects (jsonb array), pronouns
        if 'graduation_year' not in data:
            data.update({})

    # Try insert, on conflict perform update
    try:
        res = supabase.table(table).insert(data).execute()
        if res.data:
            return jsonify({ 'status': 'created', 'id': res.data[0]['id'] }), 201
    except Exception:
        # Likely unique violation (auth_id/email). Try update by auth_id
        try:
            upd = supabase.table(table).update(data).eq('auth_id', auth_id).execute()
            if upd.data:
                return jsonify({ 'status': 'updated', 'id': upd.data[0]['id'] }), 200
        except Exception as e2:
            return jsonify({ 'error': 'failed to ensure account', 'details': str(e2) }), 500

    # If we reached here, select again to confirm
    final = supabase.table(table).select('id').eq('auth_id', auth_id).single().execute()
    if final.data:
        return jsonify({ 'status': 'exists', 'id': final.data['id'] }), 200
    return jsonify({ 'error': 'failed to create account' }), 500


