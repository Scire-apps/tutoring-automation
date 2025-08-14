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

    # Update job to cancelled; do not resurrect the deleted opportunity in single-session flow
    supabase.table('tutoring_jobs').update({'status': 'cancelled'}).eq('id', job_id).execute()

    return jsonify({'message': 'Job cancelled and opportunity reopened'}), 200


@jobs_bp.route('/api/tutor/jobs/<job_id>/complete', methods=['POST'])
@require_auth
def complete_job(job_id: str):
    """Tutor completes a job; creates session recording, updates hours and statuses"""
    supabase = get_supabase_client()

    payload = request.get_json() or {}
    duration_seconds = payload.get('duration_seconds')  # optional numeric
    file_name = payload.get('file_name')
    file_type = payload.get('file_type')
    file_size = payload.get('file_size')

    # Ensure requester is the assigned tutor
    job_res = supabase.table('tutoring_jobs').select('id, tutor_id, opportunity_id').eq('id', job_id).single().execute()
    if not job_res.data:
        return jsonify({'error': 'Job not found'}), 404

    tutor_res = supabase.table('tutors').select('id, volunteer_hours').eq('auth_id', request.user_id).single().execute()
    if not tutor_res.data or tutor_res.data['id'] != job_res.data['tutor_id']:
        return jsonify({'error': 'Forbidden'}), 403

    tutor_id = tutor_res.data['id']
    opportunity_id = job_res.data['opportunity_id']

    try:
        # Compute hours (exact hours based on duration if provided)
        volunteer_hours = 0
        if isinstance(duration_seconds, (int, float)) and duration_seconds > 0:
            volunteer_hours = float(duration_seconds) / 3600.0

        # Insert session recording metadata (no actual upload handled here)
        rec_insert = {
            'job_id': job_id,
            'file_path': f'metadata_only/{job_id}_{int(__import__("time").time())}_{file_name or "no_file"}',
            'file_url': None,
            'duration_seconds': duration_seconds,
            'volunteer_hours': volunteer_hours,
            'status': 'approved'
        }
        supabase.table('session_recordings').insert(rec_insert).execute()

        # Update tutor hours
        current_hours = float(tutor_res.data.get('volunteer_hours') or 0)
        new_hours = current_hours + volunteer_hours
        supabase.table('tutors').update({'volunteer_hours': new_hours}).eq('id', tutor_id).execute()

        # In single-session flow, remove the job after completion
        supabase.table('tutoring_jobs').delete().eq('id', job_id).execute()

        return jsonify({'message': 'Job completed and removed', 'volunteer_hours_added': volunteer_hours}), 200
    except Exception as e:
        return jsonify({'error': 'failed_to_complete_job', 'details': str(e)}), 500

