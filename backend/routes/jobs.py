from flask import Blueprint, request, jsonify
from utils.auth import require_auth
from utils.db import get_supabase_client

jobs_bp = Blueprint('jobs', __name__)


@jobs_bp.route('/api/tutor/jobs/<job_id>/recording-link', methods=['POST'])
@require_auth
def upsert_recording_link(job_id: str):
    """Tutor provides or updates the external recording link for a scheduled job.

    Body: { recording_url: string }
    Allowed only while the job exists in tutoring_jobs (pre-completion).
    """
    supabase = get_supabase_client()

    payload = request.get_json() or {}
    recording_url = (payload.get('recording_url') or '').strip()
    if not recording_url or not recording_url.startswith(('http://', 'https://')):
        return jsonify({'error': 'A valid recording_url is required'}), 400

    # Ensure requester is the assigned tutor and job exists in active jobs
    job_res = supabase.table('tutoring_jobs').select('id, tutor_id').eq('id', job_id).single().execute()
    if not job_res.data:
        return jsonify({'error': 'Job not found or already completed'}), 404
    tutor_res = supabase.table('tutors').select('id').eq('auth_id', request.user_id).single().execute()
    if not tutor_res.data or tutor_res.data['id'] != job_res.data['tutor_id']:
        return jsonify({'error': 'Forbidden'}), 403

    # Upsert recording link by job_id (unique job_id)
    try:
        existing = supabase.table('session_recordings').select('id').eq('job_id', job_id).limit(1).execute()
        if existing.data and len(existing.data) > 0:
            upd = supabase.table('session_recordings').update({'recording_url': recording_url}).eq('job_id', job_id).execute()
            if not upd.data:
                return jsonify({'error': 'Failed to update recording link'}), 500
            return jsonify({'message': 'Recording link updated', 'recording': upd.data[0]}), 200
        else:
            ins = supabase.table('session_recordings').insert({'job_id': job_id, 'recording_url': recording_url}).execute()
            if not ins.data:
                return jsonify({'error': 'Failed to save recording link'}), 500
            return jsonify({'message': 'Recording link saved', 'recording': ins.data[0]}), 201
    except Exception as e:
        return jsonify({'error': 'recording_upsert_failed', 'details': str(e)}), 500


@jobs_bp.route('/api/tutor/jobs/<job_id>/recording-link', methods=['GET'])
@require_auth
def get_recording_link(job_id: str):
    """Tutor fetches the existing recording link for their job (if any)."""
    supabase = get_supabase_client()
    job_res = supabase.table('tutoring_jobs').select('id, tutor_id').eq('id', job_id).single().execute()
    if not job_res.data:
        return jsonify({'error': 'Job not found'}), 404
    tutor_res = supabase.table('tutors').select('id').eq('auth_id', request.user_id).single().execute()
    if not tutor_res.data or tutor_res.data['id'] != job_res.data['tutor_id']:
        return jsonify({'error': 'Forbidden'}), 403
    rec = supabase.table('session_recordings').select('recording_url').eq('job_id', job_id).single().execute()
    return jsonify({'recording_url': (rec.data or {}).get('recording_url')}), 200


@jobs_bp.route('/api/tutor/jobs/<job_id>/cancel', methods=['POST'])
@require_auth
def cancel_job(job_id: str):
    """Tutor cancels a job and returns it to the opportunities board.

    - Recreates an opportunity row (using snapshot when available or fields on the job)
    - Deletes the job row
    """
    supabase = get_supabase_client()

    # Ensure requester is the assigned tutor
    job_res = supabase.table('tutoring_jobs').select('*').eq('id', job_id).single().execute()
    if not job_res.data:
        return jsonify({'error': 'Job not found'}), 404

    tutor_res = supabase.table('tutors').select('id').eq('auth_id', request.user_id).single().execute()
    if not tutor_res.data or tutor_res.data['id'] != job_res.data['tutor_id']:
        return jsonify({'error': 'Forbidden'}), 403

    job = job_res.data

    # Build new opportunity from snapshot or job fields
    snap = job.get('opportunity_snapshot') or {}
    opp_insert = {
        'tutee_id': job.get('tutee_id') or snap.get('tutee_id'),
        'subject_name': job.get('subject_name') or snap.get('subject_name'),
        'subject_type': job.get('subject_type') or snap.get('subject_type'),
        'subject_grade': str(job.get('subject_grade') or snap.get('subject_grade') or ''),
        'language': job.get('language') or (snap.get('language') if isinstance(snap, dict) else None) or 'English',
        'availability': None,
        'location_preference': job.get('location') or (snap.get('location_preference') if isinstance(snap, dict) else None),
        'additional_notes': snap.get('additional_notes'),
        'status': 'open',
        'priority': (snap.get('priority') if isinstance(snap, dict) else None) or 'normal'
    }

    # Minimal required fields must be present
    if not opp_insert['tutee_id'] or not opp_insert['subject_name'] or not opp_insert['subject_type'] or not opp_insert['subject_grade']:
        return jsonify({'error': 'cannot_recreate_opportunity', 'details': 'Missing required fields to recreate opportunity'}), 500

    new_opp = supabase.table('tutoring_opportunities').insert(opp_insert).execute()
    if not new_opp.data:
        return jsonify({'error': 'failed_to_recreate_opportunity'}), 500

    # Remove communications associated with this job (since the pairing is cancelled)
    # Under RLS, tutor may not be allowed to delete communications (admin-owned). Skip silently.
    try:
        supabase.table('communications').delete().eq('job_id', job_id).execute()
    except Exception:
        pass
    
    # Remove the job row entirely
    supabase.table('tutoring_jobs').delete().eq('id', job_id).execute()

    return jsonify({'message': 'Job cancelled', 'opportunity': new_opp.data[0]}), 200


@jobs_bp.route('/api/tutee/jobs/<job_id>/cancel', methods=['POST'])
@require_auth
def cancel_job_as_tutee(job_id: str):
    """Tutee cancels a job and returns it to the opportunities board.

    - Recreates an opportunity row (using snapshot when available or fields on the job)
    - Deletes the job row
    - Authorization: requester must be the job's tutee
    """
    supabase = get_supabase_client()

    # Ensure requester is the assigned tutee
    job_res = supabase.table('tutoring_jobs').select('*').eq('id', job_id).single().execute()
    if not job_res.data:
        return jsonify({'error': 'Job not found'}), 404

    tutee_res = supabase.table('tutees').select('id').eq('auth_id', request.user_id).single().execute()
    if not tutee_res.data or tutee_res.data['id'] != job_res.data['tutee_id']:
        return jsonify({'error': 'Forbidden'}), 403

    job = job_res.data

    # Build new opportunity from snapshot or job fields
    snap = job.get('opportunity_snapshot') or {}
    opp_insert = {
        'tutee_id': job.get('tutee_id') or snap.get('tutee_id'),
        'subject_name': job.get('subject_name') or snap.get('subject_name'),
        'subject_type': job.get('subject_type') or snap.get('subject_type'),
        'subject_grade': str(job.get('subject_grade') or snap.get('subject_grade') or ''),
        'language': job.get('language') or (snap.get('language') if isinstance(snap, dict) else None) or 'English',
        'availability': None,
        'location_preference': job.get('location') or (snap.get('location_preference') if isinstance(snap, dict) else None),
        'additional_notes': (snap.get('additional_notes') if isinstance(snap, dict) else None),
        'status': 'open',
        'priority': (snap.get('priority') if isinstance(snap, dict) else None) or 'normal'
    }

    # Minimal required fields must be present
    if not opp_insert['tutee_id'] or not opp_insert['subject_name'] or not opp_insert['subject_type'] or not opp_insert['subject_grade']:
        return jsonify({'error': 'cannot_recreate_opportunity', 'details': 'Missing required fields to recreate opportunity'}), 500

    new_opp = supabase.table('tutoring_opportunities').insert(opp_insert).execute()
    if not new_opp.data:
        return jsonify({'error': 'failed_to_recreate_opportunity'}), 500

    # Best-effort cleanup communications
    try:
        supabase.table('communications').delete().eq('job_id', job_id).execute()
    except Exception:
        pass

    # Remove the job row entirely
    supabase.table('tutoring_jobs').delete().eq('id', job_id).execute()

    return jsonify({'message': 'Job cancelled', 'opportunity': new_opp.data[0]}), 200

@jobs_bp.route('/api/tutor/jobs/<job_id>/complete', methods=['POST'])
@require_auth
def complete_job(job_id: str):
    """Tutor marks a job as completed; moves to awaiting verification.

    Requirements:
    - A recording link must exist in session_recordings for this job
    - After moving, communications are removed and the active job is deleted
    - Admin later verifies and moves to past_jobs with awarded hours
    """
    supabase = get_supabase_client()

    # Ensure requester is the assigned tutor
    job_res = supabase.table('tutoring_jobs').select('*').eq('id', job_id).single().execute()
    if not job_res.data:
        return jsonify({'error': 'Job not found'}), 404

    tutor_res = supabase.table('tutors').select('id, volunteer_hours').eq('auth_id', request.user_id).single().execute()
    if not tutor_res.data or tutor_res.data['id'] != job_res.data['tutor_id']:
        return jsonify({'error': 'Forbidden'}), 403

    # Require existing recording link
    rec = supabase.table('session_recordings').select('id, recording_url').eq('job_id', job_id).single().execute()
    if not rec.data or not rec.data.get('recording_url'):
        return jsonify({'error': 'recording_required', 'details': 'Please upload the session recording link before completing.'}), 400

    try:
        # Move job to awaiting verification table
        job = job_res.data
        # Fetch tutor/tutee names for denormalized storage in awaiting table
        tutor_name = None
        tutee_name = None
        try:
            t_row = supabase.table('tutors').select('first_name, last_name').eq('id', job.get('tutor_id')).single().execute()
            if t_row and t_row.data:
                tutor_name = f"{t_row.data.get('first_name','')} {t_row.data.get('last_name','')}".strip()
        except Exception:
            pass
        try:
            te_row = supabase.table('tutees').select('first_name, last_name').eq('id', job.get('tutee_id')).single().execute()
            if te_row and te_row.data:
                tutee_name = f"{te_row.data.get('first_name','')} {te_row.data.get('last_name','')}".strip()
        except Exception:
            pass
        awaiting_row = {
            'id': job['id'],
            'opportunity_id': job.get('opportunity_id'),
            'tutor_id': job.get('tutor_id'),
            'tutee_id': job.get('tutee_id'),
            # store names directly in the awaiting table
            'tutor_name': tutor_name,
            'tutee_name': tutee_name,
            'subject_name': job.get('subject_name'),
            'subject_type': job.get('subject_type'),
            'subject_grade': job.get('subject_grade'),
            'language': job.get('language') or (job.get('opportunity_snapshot') or {}).get('language') or 'English',
            'tutee_availability': job.get('tutee_availability'),
            'desired_duration_minutes': job.get('desired_duration_minutes'),
            'scheduled_time': job.get('scheduled_time'),
            'duration_minutes': job.get('duration_minutes'),
            # keep identifiers inside snapshot for admin verification logic
            'opportunity_snapshot': {
                **(job.get('opportunity_snapshot') or {}),
                'tutor_id': job.get('tutor_id'),
                'tutee_id': job.get('tutee_id'),
            },
            'location': job.get('location'),
            'status': 'awaiting_admin_verification'
        }
        ins = supabase.table('awaiting_verification_jobs').insert(awaiting_row).execute()
        if not ins.data:
            return jsonify({'error': 'failed_to_move_to_awaiting_verification'}), 500

        # Remove communications and delete active job
        supabase.table('communications').delete().eq('job_id', job_id).execute()
        supabase.table('tutoring_jobs').delete().eq('id', job_id).execute()

        return jsonify({'message': 'Job marked as completed and moved to awaiting verification'}), 200
    except Exception as e:
        return jsonify({'error': 'failed_to_complete_job', 'details': str(e)}), 500

