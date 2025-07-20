from flask import Blueprint, request, jsonify
import logging
from utils.email_service import get_email_service
from utils.auth import require_auth
from utils.db import get_db_manager

# Configure logging
logger = logging.getLogger(__name__)

# Create blueprint
email_notifications_bp = Blueprint('email_notifications', __name__)

@email_notifications_bp.route('/api/email/test', methods=['POST'])
@require_auth
def test_email():
    """
    Test endpoint for sending emails
    """
    data = request.json
    recipient = data.get('recipient')
    
    if not recipient:
        return jsonify({'error': 'Recipient email is required'}), 400
    
    email_service = get_email_service()
    success = email_service.send_email(
        to_email=recipient,
        subject="Test Email from Tutoring Automation System",
        body_html="""
        <html>
        <body>
            <h1>Test Email</h1>
            <p>This is a test email from the Tutoring Automation System.</p>
            <p>If you received this email, the email service is working correctly!</p>
        </body>
        </html>
        """,
        body_text="""
        Test Email
        
        This is a test email from the Tutoring Automation System.
        
        If you received this email, the email service is working correctly!
        """
    )
    
    if success:
        return jsonify({'message': 'Test email sent successfully'}), 200
    else:
        return jsonify({'error': 'Failed to send test email'}), 500

@email_notifications_bp.route('/api/email/session-confirmation', methods=['POST'])
@require_auth
def send_session_confirmation():
    """
    Send session confirmation emails to tutor and tutee
    """
    data = request.json
    
    # Validate required fields
    required_fields = ['tutor_email', 'tutee_email', 'session_details']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400
    
    # Extract data
    tutor_email = data['tutor_email']
    tutee_email = data['tutee_email']
    session_details = data['session_details']
    
    # Validate session details
    required_session_fields = ['subject', 'date', 'time', 'location', 'tutor_name', 'tutee_name']
    for field in required_session_fields:
        if field not in session_details:
            return jsonify({'error': f'Missing required session detail: {field}'}), 400
    
    # Send confirmation emails
    email_service = get_email_service()
    success = email_service.send_session_confirmation(
        tutor_email=tutor_email,
        tutee_email=tutee_email,
        session_details=session_details
    )
    
    if success:
        # Log the communication in the database
        try:
            db = get_db_manager()
            job_id = data.get('job_id')
            if job_id:
                db.insert_record("communications", {
                    "job_id": job_id,
                    "type": "confirmation",
                    "recipients": [tutor_email, tutee_email],
                    "content": f"Session confirmation for {session_details['subject']} on {session_details['date']} at {session_details['time']}"
                })
        except Exception as e:
            logger.error(f"Failed to log communication: {str(e)}")
        
        logger.info(f"Session confirmation emails sent to {tutor_email} and {tutee_email}")
        return jsonify({'message': 'Session confirmation emails sent successfully'}), 200
    else:
        return jsonify({'error': 'Failed to send session confirmation emails'}), 500

@email_notifications_bp.route('/api/email/job-assignment', methods=['POST'])
@require_auth
def send_job_assignment_notification():
    """
    Send job assignment notification to tutor
    """
    data = request.json
    
    # Validate required fields
    required_fields = ['tutor_email', 'tutor_name', 'job_details']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400
    
    # Extract data
    tutor_email = data['tutor_email']
    tutor_name = data['tutor_name']
    job_details = data['job_details']
    
    # Validate job details
    required_job_fields = ['subject', 'tutee_name', 'grade_level', 'location']
    for field in required_job_fields:
        if field not in job_details:
            return jsonify({'error': f'Missing required job detail: {field}'}), 400
    
    # Create email content
    subject = f"New Tutoring Assignment: {job_details['subject']}"
    
    html_body = f"""
    <html>
    <body>
        <h2>New Tutoring Assignment</h2>
        <p>Hello {tutor_name},</p>
        <p>Congratulations! You have been assigned a new tutoring opportunity:</p>
        <ul>
            <li><strong>Subject:</strong> {job_details['subject']}</li>
            <li><strong>Student:</strong> {job_details['tutee_name']}</li>
            <li><strong>Grade Level:</strong> {job_details['grade_level']}</li>
            <li><strong>Location:</strong> {job_details['location']}</li>
        </ul>
        <p>Please log into the tutoring platform to schedule your session with the student.</p>
        <p>Remember to record your session and upload it to receive volunteer hours credit.</p>
        <p>Thank you for volunteering!</p>
    </body>
    </html>
    """
    
    text_body = f"""
    New Tutoring Assignment
    
    Hello {tutor_name},
    
    Congratulations! You have been assigned a new tutoring opportunity:
    
    Subject: {job_details['subject']}
    Student: {job_details['tutee_name']}
    Grade Level: {job_details['grade_level']}
    Location: {job_details['location']}
    
    Please log into the tutoring platform to schedule your session with the student.
    
    Remember to record your session and upload it to receive volunteer hours credit.
    
    Thank you for volunteering!
    """
    
    # Send email
    email_service = get_email_service()
    success = email_service.send_email(tutor_email, subject, html_body, text_body)
    
    if success:
        # Log the communication
        try:
            db = get_db_manager()
            job_id = data.get('job_id')
            if job_id:
                db.insert_record("communications", {
                    "job_id": job_id,
                    "type": "assignment",
                    "recipients": [tutor_email],
                    "content": f"Job assignment notification for {job_details['subject']}"
                })
        except Exception as e:
            logger.error(f"Failed to log communication: {str(e)}")
        
        logger.info(f"Job assignment notification sent to {tutor_email}")
        return jsonify({'message': 'Job assignment notification sent successfully'}), 200
    else:
        return jsonify({'error': 'Failed to send job assignment notification'}), 500

@email_notifications_bp.route('/api/email/cancellation', methods=['POST'])
@require_auth
def send_cancellation_notification():
    """
    Send cancellation notification emails to tutor and tutee
    """
    data = request.json
    
    # Validate required fields
    required_fields = ['tutor_email', 'tutee_email', 'cancellation_details']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400
    
    # Extract data
    tutor_email = data['tutor_email']
    tutee_email = data['tutee_email']
    cancellation_details = data['cancellation_details']
    
    # Validate cancellation details
    required_cancellation_fields = ['subject', 'tutor_name', 'tutee_name', 'reason']
    for field in required_cancellation_fields:
        if field not in cancellation_details:
            return jsonify({'error': f'Missing required cancellation detail: {field}'}), 400
    
    subject = f"Tutoring Session Cancelled: {cancellation_details['subject']}"
    
    # Create email content for tutor
    tutor_html = f"""
    <html>
    <body>
        <h2>Tutoring Session Cancelled</h2>
        <p>Hello {cancellation_details['tutor_name']},</p>
        <p>Your tutoring session has been cancelled:</p>
        <ul>
            <li><strong>Subject:</strong> {cancellation_details['subject']}</li>
            <li><strong>Student:</strong> {cancellation_details['tutee_name']}</li>
            <li><strong>Reason:</strong> {cancellation_details['reason']}</li>
        </ul>
        <p>The opportunity has been returned to the tutoring board for other tutors to apply.</p>
        <p>Thank you for your understanding.</p>
    </body>
    </html>
    """
    
    # Create email content for tutee
    tutee_html = f"""
    <html>
    <body>
        <h2>Tutoring Session Cancelled</h2>
        <p>Hello {cancellation_details['tutee_name']},</p>
        <p>Unfortunately, your tutoring session has been cancelled:</p>
        <ul>
            <li><strong>Subject:</strong> {cancellation_details['subject']}</li>
            <li><strong>Tutor:</strong> {cancellation_details['tutor_name']}</li>
            <li><strong>Reason:</strong> {cancellation_details['reason']}</li>
        </ul>
        <p>Don't worry - your request has been returned to our system and another qualified tutor will be able to help you soon.</p>
        <p>You will receive a new confirmation email once a tutor is assigned.</p>
        <p>We apologize for any inconvenience.</p>
    </body>
    </html>
    """
    
    # Send emails
    email_service = get_email_service()
    tutor_success = email_service.send_email(tutor_email, subject, tutor_html)
    tutee_success = email_service.send_email(tutee_email, subject, tutee_html)
    
    success = tutor_success and tutee_success
    
    if success:
        # Log the communication
        try:
            db = get_db_manager()
            job_id = data.get('job_id')
            if job_id:
                db.insert_record("communications", {
                    "job_id": job_id,
                    "type": "cancellation",
                    "recipients": [tutor_email, tutee_email],
                    "content": f"Cancellation notification for {cancellation_details['subject']} - {cancellation_details['reason']}"
                })
        except Exception as e:
            logger.error(f"Failed to log communication: {str(e)}")
        
        logger.info(f"Cancellation notifications sent to {tutor_email} and {tutee_email}")
        return jsonify({'message': 'Cancellation notifications sent successfully'}), 200
    else:
        return jsonify({'error': 'Failed to send cancellation notifications'}), 500

@email_notifications_bp.route('/api/email/reminder', methods=['POST'])
@require_auth
def send_session_reminder():
    """
    Send session reminder emails to tutor and tutee
    """
    data = request.json
    
    # Validate required fields
    required_fields = ['tutor_email', 'tutee_email', 'session_details']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400
    
    # Extract data
    tutor_email = data['tutor_email']
    tutee_email = data['tutee_email']
    session_details = data['session_details']
    
    # Validate session details
    required_session_fields = ['subject', 'date', 'time', 'location', 'tutor_name', 'tutee_name']
    for field in required_session_fields:
        if field not in session_details:
            return jsonify({'error': f'Missing required session detail: {field}'}), 400
    
    subject = f"Reminder: Tutoring Session Tomorrow - {session_details['subject']}"
    
    # Create email content for tutor
    tutor_html = f"""
    <html>
    <body>
        <h2>Session Reminder</h2>
        <p>Hello {session_details['tutor_name']},</p>
        <p>This is a friendly reminder about your tutoring session tomorrow:</p>
        <ul>
            <li><strong>Subject:</strong> {session_details['subject']}</li>
            <li><strong>Date:</strong> {session_details['date']}</li>
            <li><strong>Time:</strong> {session_details['time']}</li>
            <li><strong>Location:</strong> {session_details['location']}</li>
            <li><strong>Student:</strong> {session_details['tutee_name']}</li>
        </ul>
        <p>Please remember to:</p>
        <ul>
            <li>Arrive on time and prepared</li>
            <li>Record your session for volunteer hours credit</li>
            <li>Contact the student if you need to make any changes</li>
        </ul>
        <p>Thank you for volunteering!</p>
    </body>
    </html>
    """
    
    # Create email content for tutee
    tutee_html = f"""
    <html>
    <body>
        <h2>Session Reminder</h2>
        <p>Hello {session_details['tutee_name']},</p>
        <p>This is a friendly reminder about your tutoring session tomorrow:</p>
        <ul>
            <li><strong>Subject:</strong> {session_details['subject']}</li>
            <li><strong>Date:</strong> {session_details['date']}</li>
            <li><strong>Time:</strong> {session_details['time']}</li>
            <li><strong>Location:</strong> {session_details['location']}</li>
            <li><strong>Tutor:</strong> {session_details['tutor_name']}</li>
        </ul>
        <p>Please remember to:</p>
        <ul>
            <li>Arrive on time and bring any materials you need</li>
            <li>Come prepared with specific questions or topics</li>
            <li>Contact your tutor if you need to make any changes</li>
        </ul>
        <p>We hope you have a productive session!</p>
    </body>
    </html>
    """
    
    # Send emails
    email_service = get_email_service()
    tutor_success = email_service.send_email(tutor_email, subject, tutor_html)
    tutee_success = email_service.send_email(tutee_email, subject, tutee_html)
    
    success = tutor_success and tutee_success
    
    if success:
        # Log the communication
        try:
            db = get_db_manager()
            job_id = data.get('job_id')
            if job_id:
                db.insert_record("communications", {
                    "job_id": job_id,
                    "type": "reminder",
                    "recipients": [tutor_email, tutee_email],
                    "content": f"Session reminder for {session_details['subject']} on {session_details['date']}"
                })
        except Exception as e:
            logger.error(f"Failed to log communication: {str(e)}")
        
        logger.info(f"Session reminders sent to {tutor_email} and {tutee_email}")
        return jsonify({'message': 'Session reminders sent successfully'}), 200
    else:
        return jsonify({'error': 'Failed to send session reminders'}), 500

@email_notifications_bp.route('/api/email/approval-status', methods=['POST'])
@require_auth
def send_approval_status_notification():
    """
    Send subject approval status notification to tutor
    """
    data = request.json
    
    # Validate required fields
    required_fields = ['tutor_email', 'tutor_name', 'approval_details']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400
    
    # Extract data
    tutor_email = data['tutor_email']
    tutor_name = data['tutor_name']
    approval_details = data['approval_details']
    
    # Validate approval details
    required_approval_fields = ['subject', 'status', 'admin_name']
    for field in required_approval_fields:
        if field not in approval_details:
            return jsonify({'error': f'Missing required approval detail: {field}'}), 400
    
    status = approval_details['status']
    subject_name = approval_details['subject']
    admin_name = approval_details['admin_name']
    
    if status == 'approved':
        subject = f"Subject Approval: You're now approved for {subject_name}"
        html_body = f"""
        <html>
        <body>
            <h2>Subject Approval Notification</h2>
            <p>Hello {tutor_name},</p>
            <p>Great news! You have been approved to tutor <strong>{subject_name}</strong>.</p>
            <p>You can now apply for tutoring opportunities in this subject area.</p>
            <p>Approved by: {admin_name}</p>
            <p>Log into the tutoring platform to start browsing available opportunities!</p>
            <p>Thank you for volunteering!</p>
        </body>
        </html>
        """
    else:
        subject = f"Subject Approval Update: {subject_name}"
        html_body = f"""
        <html>
        <body>
            <h2>Subject Approval Update</h2>
            <p>Hello {tutor_name},</p>
            <p>We have reviewed your request to tutor <strong>{subject_name}</strong>.</p>
            <p>Status: <strong>{status.title()}</strong></p>
            <p>Reviewed by: {admin_name}</p>
            <p>If you have questions about this decision, please contact your school administrator.</p>
            <p>Thank you for your interest in tutoring!</p>
        </body>
        </html>
        """
    
    # Send email
    email_service = get_email_service()
    success = email_service.send_email(tutor_email, subject, html_body)
    
    if success:
        logger.info(f"Approval status notification sent to {tutor_email} for {subject_name}: {status}")
        return jsonify({'message': 'Approval status notification sent successfully'}), 200
    else:
        return jsonify({'error': 'Failed to send approval status notification'}), 500

@email_notifications_bp.route('/api/email/send-reminders', methods=['POST'])
@require_auth
def trigger_session_reminders():
    """
    Manually trigger session reminders for tomorrow's sessions
    This endpoint can be called by a cron job or for testing
    """
    try:
        from utils.reminder_service import send_session_reminders
        
        reminder_count = send_session_reminders()
        
        return jsonify({
            'message': f'Successfully sent {reminder_count} session reminders',
            'count': reminder_count
        }), 200
        
    except Exception as e:
        logger.error(f"Error triggering session reminders: {str(e)}")
        return jsonify({'error': 'Failed to send session reminders'}), 500

@email_notifications_bp.route('/api/email/debug', methods=['GET'])
def debug_email_config():
    """
    Debug endpoint to check email service configuration
    """
    import os
    
    config_status = {
        'EMAIL_SERVICE': os.environ.get('EMAIL_SERVICE', 'not_set'),
        'EMAIL_FROM': 'set' if os.environ.get('EMAIL_FROM') else 'not_set',
        'BREVO_API_KEY': 'set' if os.environ.get('BREVO_API_KEY') else 'not_set',
        'EMAIL_FROM_NAME': os.environ.get('EMAIL_FROM_NAME', 'not_set'),
        'EMAIL_HOST': 'set' if os.environ.get('EMAIL_HOST') else 'not_set',
        'EMAIL_USERNAME': 'set' if os.environ.get('EMAIL_USERNAME') else 'not_set',
        'EMAIL_PASSWORD': 'set' if os.environ.get('EMAIL_PASSWORD') else 'not_set',
    }
    
    try:
        email_service = get_email_service()
        service_type = type(email_service).__name__
        config_status['active_service'] = service_type
    except Exception as e:
        config_status['active_service'] = f'error: {str(e)}'
    
    return jsonify({
        'status': 'Email configuration debug info',
        'config': config_status
    }), 200