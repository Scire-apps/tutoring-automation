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
    """Create a new single-session tutoring opportunity request.

    For the new single-session flow, tutees no longer submit weekly availability
    at creation time. They will provide concrete availability after a tutor accepts.
    """
    data = request.get_json() or {}
    required = ['subject_name', 'subject_type', 'subject_grade']
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
        # Single-session flow: no availability at creation time
        'availability': None,
        'location_preference': data.get('location_preference'),
        'additional_notes': data.get('additional_notes'),
        'status': 'open',
        'priority': data.get('priority', 'normal')
    }

    result = supabase.table('tutoring_opportunities').insert(opp_insert).execute()
    if not result.data:
        return jsonify({'error': 'Failed to create opportunity'}), 500

    return jsonify({'message': 'Opportunity created', 'opportunity': result.data[0]}), 201


@tutee_bp.route('/api/tutee/jobs/<job_id>/availability', methods=['POST'])
@require_auth
def set_tutee_availability(job_id: str):
    """Tutee provides availability windows for the next 14 days (excluding next 2 days).

    Expects JSON body: { "availability": { "YYYY-MM-DD": ["HH:MM-HH:MM", ...], ... } }
    Sets job.tutee_availability and moves status to 'pending_tutor_scheduling'.
    """
    from datetime import datetime, timedelta, timezone

    payload = request.get_json() or {}
    availability = payload.get('availability')
    if not isinstance(availability, dict):
        return jsonify({'error': 'availability must be an object of date->time ranges'}), 400

    supabase = get_supabase_client()

    # Identify tutee
    tutee_res = supabase.table('tutees').select('id').eq('auth_id', request.user_id).single().execute()
    if not tutee_res.data:
        return jsonify({'error': 'Tutee profile not found'}), 404
    tutee_id = tutee_res.data['id']

    # Ensure job belongs to tutee and is awaiting tutee scheduling
    job_res = (
        supabase
        .table('tutoring_jobs')
        .select('id, tutee_id, status')
        .eq('id', job_id)
        .single()
        .execute()
    )
    if not job_res.data or job_res.data.get('tutee_id') != tutee_id:
        return jsonify({'error': 'Job not found'}), 404

    status = (job_res.data or {}).get('status')
    if status not in ['pending_tutee_scheduling', 'pending_tutor_scheduling']:
        return jsonify({'error': f'Job status must be pending scheduling. Current: {status}'}), 400

    # Validate dates within allowed horizon (next 14 days, skipping next 2 days)
    now = datetime.now(timezone.utc)
    start_day = (now + timedelta(days=2)).date()
    end_day = (now + timedelta(days=16)).date()  # exclusive upper bound
    for date_str, ranges in availability.items():
        try:
            y, m, d = map(int, date_str.split('-'))
            day = datetime(y, m, d, tzinfo=timezone.utc).date()
        except Exception:
            return jsonify({'error': f'Invalid date key: {date_str}'}), 400
        if not (start_day <= day < end_day):
            return jsonify({'error': f'Date {date_str} must be within the next 14 days (excluding next 2 days)'}), 400
        if not isinstance(ranges, list):
            return jsonify({'error': f'Ranges for {date_str} must be a list'}), 400
        for r in ranges:
            if not isinstance(r, str) or '-' not in r:
                return jsonify({'error': f'Invalid time range format for {date_str}: {r}'}), 400
            start_s, end_s = r.split('-')
            try:
                sh, sm = map(int, start_s.split(':'))
                eh, em = map(int, end_s.split(':'))
            except Exception:
                return jsonify({'error': f'Invalid HH:MM in range for {date_str}: {r}'}), 400
            if (eh, em) <= (sh, sm):
                return jsonify({'error': f'End must be after start for {date_str}: {r}'}), 400

    upd = (
        supabase
        .table('tutoring_jobs')
        .update({'tutee_availability': availability, 'status': 'pending_tutor_scheduling'})
        .eq('id', job_id)
        .execute()
    )
    if not upd.data:
        return jsonify({'error': 'Failed to save availability'}), 500

    return jsonify({'message': 'Availability saved', 'job': upd.data[0]}), 200


@tutee_bp.route('/api/tutee/jobs/<job_id>', methods=['GET'])
@require_auth
def get_tutee_job(job_id: str):
    """Fetch a job that belongs to the authenticated tutee (for scheduling UI)."""
    supabase = get_supabase_client()
    tutee_res = supabase.table('tutees').select('id').eq('auth_id', request.user_id).single().execute()
    if not tutee_res.data:
        return jsonify({'error': 'Tutee profile not found'}), 404
    tutee_id = tutee_res.data['id']

    job_res = supabase.table('tutoring_jobs').select('*').eq('id', job_id).eq('tutee_id', tutee_id).single().execute()
    if not job_res.data:
        return jsonify({'error': 'Job not found'}), 404

    job = job_res.data
    if job.get('opportunity_snapshot'):
        job['tutoring_opportunity'] = job['opportunity_snapshot']
    return jsonify({'job': job}), 200
