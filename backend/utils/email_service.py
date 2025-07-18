import os
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Dict, Any, Optional

# Configure logging
logger = logging.getLogger(__name__)

class EmailService:
    """Email service for sending notifications"""
    
    _instance = None
    
    def __new__(cls):
        """Singleton pattern to ensure only one email service instance"""
        if cls._instance is None:
            cls._instance = super(EmailService, cls).__new__(cls)
            cls._instance._initialize()
        return cls._instance
    
    def _initialize(self):
        """Initialize email service configuration"""
        self.service = os.environ.get("EMAIL_SERVICE", "smtp")
        self.host = os.environ.get("EMAIL_HOST")
        self.port = int(os.environ.get("EMAIL_PORT", "587"))
        self.username = os.environ.get("EMAIL_USERNAME")
        self.password = os.environ.get("EMAIL_PASSWORD")
        self.from_email = os.environ.get("EMAIL_FROM")
        
        # Validate configuration
        if not all([self.host, self.username, self.password, self.from_email]):
            logger.warning("Email service not fully configured")
    
    def send_email(self, to_email: str, subject: str, body_html: str, 
                  body_text: Optional[str] = None, cc: Optional[List[str]] = None) -> bool:
        """
        Send an email
        
        Args:
            to_email: Recipient email address
            subject: Email subject
            body_html: HTML content of the email
            body_text: Plain text content of the email (optional)
            cc: List of CC recipients (optional)
            
        Returns:
            bool: True if email was sent successfully, False otherwise
        """
        if not all([self.host, self.username, self.password, self.from_email]):
            logger.error("Email service not configured")
            return False
            
        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = self.from_email
            msg['To'] = to_email
            
            if cc:
                msg['Cc'] = ", ".join(cc)
                
            # Add text part if provided
            if body_text:
                msg.attach(MIMEText(body_text, 'plain'))
                
            # Add HTML part
            msg.attach(MIMEText(body_html, 'html'))
            
            # Send email
            with smtplib.SMTP(self.host, self.port) as server:
                server.starttls()
                server.login(self.username, self.password)
                
                recipients = [to_email]
                if cc:
                    recipients.extend(cc)
                    
                server.sendmail(self.from_email, recipients, msg.as_string())
                
            logger.info(f"Email sent to {to_email}")
            return True
        except Exception as e:
            logger.error(f"Error sending email: {str(e)}")
            return False
    
    def send_session_confirmation(self, tutor_email: str, tutee_email: str, 
                                 session_details: Dict[str, Any]) -> bool:
        """
        Send session confirmation emails to tutor and tutee
        
        Args:
            tutor_email: Tutor's email address
            tutee_email: Tutee's email address
            session_details: Dictionary with session details
            
        Returns:
            bool: True if emails were sent successfully, False otherwise
        """
        # Extract session details
        subject_name = session_details.get("subject", "")
        date = session_details.get("date", "")
        time = session_details.get("time", "")
        location = session_details.get("location", "")
        tutor_name = session_details.get("tutor_name", "")
        tutee_name = session_details.get("tutee_name", "")
        
        # Create email subject
        email_subject = f"Tutoring Session Confirmation: {subject_name} on {date}"
        
        # Create HTML content for tutor
        tutor_html = f"""
        <html>
        <body>
            <h2>Tutoring Session Confirmation</h2>
            <p>Hello {tutor_name},</p>
            <p>Your tutoring session has been confirmed with the following details:</p>
            <ul>
                <li><strong>Subject:</strong> {subject_name}</li>
                <li><strong>Date:</strong> {date}</li>
                <li><strong>Time:</strong> {time}</li>
                <li><strong>Location:</strong> {location}</li>
                <li><strong>Student:</strong> {tutee_name}</li>
                <li><strong>Student Email:</strong> {tutee_email}</li>
            </ul>
            <p>Please remember to record your session and upload it to the platform to receive volunteer hours credit.</p>
            <p>If you need to cancel or reschedule, please do so at least 24 hours in advance through the tutoring platform.</p>
            <p>Thank you for volunteering!</p>
        </body>
        </html>
        """
        
        # Create HTML content for tutee
        tutee_html = f"""
        <html>
        <body>
            <h2>Tutoring Session Confirmation</h2>
            <p>Hello {tutee_name},</p>
            <p>Your tutoring session has been confirmed with the following details:</p>
            <ul>
                <li><strong>Subject:</strong> {subject_name}</li>
                <li><strong>Date:</strong> {date}</li>
                <li><strong>Time:</strong> {time}</li>
                <li><strong>Location:</strong> {location}</li>
                <li><strong>Tutor:</strong> {tutor_name}</li>
            </ul>
            <p>If you need to cancel or reschedule, please contact your tutor directly at {tutor_email}.</p>
            <p>We hope you have a productive tutoring session!</p>
        </body>
        </html>
        """
        
        # Send emails
        tutor_success = self.send_email(tutor_email, email_subject, tutor_html)
        tutee_success = self.send_email(tutee_email, email_subject, tutee_html)
        
        return tutor_success and tutee_success
        
def get_email_service() -> EmailService:
    """
    Get the email service instance
    
    Returns:
        EmailService: Email service instance
    """
    return EmailService()

def send_invitation_email(to_email: str, invitation_url: str, role: str) -> bool:
    """
    Send an admin invitation email
    
    Args:
        to_email: Recipient email address
        invitation_url: URL for completing registration
        role: Admin role (admin or superadmin)
        
    Returns:
        bool: True if email was sent successfully, False otherwise
    """
    email_service = get_email_service()
    
    subject = f"Invitation to join Tutoring System as {role.title()}"
    
    html_body = f"""
    <html>
    <body>
        <h2>Invitation to join Tutoring System</h2>
        <p>You have been invited to join the Tutoring System as a <strong>{role.title()}</strong>.</p>
        
        <p>Please click the button below to complete your registration:</p>
        
        <a href="{invitation_url}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Complete Registration
        </a>
        
        <p><small>Or copy and paste this link into your browser: {invitation_url}</small></p>
        
        <p><em>This invitation will expire in 7 days.</em></p>
        
        <p>If you did not expect this invitation, please ignore this email.</p>
    </body>
    </html>
    """
    
    text_body = f"""
You have been invited to join the Tutoring System as a {role.title()}.

Please visit the following link to complete your registration:
{invitation_url}

This invitation will expire in 7 days.

If you did not expect this invitation, please ignore this email.
    """
    
    return email_service.send_email(to_email, subject, html_body, text_body)