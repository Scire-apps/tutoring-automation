from flask import Blueprint, request, jsonify, current_app
import os
from utils.cache import TTLCache
from utils.auth import require_auth
from utils.db import get_supabase_client
from utils.email_service import get_email_service

tutee_bp = Blueprint('tutee', __name__)
_tutee_dashboard_cache = TTLCache(max_size=256, ttl_seconds=int(os.environ.get('TUTEE_DASHBOARD_CACHE_TTL', '3')))


@tutee_bp.route('/api/tutee/dashboard', methods=['GET'])
@require_auth
def get_tutee_dashboard():
    """Return the authenticated tutee's profile, opportunities, and jobs"""
    supabase = get_supabase_client()

    # Microcache per tutee to smooth repeated reads during rapid navigation
    try:
        ck = f"dash:{request.user_id}"
        cached = _tutee_dashboard_cache.get(ck)
        if cached is not None:
            resp = jsonify(cached)
            resp.headers['Cache-Control'] = 'private, max-age=3'
            return resp
    except Exception:
        pass

    # Find tutee by auth_id
    tutee_result = supabase.table('tutees').select('*').eq('auth_id', request.user_id).single().execute()
    if not tutee_result.data:
        return jsonify({'error': 'Tutee profile not found'}), 404

    tutee = tutee_result.data

    # Load own opportunities (embedded subject fields)
    opps = (
        supabase
        .table('tutoring_opportunities')
        .select('*')
        .eq('tutee_id', tutee['id'])
        .order('created_at', desc=True)
        .limit(100)
        .execute()
    )

    # Load own jobs (embedded subject fields)
    jobs = (
        supabase
        .table('tutoring_jobs')
        .select('*')
        .eq('tutee_id', tutee['id'])
        .order('created_at', desc=True)
        .limit(100)
        .execute()
    )

    # Compute grade suggestion from graduation_year if present
    grade_suggestion = None
    try:
        gy = tutee.get('graduation_year')
        if gy:
            from datetime import datetime
            year_now = datetime.utcnow().year
            years_left = int(gy) - year_now
            # Map: years_left=3 -> grade 10, 4->9, 2->11, 1->12, <=0 -> 12
            mapping = {4: '9', 3: '10', 2: '11', 1: '12'}
            grade_suggestion = mapping.get(years_left, '12')
    except Exception:
        pass
    payload = {
        'tutee': tutee,
        'opportunities': opps.data or [],
        'jobs': jobs.data or [],
        'grade_suggestion': grade_suggestion
    }
    try:
        _tutee_dashboard_cache.set(ck, payload)
    except Exception:
        pass
    resp = jsonify(payload)
    resp.headers['Cache-Control'] = 'private, max-age=3'
    return resp


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
        'language': (data.get('language') or 'English'),
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


@tutee_bp.route('/api/tutee/subjects', methods=['GET'])
@require_auth
def get_tutee_subjects():
    """Return tutee profile subjects and the master subjects list from subjects.txt"""
    supabase = get_supabase_client()
    tutee_res = supabase.table('tutees').select('id, subjects').eq('auth_id', request.user_id).single().execute()
    subjects = (tutee_res.data or {}).get('subjects') if (tutee_res and tutee_res.data) else []
    # load master list from subjects.txt (repo root)
    try:
        subjects_file_path = os.path.abspath(os.path.join(current_app.root_path, '..', 'subjects.txt'))
        if os.path.exists(subjects_file_path):
            with open(subjects_file_path, 'r') as f:
                raw = f.read()
                if ',' in raw:
                    master = [s.strip() for s in raw.split(',') if s.strip()]
                else:
                    master = [s.strip() for s in raw.splitlines() if s.strip()]
        else:
            master = ['math','english','history']
    except Exception:
        master = ['math','english','history']
    # Capitalize master names to match display and stored values
    master_cap = [(n[0].upper() + n[1:]) if n else n for n in master]
    return jsonify({'subjects': subjects or [], 'all_subjects': master_cap}), 200


@tutee_bp.route('/api/tutee/subjects', methods=['PUT'])
@require_auth
def update_tutee_subjects():
    """Update tutee.subjects (array). Body: { subjects: string[] }"""
    supabase = get_supabase_client()
    body = request.get_json() or {}
    subs = body.get('subjects')
    if not isinstance(subs, list):
        return jsonify({'error': 'subjects must be an array'}), 400
    tutee_res = supabase.table('tutees').select('id').eq('auth_id', request.user_id).single().execute()
    if not tutee_res.data:
        return jsonify({'error': 'Tutee not found'}), 404
    upd = supabase.table('tutees').update({'subjects': subs}).eq('id', tutee_res.data['id']).execute()
    if not upd.data:
        return jsonify({'error': 'Failed to update subjects'}), 500
    return jsonify({'message': 'Subjects updated', 'tutee': upd.data[0]}), 200


@tutee_bp.route('/api/tutee/jobs/<job_id>/availability', methods=['POST'])
@require_auth
def set_tutee_availability(job_id: str):
    """Tutee provides availability windows for the next 14 days (excluding next 2 days).

    Expects JSON body: {
      "availability": { "YYYY-MM-DD": ["HH:MM-HH:MM", ...], ... },
      "desired_duration_minutes": 60|90|120|150|180
    }
    Sets job.tutee_availability and job.desired_duration_minutes, moves status to 'pending_tutor_scheduling'.
    """
    from datetime import datetime, timedelta, timezone

    payload = request.get_json() or {}
    availability = payload.get('availability')
    desired_duration_minutes = payload.get('desired_duration_minutes')
    if not isinstance(availability, dict):
        return jsonify({'error': 'availability must be an object of date->time ranges'}), 400
    try:
        desired_duration_minutes = int(desired_duration_minutes)
    except Exception:
        # Try to coerce from string cleanly
        try:
            desired_duration_minutes = int(str(desired_duration_minutes).strip())
        except Exception:
            return jsonify({'error': 'desired_duration_minutes must be provided (60..180)'}), 400
    # Accept any multiple of 30 minutes between 60 and 180 inclusive
    if not (isinstance(desired_duration_minutes, int) and 60 <= desired_duration_minutes <= 180 and desired_duration_minutes % 30 == 0):
        return jsonify({'error': 'desired_duration_minutes_invalid', 'details': 'Must be a multiple of 30 between 60 and 180'}), 400

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

    # Validate structure and HH:MM format; relax horizon checks to avoid timezone/horizon errors
    for date_str, ranges in availability.items():
        try:
            y, m, d = map(int, date_str.split('-'))
        except Exception:
            return jsonify({'error': f'Invalid date key: {date_str}'}), 400
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
        .update({'tutee_availability': availability, 'desired_duration_minutes': desired_duration_minutes, 'status': 'pending_tutor_scheduling'})
        .eq('id', job_id)
        .execute()
    )
    if not upd.data:
        return jsonify({'error': 'Failed to save availability'}), 500

    # Get tutor and tutee information for email notification
    job_details = supabase.table('tutoring_jobs').select('tutor_id, subject_name').eq('id', job_id).single().execute()
    if job_details.data:
        tutor_info = supabase.table('tutors').select('email, first_name, last_name').eq('id', job_details.data.get('tutor_id')).single().execute()
        tutee_info = supabase.table('tutees').select('first_name, last_name').eq('id', tutee_id).single().execute()
        
        # Send email notification to tutor
        if tutor_info.data and tutee_info.data:
            email_service = get_email_service()
            tutor_name = f"{tutor_info.data.get('first_name', '')} {tutor_info.data.get('last_name', '')}".strip()
            tutee_name = f"{tutee_info.data.get('first_name', '')} {tutee_info.data.get('last_name', '')}".strip()
            tutor_email = tutor_info.data.get('email')
            subject_name = job_details.data.get('subject_name')
            
            # Construct dashboard URL (you may need to adjust this based on your frontend URL)
            dashboard_url = f"{os.environ.get('FRONTEND_URL', 'https://your-app.vercel.app')}/tutor/dashboard"
            
            # Send scheduling notification email
            email_service.send_tutor_scheduling_notification(
                tutor_email=tutor_email,
                tutor_name=tutor_name,
                tutee_name=tutee_name,
                subject_name=subject_name,
                dashboard_url=dashboard_url
            )

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
    # Attach tutor basic info for display
    try:
        if job.get('tutor_id'):
            tutor_res = supabase.table('tutors').select('id, email, first_name, last_name').eq('id', job['tutor_id']).single().execute()
            if tutor_res.data:
                job['tutor'] = tutor_res.data
    except Exception:
        pass
    return jsonify({'job': job}), 200


@tutee_bp.route('/api/tutee/opportunities/<opportunity_id>/cancel', methods=['POST'])
@require_auth
def cancel_tutee_opportunity(opportunity_id: str):
    """Allow a tutee to cancel their own open tutoring request (opportunity).

    Sets status to 'cancelled' when the opportunity belongs to the authenticated tutee
    and is currently 'open'.
    """
    supabase = get_supabase_client()
    try:
        # Identify tutee
        tutee_res = supabase.table('tutees').select('id').eq('auth_id', request.user_id).single().execute()
        if not tutee_res.data:
            return jsonify({'error': 'Tutee profile not found'}), 404
        tutee_id = tutee_res.data['id']

        # Ensure opportunity belongs to this tutee and is open
        opp = (
            supabase
            .table('tutoring_opportunities')
            .select('id, tutee_id, status')
            .eq('id', opportunity_id)
            .single()
            .execute()
        )
        if not opp.data or opp.data.get('tutee_id') != tutee_id:
            return jsonify({'error': 'Opportunity not found'}), 404
        if opp.data.get('status') != 'open':
            return jsonify({'error': 'cannot_cancel_non_open', 'details': f"Current status: {opp.data.get('status')}"}), 400

        # Attempt to set status to cancelled
        upd = (
            supabase
            .table('tutoring_opportunities')
            .update({'status': 'cancelled'})
            .eq('id', opportunity_id)
            .execute()
        )
        if not upd.data:
            return jsonify({'error': 'failed_to_cancel'}), 500
        return jsonify({'message': 'Opportunity cancelled', 'opportunity': upd.data[0]}), 200
    except Exception as e:
        return jsonify({'error': 'cancel_failed', 'details': str(e)}), 500
