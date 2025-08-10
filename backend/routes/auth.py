from flask import Blueprint, jsonify, request
from utils.auth import require_auth
from utils.db import get_supabase_client

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/api/auth/role', methods=['GET'])
@require_auth
def get_role():
    """Return role of current user: superadmin|admin|tutor|tutee|null"""
    supabase = get_supabase_client()
    user_id = request.user_id

    # Check admin first
    admin_res = supabase.table('admins').select('role').eq('auth_id', user_id).single().execute()
    if admin_res.data:
        return jsonify({ 'role': admin_res.data.get('role') }), 200

    # Tutor
    tutor_res = supabase.table('tutors').select('id').eq('auth_id', user_id).single().execute()
    if tutor_res.data:
        return jsonify({ 'role': 'tutor' }), 200

    # Tutee
    tutee_res = supabase.table('tutees').select('id').eq('auth_id', user_id).single().execute()
    if tutee_res.data:
        return jsonify({ 'role': 'tutee' }), 200

    return jsonify({ 'role': None }), 200


@auth_bp.route('/api/account/ensure', methods=['POST'])
@require_auth
def ensure_account():
    """Ensure a tutor/tutee row exists for the current user"""
    supabase = get_supabase_client()
    payload = request.get_json() or {}
    account_type = payload.get('account_type')  # 'tutor' | 'tutee'
    first_name = payload.get('first_name')
    last_name = payload.get('last_name')
    school_id = payload.get('school_id')
    email = request.user_email
    auth_id = request.user_id

    if account_type not in ['tutor', 'tutee']:
        return jsonify({ 'error': 'account_type is required' }), 400

    table = 'tutors' if account_type == 'tutor' else 'tutees'

    # Check exists
    exists = supabase.table(table).select('id').eq('auth_id', auth_id).single().execute()
    if exists.data:
        return jsonify({ 'status': 'exists' }), 200

    # Insert
    data = {
        'auth_id': auth_id,
        'email': email,
        'first_name': first_name or '',
        'last_name': last_name or '',
        'school_id': school_id
    }
    if account_type == 'tutor':
        data.update({ 'status': 'pending', 'volunteer_hours': 0 })

    res = supabase.table(table).insert(data).execute()
    if not res.data:
        return jsonify({ 'error': 'failed to create account' }), 500

    return jsonify({ 'status': 'created', 'id': res.data[0]['id'] }), 201


