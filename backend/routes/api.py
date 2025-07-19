from flask import Blueprint, jsonify, request, current_app
import logging
from utils.db import get_db_manager
from utils.forms import GoogleFormsHandler
from utils.email_service import get_email_service
from utils.storage import get_storage_service
from models.admin_invitation import AdminInvitation

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

@api_bp.route('/webhook/google-forms', methods=['POST'])
def google_forms_webhook():
    """Google Forms webhook endpoint"""
    # Verify webhook signature
    if not GoogleFormsHandler.verify_webhook_signature(request):
        logger.warning("Invalid webhook signature")
        return jsonify({"error": "Invalid signature"}), 401
    
    # Parse form data
    form_data = GoogleFormsHandler.parse_form_data(request.json)
    if not form_data:
        logger.error("Failed to parse form data")
        return jsonify({"error": "Invalid form data"}), 400
    
    # Log the actual form data for debugging
    logger.info(f"Received form data: {form_data}")
    logger.info(f"Form responses: {form_data.get('responses', {})}")
    
    # Extract tutoring request
    tutoring_request = GoogleFormsHandler.extract_tutoring_request(form_data)
    if not tutoring_request:
        logger.error("Failed to extract tutoring request")
        logger.error(f"Available form fields: {list(form_data.get('responses', {}).keys())}")
        return jsonify({"error": "Invalid tutoring request"}), 400
    
    # Store tutoring opportunity in database
    try:
        db = get_db_manager()
        opportunity = db.insert_record("tutoring_opportunities", {
            "school": tutoring_request["school"],
            "tutee_first_name": tutoring_request["tutee_first_name"],
            "tutee_last_name": tutoring_request["tutee_last_name"],
            "tutee_pronouns": tutoring_request["tutee_pronouns"],
            "tutee_email": tutoring_request["tutee_email"],
            "grade_level": tutoring_request["grade_level"],
            "subject": tutoring_request["subject"],
            "specific_topic": tutoring_request["specific_topic"],
            "course_level": tutoring_request["course_level"],
            "urgency_level": tutoring_request["urgency_level"],
            "session_location": tutoring_request["session_location"],
            "availability_date": tutoring_request["availability_date"],
            "availability_start_time": tutoring_request["availability_start_time"],
            "availability_end_time": tutoring_request["availability_end_time"],
            "availability_formatted": tutoring_request["availability_formatted"],
            "status": "open",
            "priority": "normal"
        })
        
        logger.info(f"Created tutoring opportunity: {opportunity}")
        return jsonify({"success": True, "opportunity_id": opportunity.get("id")}), 201
    except Exception as e:
        logger.error(f"Error creating tutoring opportunity: {str(e)}")
        return jsonify({"error": "Failed to create tutoring opportunity"}), 500

@api_bp.route('/storage/upload-url', methods=['POST'])
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
def services_status():
    """Check status of external services"""
    services = {
        "database": {"status": "unknown"},
        "email": {"status": "unknown"},
        "storage": {"status": "unknown"},
        "forms": {"status": "unknown"}
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
    
    # Google Forms webhook is always available
    services["forms"]["status"] = "operational"
    
    return jsonify(services)

@api_bp.route('/admin/invitations', methods=['POST'])
def create_admin_invitation():
    """Create a new admin invitation (superadmin only)"""
    try:
        data = request.get_json()
        
        # Validate required fields
        if not all(key in data for key in ['email', 'role']):
            return jsonify({"error": "Email and role are required"}), 400
        
        # Create invitation
        invitation = AdminInvitation.create_invitation(
            email=data['email'],
            role=data['role'],
            invited_by=data.get('invited_by'),  # This should come from auth
            school_id=data.get('school_id')
        )
        
        # Send invitation email
        email_service = get_email_service()
        invitation_url = f"{request.host_url}auth/admin/register?token={invitation.invitation_token}"
        
        email_content = f"""
        <html>
        <body>
            <h2>Admin Invitation</h2>
            <p>You have been invited to become a {invitation.role} for the Tutoring Automation System.</p>
            <p>Click the link below to complete your registration:</p>
            <p><a href="{invitation_url}">Complete Registration</a></p>
            <p>This invitation will expire in 24 hours.</p>
        </body>
        </html>
        """
        
        email_service.send_email(
            to_email=invitation.email,
            subject="Admin Invitation - Tutoring Automation System",
            body_html=email_content
        )
        
        return jsonify({
            "success": True,
            "invitation_id": invitation.id,
            "message": "Invitation sent successfully"
        }), 201
        
    except Exception as e:
        logger.error(f"Error creating admin invitation: {str(e)}")
        return jsonify({"error": "Failed to create invitation"}), 500

@api_bp.route('/admin/invitations/<invitation_id>', methods=['DELETE'])
def cancel_admin_invitation(invitation_id):
    """Cancel an admin invitation"""
    try:
        invitation = AdminInvitation.get_by_id(invitation_id)
        if not invitation:
            return jsonify({"error": "Invitation not found"}), 404
        
        invitation.cancel_invitation()
        
        return jsonify({
            "success": True,
            "message": "Invitation cancelled successfully"
        }), 200
        
    except Exception as e:
        logger.error(f"Error cancelling admin invitation: {str(e)}")
        return jsonify({"error": "Failed to cancel invitation"}), 500

@api_bp.route('/admin/invitations/verify/<token>', methods=['GET'])
def verify_invitation_token(token):
    """Verify an invitation token"""
    try:
        invitation = AdminInvitation.get_by_token(token)
        
        if not invitation:
            return jsonify({"error": "Invalid invitation token"}), 404
        
        if not invitation.is_valid():
            return jsonify({"error": "Invitation has expired or been used"}), 400
        
        return jsonify({
            "valid": True,
            "email": invitation.email,
            "role": invitation.role,
            "school_id": invitation.school_id
        }), 200
        
    except Exception as e:
        logger.error(f"Error verifying invitation token: {str(e)}")
        return jsonify({"error": "Failed to verify invitation"}), 500