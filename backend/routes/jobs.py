from flask import Blueprint, request, jsonify
from utils.auth import require_auth
from utils.db import get_supabase_client

jobs_bp = Blueprint('jobs', __name__)


@jobs_bp.route('/api/tutor/jobs/<job_id>/cancel', methods=['POST'])
@require_auth
def cancel_job(job_id: str):
    """Tutor cancels a job and reopens the opportunity"""
    supabase = get_supabase_client()

    # Ensure requester is the assigned tutor
    job_res = supabase.table('tutoring_jobs').select('id, tutor_id, opportunity_id').eq('id', job_id).single().execute()
    if not job_res.data:
        return jsonify({'error': 'Job not found'}), 404

    tutor_res = supabase.table('tutors').select('id').eq('auth_id', request.user_id).single().execute()
    if not tutor_res.data or tutor_res.data['id'] != job_res.data['tutor_id']:
        return jsonify({'error': 'Forbidden'}), 403

    # Update job to cancelled
    supabase.table('tutoring_jobs').update({'status': 'cancelled'}).eq('id', job_id).execute()
    # Return opportunity to open + high priority
    opp_id = job_res.data['opportunity_id']
    supabase.table('tutoring_opportunities').update({'status': 'open', 'priority': 'high'}).eq('id', opp_id).execute()

    return jsonify({'message': 'Job cancelled and opportunity reopened'}), 200


