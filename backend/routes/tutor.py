from flask import Blueprint, request, jsonify
from utils.auth import require_auth
from utils.db import get_supabase_client

tutor_bp = Blueprint('tutor', __name__)


@tutor_bp.route('/api/tutor/dashboard', methods=['GET'])
@require_auth
def get_tutor_dashboard():
    """Return the authenticated tutor's profile, approved subjects, opportunities, and jobs"""
    supabase = get_supabase_client()

    tutor_result = supabase.table('tutors').select('*').eq('auth_id', request.user_id).single().execute()
    if not tutor_result.data:
        return jsonify({'error': 'Tutor profile not found'}), 404

    tutor = tutor_result.data
    approved_subject_ids = tutor.get('approved_subject_ids') or []

    # Opportunities visible to tutors: all open (embedded subject fields)
    opps = supabase.table('tutoring_opportunities').select('*').eq('status', 'open').order('created_at', desc=True).execute()

    # Jobs belonging to this tutor
    jobs_res = (
        supabase
        .table('tutoring_jobs')
        .select('*')
        .eq('tutor_id', tutor['id'])
        .order('created_at', desc=True)
        .execute()
    )

    jobs = jobs_res.data or []
    # Attach synthetic tutoring_opportunity from snapshot if available
    for j in jobs:
        if j.get('opportunity_snapshot'):
            j['tutoring_opportunity'] = j['opportunity_snapshot']

    # Include jobs awaiting admin verification for this tutor
    try:
        awaiting_res = (
            supabase
            .table('awaiting_verification_jobs')
            .select('*')
            .eq('tutor_id', tutor['id'])
            .order('created_at', desc=True)
            .execute()
        )
        for aw in (awaiting_res.data or []):
            aw_copy = dict(aw)
            # Normalize fields to look like tutoring_jobs items in UI
            aw_copy['status'] = 'awaiting_admin_verification'
            if aw_copy.get('opportunity_snapshot'):
                aw_copy['tutoring_opportunity'] = aw_copy['opportunity_snapshot']
            jobs.append(aw_copy)
    except Exception:
        pass

    return jsonify({
        'tutor': tutor,
        'approved_subject_ids': approved_subject_ids,
        'opportunities': opps.data or [],
        'jobs': jobs
    })


@tutor_bp.route('/api/tutor/opportunities/<opportunity_id>/accept', methods=['POST'])
@require_auth
def accept_opportunity(opportunity_id: str):
    """Tutor accepts an opportunity; creates a job and moves to pending tutee scheduling.

    New single-session flow: when a tutor accepts, we remove the opportunity
    from the opportunities pool (delete row) and create a corresponding job
    in status 'pending_tutee_scheduling'. Tutee will then provide availability
    on the job; afterward tutor finalizes schedule.
    """
    supabase = get_supabase_client()

    # Get tutor
    tutor_result = supabase.table('tutors').select('id, approved_subject_ids').eq('auth_id', request.user_id).single().execute()
    if not tutor_result.data:
        return jsonify({'error': 'Tutor profile not found'}), 404
    tutor = tutor_result.data

    # Get opportunity
    opp_result = supabase.table('tutoring_opportunities').select('*').eq('id', opportunity_id).single().execute()
    if not opp_result.data:
        return jsonify({'error': 'Opportunity not found'}), 404
    opp = opp_result.data

    # Check subject approval strictly via subject_approvals
    # Check approval by embedded fields
    subj_name = opp.get('subject_name')
    subj_type = opp.get('subject_type')
    subj_grade = opp.get('subject_grade')
    approval = (
        supabase
        .table('subject_approvals')
        .select('id')
        .eq('tutor_id', tutor['id'])
        .eq('subject_name', subj_name)
        .eq('subject_type', subj_type)
        .eq('subject_grade', str(subj_grade))
        .single()
        .execute()
    )
    if not approval.data:
        return jsonify({'error': 'Not approved for this subject'}), 403

    # Create job (single-session, pending tutee scheduling)
    opportunity_snapshot = opp
    job_insert = {
        'opportunity_id': opp['id'],
        'tutor_id': tutor['id'],
        'tutee_id': opp.get('tutee_id'),
        'subject_name': subj_name,
        'subject_type': subj_type,
        'subject_grade': str(subj_grade),
        'opportunity_snapshot': opportunity_snapshot,
        'status': 'pending_tutee_scheduling'
    }

    job_res = supabase.table('tutoring_jobs').insert(job_insert).execute()
    if not job_res.data:
        return jsonify({'error': 'Failed to create job'}), 500

    # Remove opportunity now that it has been accepted
    supabase.table('tutoring_opportunities').delete().eq('id', opportunity_id).execute()

    return jsonify({'message': 'Job created', 'job': job_res.data[0]}), 201


@tutor_bp.route('/api/tutor/profile', methods=['GET'])
@require_auth
def tutor_profile():
    supabase = get_supabase_client()
    tutor_res = supabase.table('tutors').select('*, school:schools(name,domain)').eq('auth_id', request.user_id).single().execute()
    if not tutor_res.data:
        return jsonify({'error': 'Tutor not found'}), 404
    return jsonify({'tutor': tutor_res.data}), 200


@tutor_bp.route('/api/tutor/approvals', methods=['GET'])
@require_auth
def tutor_approvals():
    supabase = get_supabase_client()
    tutor_res = supabase.table('tutors').select('id').eq('auth_id', request.user_id).single().execute()
    if not tutor_res.data:
        return jsonify({'approved_subjects': [], 'approvals': []}), 200
    tutor_id = tutor_res.data['id']
    approvals = supabase.table('subject_approvals').select('subject_name, subject_type, subject_grade, status').eq('tutor_id', tutor_id).eq('status', 'approved').execute()
    triples = [
        {
            'subject_name': a.get('subject_name'),
            'subject_type': a.get('subject_type'),
            'subject_grade': a.get('subject_grade'),
        }
        for a in (approvals.data or [])
        if a.get('subject_name') and a.get('subject_type') and a.get('subject_grade')
    ]
    return jsonify({'approved_subjects': triples, 'approvals': approvals.data or []}), 200


@tutor_bp.route('/api/tutor/opportunities', methods=['GET'])
@require_auth
def list_open_opportunities():
    supabase = get_supabase_client()
    try:
        res = (
            supabase
            .table('tutoring_opportunities')
            .select('*, tutee:tutees(id, first_name, last_name, email, school_id)')
            .eq('status', 'open')
            .order('created_at')
            .execute()
        )
        return jsonify({'opportunities': res.data or []}), 200
    except Exception as e:
        return jsonify({'error': 'failed_to_list_opportunities', 'details': str(e)}), 500


@tutor_bp.route('/api/tutor/opportunities/<opportunity_id>/apply', methods=['POST'])
@require_auth
def apply_to_opportunity(opportunity_id: str):
    supabase = get_supabase_client()
    tutor_res = supabase.table('tutors').select('id').eq('auth_id', request.user_id).single().execute()
    if not tutor_res.data:
        return jsonify({'error': 'Tutor not found'}), 404
    tutor_id = tutor_res.data['id']

    # Verify subject approval first using embedded fields
    opp_res = supabase.table('tutoring_opportunities').select('subject_name, subject_type, subject_grade, tutee_id').eq('id', opportunity_id).single().execute()
    if not opp_res.data:
        return jsonify({'error': 'Opportunity not found'}), 404
    subj_name = opp_res.data.get('subject_name')
    subj_type = opp_res.data.get('subject_type')
    subj_grade = str(opp_res.data.get('subject_grade'))
    approval = (
        supabase.table('subject_approvals')
        .select('id')
        .eq('tutor_id', tutor_id)
        .eq('subject_name', subj_name)
        .eq('subject_type', subj_type)
        .eq('subject_grade', subj_grade)
        .single()
        .execute()
    )
    if not approval.data:
        return jsonify({'error': 'Not approved for this subject'}), 403

    # Create job and move to pending tutee scheduling; snapshot the opportunity
    # so we can surface details later even after deleting the opportunity row.
    opportunity_snapshot = opp_res.data
    job_ins = supabase.table('tutoring_jobs').insert({
        'opportunity_id': opportunity_id,
        'tutor_id': tutor_id,
        'tutee_id': opp_res.data.get('tutee_id'),
        'subject_name': subj_name,
        'subject_type': subj_type,
        'subject_grade': subj_grade,
        'opportunity_snapshot': opportunity_snapshot,
        'status': 'pending_tutee_scheduling'
    }).execute()
    if not job_ins.data:
        return jsonify({'error': 'Failed to create job'}), 500

    # Remove the opportunity since it's been accepted/applied
    supabase.table('tutoring_opportunities').delete().eq('id', opportunity_id).execute()
    return jsonify({'job': job_ins.data[0]}), 201


@tutor_bp.route('/api/tutor/jobs/<job_id>', methods=['GET'])
@require_auth
def get_job(job_id: str):
    """Get job details with opportunity for the authenticated tutor"""
    supabase = get_supabase_client()
    tutor_res = supabase.table('tutors').select('id').eq('auth_id', request.user_id).single().execute()
    if not tutor_res.data:
        return jsonify({'error': 'Tutor not found'}), 404
    tutor_id = tutor_res.data['id']

    job_res = supabase.table('tutoring_jobs').select('*').eq('id', job_id).eq('tutor_id', tutor_id).single().execute()
    if not job_res.data:
        return jsonify({'error': 'Job not found'}), 404
    job = job_res.data

    # Provide a synthetic 'tutoring_opportunity' object for UI compatibility,
    # sourced from opportunity_snapshot (if present).
    if job.get('opportunity_snapshot'):
        job['tutoring_opportunity'] = job['opportunity_snapshot']
    else:
        job['tutoring_opportunity'] = None

    # Attach basic tutee info (email, name) for downstream uses like email
    try:
        if job.get('tutee_id'):
            tutee_res = supabase.table('tutees').select('id, email, first_name, last_name').eq('id', job['tutee_id']).single().execute()
            if tutee_res.data:
                job['tutee'] = tutee_res.data
    except Exception:
        pass
    return jsonify({'job': job}), 200


@tutor_bp.route('/api/tutor/jobs/<job_id>/schedule', methods=['POST'])
@require_auth
def schedule_job(job_id: str):
    """Finalize a single-session schedule.

    Expects payload: { scheduled_time: ISO8601 string, duration_minutes: 60..180 }
    Only one session is allowed. Will set status to 'scheduled'.
    """
    supabase = get_supabase_client()
    payload = request.get_json() or {}
    scheduled_time = payload.get('scheduled_time')
    duration_minutes = payload.get('duration_minutes')
    # Optional explicit local date/time fields from frontend to avoid timezone drift
    explicit_date_key = payload.get('date') or payload.get('date_key')
    explicit_start_hhmm = payload.get('start_time') or payload.get('start_hhmm')
    if not scheduled_time:
        return jsonify({'error': 'scheduled_time is required'}), 400
    try:
        # Basic ISO validation
        from datetime import datetime
        datetime.fromisoformat(scheduled_time.replace('Z', '+00:00'))
    except Exception:
        return jsonify({'error': 'scheduled_time must be ISO8601'}), 400
    try:
        duration_minutes = int(duration_minutes)
    except Exception:
        return jsonify({'error': 'duration_minutes must be an integer'}), 400
    if duration_minutes < 60 or duration_minutes > 180:
        return jsonify({'error': 'duration_minutes must be between 60 and 180'}), 400

    tutor_res = supabase.table('tutors').select('id').eq('auth_id', request.user_id).single().execute()
    if not tutor_res.data:
        return jsonify({'error': 'Tutor not found'}), 404
    tutor_id = tutor_res.data['id']

    # Ensure job belongs to tutor
    job_res = supabase.table('tutoring_jobs').select('id, opportunity_id').eq('id', job_id).eq('tutor_id', tutor_id).single().execute()
    if not job_res.data:
        return jsonify({'error': 'Job not found'}), 404
    job = job_res.data

    # Validate the chosen time fits within tutee_availability if provided
    # Get job with tutee_availability
    job_detail = supabase.table('tutoring_jobs').select('tutee_availability, desired_duration_minutes').eq('id', job_id).single().execute()
    if job_detail.data:
        # Enforce exact duration match with tutee's desired duration when provided
        desired = job_detail.data.get('desired_duration_minutes')
        if isinstance(desired, int) and desired in [60,90,120,150,180]:
            if duration_minutes != desired:
                return jsonify({'error': 'duration_mismatch_with_tutee_preference'}), 400
    if job_detail.data and isinstance(job_detail.data.get('tutee_availability'), dict):
        try:
            from datetime import datetime
            availability = job_detail.data['tutee_availability']
            # Prefer explicit local date/time from client to avoid timezone conversion issues
            if isinstance(explicit_date_key, str) and isinstance(explicit_start_hhmm, str):
                date_key = explicit_date_key
                start_hhmm = explicit_start_hhmm
            else:
                chosen = datetime.fromisoformat(scheduled_time.replace('Z', '+00:00'))
                date_key = chosen.date().isoformat()
                start_hhmm = chosen.strftime('%H:%M')

            ranges = availability.get(date_key)
            # Only enforce if availability exists for this exact date
            if isinstance(ranges, list) and len(ranges) > 0:
                # Ensure the entire duration fits within one allowed range on that date
                def fits(r: str) -> bool:
                    parts = r.split('-')
                    if len(parts) != 2:
                        return False
                    s, e = parts
                    try:
                        sh, sm = map(int, start_hhmm.split(':'))
                    except Exception:
                        return False
                    eh = sh
                    em = sm + int(duration_minutes)
                    eh += em // 60
                    em = em % 60
                    end_hhmm = f"{eh:02d}:{em:02d}"
                    return s <= start_hhmm and end_hhmm <= e
                if not any(fits(r) for r in ranges):
                    return jsonify({'error': 'chosen_time_not_in_tutee_availability'}), 400
        except Exception:
            pass

    updates = {'status': 'scheduled', 'scheduled_time': scheduled_time, 'duration_minutes': duration_minutes}
    upd = supabase.table('tutoring_jobs').update(updates).eq('id', job_id).execute()
    if not upd.data:
        return jsonify({'error': 'Failed to update job'}), 500
    return jsonify({'message': 'Scheduled', 'job': upd.data[0]}), 200


@tutor_bp.route('/api/tutor/past-jobs', methods=['GET'])
@require_auth
def list_past_jobs_for_tutor():
    """Return past (verified) jobs for the authenticated tutor from past_jobs."""
    supabase = get_supabase_client()
    tutor_res = supabase.table('tutors').select('id').eq('auth_id', request.user_id).single().execute()
    if not tutor_res.data:
        return jsonify({'jobs': []}), 200
    tutor_id = tutor_res.data['id']
    res = supabase.table('past_jobs').select('*').eq('tutor_id', tutor_id).order('created_at', desc=True).execute()
    return jsonify({'jobs': res.data or []}), 200

