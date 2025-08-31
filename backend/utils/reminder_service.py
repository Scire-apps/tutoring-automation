"""
Reminder service for sending session reminders
This can be called by a scheduled job or cron task
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from utils.db import DatabaseManager
from utils.email_service import get_email_service

# Configure logging
logger = logging.getLogger(__name__)

def send_session_reminders(user_jwt: Optional[str] = None):
    """
    Send reminder emails for sessions scheduled for tomorrow
    This function should be called daily (e.g., via cron job)
    """
    try:
        db = DatabaseManager(user_jwt=user_jwt)
        email_service = get_email_service()
        
        # Calculate tomorrow's date range
        tomorrow = datetime.now() + timedelta(days=1)
        tomorrow_start = tomorrow.replace(hour=0, minute=0, second=0, microsecond=0)
        tomorrow_end = tomorrow.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        # Get all scheduled sessions for tomorrow
        sessions_result = (
            db.client
            .table('tutoring_jobs')
            .select('*')
            .eq('status', 'scheduled')
            .gte('scheduled_time', tomorrow_start.isoformat())
            .lte('scheduled_time', tomorrow_end.isoformat())
            .execute()
        )
        
        if not sessions_result.data:
            logger.info("No sessions scheduled for tomorrow")
            return
        
        reminder_count = 0
        
        for session in sessions_result.data:
            try:
                # Extract session details
                tutor = {}
                opportunity = {}
                # Best-effort fetch related entities under RLS
                try:
                    trow = db.client.table('tutors').select('first_name,last_name,email').eq('id', session.get('tutor_id')).single().execute()
                    tutor = trow.data or {}
                except Exception:
                    tutor = {}
                try:
                    # We snapshot some details on the job; if not present, leave blank
                    if isinstance(session.get('opportunity_snapshot'), dict):
                        opportunity = session.get('opportunity_snapshot') or {}
                except Exception:
                    opportunity = {}
                scheduled_time = datetime.fromisoformat(session['scheduled_time'].replace('Z', '+00:00'))
                
                # Convert UTC time to local time for proper date formatting
                local_time = scheduled_time.replace(tzinfo=timezone.utc).astimezone()
                
                # Format date and time using local time
                formatted_date = local_time.strftime('%B %d, %Y')
                formatted_time = local_time.strftime('%I:%M %p')
                
                # Prepare session details for email
                session_details = {
                    'subject': opportunity.get('subject', ''),
                    'date': formatted_date,
                    'time': formatted_time,
                    'location': opportunity.get('session_location', ''),
                    'tutor_name': f"{tutor.get('first_name', '')} {tutor.get('last_name', '')}".strip(),
                    'tutee_name': f"{opportunity.get('tutee_first_name', '')} {opportunity.get('tutee_last_name', '')}".strip()
                }
                
                # Send reminder emails
                tutor_success = send_tutor_reminder(tutor.get('email', ''), session_details)
                tutee_success = send_tutee_reminder(opportunity.get('tutee_email', ''), session_details)
                
                if tutor_success and tutee_success:
                    # Log the communication
                    try:
                        # Log communication for tutor
                        db.insert_record("communications", {
                            "job_id": session['id'],
                            "type": "email",
                            "recipient": tutor.get('email', ''),
                            "subject": f"Session reminder for {session_details['subject']}",
                            "content": f"Session reminder for {session_details['subject']} on {session_details['date']}",
                            "status": "sent"
                        })
                        # Log communication for tutee
                        db.insert_record("communications", {
                            "job_id": session['id'],
                            "type": "email",
                            "recipient": opportunity.get('tutee_email', ''),
                            "subject": f"Session reminder for {session_details['subject']}",
                            "content": f"Session reminder for {session_details['subject']} on {session_details['date']}",
                            "status": "sent"
                        })
                    except Exception as log_error:
                        logger.error(f"Failed to log reminder communication: {str(log_error)}")
                    
                    reminder_count += 1
                    logger.info(f"Reminder sent for session {session['id']}")
                else:
                    logger.error(f"Failed to send reminder for session {session['id']}")
                    
            except Exception as session_error:
                logger.error(f"Error processing session {session.get('id', 'unknown')}: {str(session_error)}")
                continue
        
        logger.info(f"Sent {reminder_count} session reminders for tomorrow")
        return reminder_count
        
    except Exception as e:
        logger.error(f"Error in send_session_reminders: {str(e)}")
        return 0

def send_tutor_reminder(tutor_email: str, session_details: dict) -> bool:
    """Send reminder email to tutor"""
    if not tutor_email:
        return False
        
    email_service = get_email_service()
    
    subject = f"Reminder: Tutoring Session Tomorrow - {session_details['subject']}"
    
    html_body = f"""
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
    
    text_body = f"""
    Session Reminder
    
    Hello {session_details['tutor_name']},
    
    This is a friendly reminder about your tutoring session tomorrow:
    
    Subject: {session_details['subject']}
    Date: {session_details['date']}
    Time: {session_details['time']}
    Location: {session_details['location']}
    Student: {session_details['tutee_name']}
    
    Please remember to:
    - Arrive on time and prepared
    - Record your session for volunteer hours credit
    - Contact the student if you need to make any changes
    
    Thank you for volunteering!
    """
    
    return email_service.send_email(tutor_email, subject, html_body, text_body)

def send_tutee_reminder(tutee_email: str, session_details: dict) -> bool:
    """Send reminder email to tutee"""
    if not tutee_email:
        return False
        
    email_service = get_email_service()
    
    subject = f"Reminder: Tutoring Session Tomorrow - {session_details['subject']}"
    
    html_body = f"""
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
    
    text_body = f"""
    Session Reminder
    
    Hello {session_details['tutee_name']},
    
    This is a friendly reminder about your tutoring session tomorrow:
    
    Subject: {session_details['subject']}
    Date: {session_details['date']}
    Time: {session_details['time']}
    Location: {session_details['location']}
    Tutor: {session_details['tutor_name']}
    
    Please remember to:
    - Arrive on time and bring any materials you need
    - Come prepared with specific questions or topics
    - Contact your tutor if you need to make any changes
    
    We hope you have a productive session!
    """
    
    return email_service.send_email(tutee_email, subject, html_body, text_body)

if __name__ == "__main__":
    # Allow running this script directly for testing
    count = send_session_reminders()
    print(f"Sent {count} reminder emails")