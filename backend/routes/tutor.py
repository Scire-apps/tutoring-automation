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

    # Jobs belonging to this tutor (embed opportunity for UI convenience)
    jobs = (
        supabase
        .table('tutoring_jobs')
        .select('*, tutoring_opportunity:tutoring_opportunities(*)')
        .eq('tutor_id', tutor['id'])
        .order('created_at', desc=True)
        .execute()
    )

    return jsonify({
        'tutor': tutor,
        'approved_subject_ids': approved_subject_ids,
        'opportunities': opps.data or [],
        'jobs': jobs.data or []
    })


@tutor_bp.route('/api/tutor/opportunities/<opportunity_id>/accept', methods=['POST'])
@require_auth
def accept_opportunity(opportunity_id: str):
    """Tutor accepts an opportunity; creates a job with finalized schedule"""
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

    # Expect finalized schedule in body
    data = request.get_json() or {}
    finalized_schedule = data.get('finalized_schedule')  # array of {date, time}
    if not finalized_schedule or not isinstance(finalized_schedule, list):
        return jsonify({'error': 'finalized_schedule (list) is required'}), 400

    # Create job
    job_insert = {
        'opportunity_id': opp['id'],
        'tutor_id': tutor['id'],
        'tutee_id': opp.get('tutee_id'),
        'subject_name': subj_name,
        'subject_type': subj_type,
        'subject_grade': str(subj_grade),
        'finalized_schedule': finalized_schedule,
        'status': 'scheduled'
    }

    job_res = supabase.table('tutoring_jobs').insert(job_insert).execute()
    if not job_res.data:
        return jsonify({'error': 'Failed to create job'}), 500

    # Mark opportunity as assigned
    supabase.table('tutoring_opportunities').update({'status': 'assigned'}).eq('id', opportunity_id).execute()

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

    # create job with scheduled status minimal
    job_ins = supabase.table('tutoring_jobs').insert({
        'opportunity_id': opportunity_id,
        'tutor_id': tutor_id,
        'tutee_id': opp_res.data.get('tutee_id'),
        'subject_name': subj_name,
        'subject_type': subj_type,
        'subject_grade': subj_grade,
        'status': 'scheduled'
    }).execute()
    if not job_ins.data:
        return jsonify({'error': 'Failed to create job'}), 500

    # mark opportunity assigned
    supabase.table('tutoring_opportunities').update({'status': 'assigned'}).eq('id', opportunity_id).execute()
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

    # Expand opportunity (no subjects relation now)
    opp_res = supabase.table('tutoring_opportunities').select('*').eq('id', job['opportunity_id']).single().execute()
    opportunity = opp_res.data if opp_res.data else None
    job['tutoring_opportunity'] = opportunity
    return jsonify({'job': job}), 200


@tutor_bp.route('/api/tutor/jobs/<job_id>/schedule', methods=['POST'])
@require_auth
def schedule_job(job_id: str):
    """Set a job schedule. Supports either single scheduled_time (ISO) or finalized_schedule (weekly map)."""
    supabase = get_supabase_client()
    payload = request.get_json() or {}
    scheduled_time = payload.get('scheduled_time')
    finalized_schedule = payload.get('finalized_schedule')  # expected map like {"Mon":["17:00-19:00"], ...}
    if not scheduled_time and not finalized_schedule:
        return jsonify({'error': 'scheduled_time (ISO) or finalized_schedule (weekly map) is required'}), 400

    tutor_res = supabase.table('tutors').select('id').eq('auth_id', request.user_id).single().execute()
    if not tutor_res.data:
        return jsonify({'error': 'Tutor not found'}), 404
    tutor_id = tutor_res.data['id']

    # Ensure job belongs to tutor
    job_res = supabase.table('tutoring_jobs').select('id, opportunity_id').eq('id', job_id).eq('tutor_id', tutor_id).single().execute()
    if not job_res.data:
        return jsonify({'error': 'Job not found'}), 404
    job = job_res.data

    # If finalized_schedule provided, optionally validate count vs sessions_per_week on opportunity
    updates = {'status': 'scheduled'}
    if scheduled_time:
        updates['scheduled_time'] = scheduled_time
    if finalized_schedule:
        # Basic validation: ensure it's an object of arrays of HH:MM-HH:MM
        try:
            if not isinstance(finalized_schedule, dict):
                raise ValueError('finalized_schedule must be an object of day->ranges')
            # Count total chosen blocks
            total_blocks = 0
            for day, ranges in finalized_schedule.items():
                if not isinstance(ranges, list):
                    raise ValueError('Each day must map to a list of ranges')
                total_blocks += len(ranges)
            # Fetch sessions_per_week to give nicer errors
            opp_res = supabase.table('tutoring_opportunities').select('sessions_per_week').eq('id', job.get('opportunity_id')).single().execute()
            if opp_res.data and isinstance(total_blocks, int):
                expected = opp_res.data.get('sessions_per_week')
                if isinstance(expected, int) and expected > 0 and total_blocks != expected:
                    return jsonify({'error': 'invalid_finalized_schedule', 'details': f'Expected {expected} weekly sessions, got {total_blocks}'}), 400
        except Exception as e:
            return jsonify({'error': 'invalid_finalized_schedule', 'details': str(e)}), 400
        updates['finalized_schedule'] = finalized_schedule

    upd = supabase.table('tutoring_jobs').update(updates).eq('id', job_id).execute()
    if not upd.data:
        return jsonify({'error': 'Failed to update job'}), 500
    return jsonify({'message': 'Scheduled', 'job': upd.data[0]}), 200


