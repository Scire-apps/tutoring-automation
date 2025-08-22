from flask import Blueprint, jsonify, request, current_app
import os
import logging
from utils.db import get_db_manager
from utils.db import get_supabase_client
from utils.auth import require_auth
from utils.email_service import get_email_service
from utils.storage import get_storage_service

# Configure logging
logger = logging.getLogger(__name__)

api_bp = Blueprint('api', __name__, url_prefix='/api')

@api_bp.route('/status')
def status():
    """API status endpoint"""
    return jsonify({
        "status": "operational",
        "version": "1.0.0"
    })

@api_bp.route('/storage/upload-url', methods=['POST'])
@require_auth
def get_upload_url():
    """Get a pre-signed URL for file upload"""
    # This endpoint would typically require authentication
    # For now, we'll just return a mock response
    return jsonify({
        "upload_url": "/api/storage/upload",
        "fields": {},
        "expires_in": 3600
    })

@api_bp.route('/services/status', methods=['GET'])
@require_auth
def services_status():
    """Check status of external services"""
    services = {
        "database": {"status": "unknown"},
        "email": {"status": "unknown"},
        "storage": {"status": "unknown"}
    }
    
    # Check database connection
    try:
        db = get_db_manager()
        db.client.table("_dummy").select("*").limit(1).execute()
        services["database"]["status"] = "operational"
    except Exception as e:
        services["database"]["status"] = "error"
        services["database"]["message"] = str(e)
    
    # Check email service configuration
    email_service = get_email_service()
    if all([email_service.host, email_service.username, email_service.password, email_service.from_email]):
        services["email"]["status"] = "configured"
    else:
        services["email"]["status"] = "not_configured"
    
    # Check storage service configuration
    storage_service = get_storage_service()
    if storage_service.provider == "supabase":
        services["storage"]["status"] = "configured"
    else:
        services["storage"]["status"] = "not_configured"
    
    return jsonify(services)


# Subjects endpoint removed: subjects table no longer used (embedded fields)


@api_bp.route('/public/schools', methods=['GET'])
def list_schools_public():
    """Public list of schools for registration forms"""
    supabase = get_supabase_client()
    result = supabase.table('schools').select('id, name, domain').order('name').execute()
    resp = jsonify({'schools': result.data or []})
    # Ensure CORS headers are present even if CORS extension misses preflight
    origin = request.headers.get('Origin')
    if origin:
        resp.headers['Access-Control-Allow-Origin'] = origin
        resp.headers['Vary'] = 'Origin'
        resp.headers['Access-Control-Allow-Credentials'] = 'true'
    return resp


@api_bp.route('/public/subjects', methods=['GET'])
def list_subjects_public():
    """Public list of subjects loaded from subjects.txt; types/grades remain hardcoded."""
    try:
        names = []
        try:
            subjects_file_path = os.path.abspath(os.path.join(current_app.root_path, '..', 'subjects.txt'))
            if os.path.exists(subjects_file_path):
                with open(subjects_file_path, 'r') as f:
                    raw = f.read()
                    if ',' in raw:
                        names = [s.strip() for s in raw.split(',') if s.strip()]
                    else:
                        names = [s.strip() for s in raw.splitlines() if s.strip()]
            else:
                names = ['math','english','history']
        except Exception:
            names = ['math','english','history']
        # Capitalize for display
        subjects = [{'name': (n[0].upper() + n[1:]) if n else n} for n in names]
        return jsonify({
            'subjects': subjects,
            'types': ['Academic','ALP','IB'],
            'grades': ['9','10','11','12']
        })
    except Exception as e:
        return jsonify({'subjects': [], 'types': ['Academic','ALP','IB'], 'grades': ['9','10','11','12']}), 200
