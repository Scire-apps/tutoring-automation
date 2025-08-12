from flask import Blueprint, request, jsonify
from utils.auth import require_auth
from utils.db import get_supabase_client

tutee_bp = Blueprint('tutee', __name__)


@tutee_bp.route('/api/tutee/dashboard', methods=['GET'])
@require_auth
def get_tutee_dashboard():
    """Return the authenticated tutee's profile, opportunities, and jobs"""
    supabase = get_supabase_client()

    # Find tutee by auth_id
    tutee_result = supabase.table('tutees').select('*').eq('auth_id', request.user_id).single().execute()
    if not tutee_result.data:
        return jsonify({'error': 'Tutee profile not found'}), 404

    tutee = tutee_result.data

    # Load own opportunities (embedded subject fields)
    opps = supabase.table('tutoring_opportunities').select('*').eq('tutee_id', tutee['id']).order('created_at', desc=True).execute()

    # Load own jobs (embedded subject fields)
    jobs = supabase.table('tutoring_jobs').select('*').eq('tutee_id', tutee['id']).order('created_at', desc=True).execute()

    return jsonify({
        'tutee': tutee,
        'opportunities': opps.data or [],
        'jobs': jobs.data or []
    })


@tutee_bp.route('/api/tutee/opportunities', methods=['POST'])
@require_auth
def create_tutoring_opportunity():
    """Create a new tutoring opportunity request for the authenticated tutee"""
    data = request.get_json() or {}
    required = ['subject_name', 'subject_type', 'subject_grade', 'sessions_per_week', 'availability']
    missing = [f for f in required if f not in data]
    if missing:
        return jsonify({'error': f'Missing required fields: {", ".join(missing)}'}), 400

    supabase = get_supabase_client()

    # Find tutee by auth_id
    tutee_result = supabase.table('tutees').select('id, school_id').eq('auth_id', request.user_id).single().execute()
    if not tutee_result.data:
        return jsonify({'error': 'Tutee profile not found'}), 404

    tutee_id = tutee_result.data['id']

    opp_insert = {
        'tutee_id': tutee_id,
        'subject_name': data['subject_name'],
        'subject_type': data['subject_type'],
        'subject_grade': str(data['subject_grade']),
        'sessions_per_week': data['sessions_per_week'],
        'availability': data['availability'],  # Expect JSON structure
        'location_preference': data.get('location_preference'),
        'additional_notes': data.get('additional_notes'),
        'status': 'open',
        'priority': data.get('priority', 'normal')
    }

    result = supabase.table('tutoring_opportunities').insert(opp_insert).execute()
    if not result.data:
        return jsonify({'error': 'Failed to create opportunity'}), 500

    return jsonify({'message': 'Opportunity created', 'opportunity': result.data[0]}), 201


