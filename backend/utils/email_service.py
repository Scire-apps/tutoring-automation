import os
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Dict, Any, Optional
import re
import sib_api_v3_sdk
from sib_api_v3_sdk.rest import ApiException
from mailjet_rest import Client

# Configure logging
logger = logging.getLogger(__name__)

class EmailService:
    """Base email service for sending notifications"""
    
    _instance = None
    
    def __new__(cls):
        """Singleton pattern to ensure only one email service instance"""
        if cls._instance is None:
            # Determine which email service to use based on configuration
            service_type = os.environ.get("EMAIL_SERVICE", "smtp").lower()
            
            if service_type == "brevo":
                cls._instance = object.__new__(BrevoEmailService)
                cls._instance.__init__()
            elif service_type == "mailjet":
                cls._instance = object.__new__(MailjetEmailService)
                cls._instance.__init__()
            else:
                # Default to SMTP
                cls._instance = object.__new__(SMTPEmailService)
                cls._instance.__init__()
                
        return cls._instance
    
    def send_email(self, to_email: str, subject: str, body_html: str, 
                  body_text: Optional[str] = None, cc: Optional[List[str]] = None) -> bool:
        """
        Send an email - to be implemented by subclasses
        
        Args:
            to_email: Recipient email address
            subject: Email subject
            body_html: HTML content of the email
            body_text: Plain text content of the email (optional)
            cc: List of CC recipients (optional)
            
        Returns:
            bool: True if email was sent successfully, False otherwise
        """
        raise NotImplementedError("Subclasses must implement send_email method")

    @staticmethod
    def _scrub_hdsb_role_tag(address: Optional[str]) -> Optional[str]:
        """Remove +tutor/+tutee tagging from @hdsb.ca emails for delivery.

        Examples:
          1abouaitaadh+tutor@hdsb.ca -> 1abouaitaadh@hdsb.ca
          1smithj+tutee@HDSB.CA      -> 1smithj@HDSB.CA
        Leaves non-hdsb domains untouched.
        """
        if not isinstance(address, str):
            return address
        try:
            local, domain = address.split('@', 1)
        except ValueError:
            return address
        if domain.lower() != 'hdsb.ca':
            return address
        cleaned_local = re.sub(r"\+(?:tutor|tutee)$", "", local, flags=re.IGNORECASE)
        return f"{cleaned_local}@{domain}"
    
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
        tutee_grade = session_details.get("tutee_grade", "")
        duration_minutes = session_details.get("duration_minutes", 60)
        
        # Create email subject
        email_subject = f"Tutoring Session Confirmation: {subject_name} on {date}"
        
        # Scrub recipient emails for delivery and display
        tutor_email_clean = self._scrub_hdsb_role_tag(tutor_email) or tutor_email
        tutee_email_clean = self._scrub_hdsb_role_tag(tutee_email) or tutee_email

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
                <li><strong>Duration:</strong> {duration_minutes} minutes</li>
                <li><strong>Location:</strong> {location}</li>
                <li><strong>Student:</strong> {tutee_name}{' (Grade ' + tutee_grade + ')' if tutee_grade else ''}</li>
                <li><strong>Student Email:</strong> {tutee_email_clean}</li>
            </ul>
            <p>Please remember to record your session and upload it to the platform to receive volunteer hours credit.</p>
            <p>If you need to cancel or reschedule, please do so at least 24 hours in advance through the tutoring platform.</p>
            <p>Thank you for volunteering!</p>
        </body>
        </html>
        """
        
        # Create text content for tutor
        tutor_text = f"""
        Tutoring Session Confirmation
        
        Hello {tutor_name},
        
        Your tutoring session has been confirmed with the following details:
        
        Subject: {subject_name}
        Date: {date}
        Time: {time}
        Duration: {duration_minutes} minutes
        Location: {location}
        Student: {tutee_name}{' (Grade ' + tutee_grade + ')' if tutee_grade else ''}
        Student Email: {tutee_email_clean}
        
        Please remember to record your session and upload it to the platform to receive volunteer hours credit.
        
        If you need to cancel or reschedule, please do so at least 24 hours in advance through the tutoring platform.
        
        Thank you for volunteering!
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
                <li><strong>Duration:</strong> {duration_minutes} minutes</li>
                <li><strong>Location:</strong> {location}</li>
                <li><strong>Tutor:</strong> {tutor_name}</li>
            </ul>
            <p>If you need to cancel or reschedule, please contact your tutor directly at {tutor_email_clean}.</p>
            <p>We hope you have a productive tutoring session!</p>
        </body>
        </html>
        """
        
        # Create text content for tutee
        tutee_text = f"""
        Tutoring Session Confirmation
        
        Hello {tutee_name},
        
        Your tutoring session has been confirmed with the following details:
        
        Subject: {subject_name}
        Date: {date}
        Time: {time}
        Duration: {duration_minutes} minutes
        Location: {location}
        Tutor: {tutor_name}
        
        If you need to cancel or reschedule, please contact your tutor directly at {tutor_email_clean}.
        
        We hope you have a productive tutoring session!
        """
        
        # Send emails
        tutor_success = self.send_email(tutor_email_clean, email_subject, tutor_html, tutor_text)
        tutee_success = self.send_email(tutee_email_clean, email_subject, tutee_html, tutee_text)
        
        return tutor_success and tutee_success

    def send_availability_notification(self, tutee_email: str, tutee_name: str, 
                                     tutor_name: str, subject_name: str, 
                                     dashboard_url: str) -> bool:
        """
        Send availability notification email to tutee when tutor applies for opportunity
        
        Args:
            tutee_email: Tutee's email address
            tutee_name: Tutee's full name
            tutor_name: Tutor's full name
            subject_name: Subject name for the tutoring session
            dashboard_url: URL to the tutee dashboard
            
        Returns:
            bool: True if email was sent successfully, False otherwise
        """
        # Create email subject
        email_subject = f"Tutor Found for {subject_name} - Please Set Your Availability"
        
        # Create HTML content
        html_content = f"""
        <html>
        <body>
            <h2>Great News! A Tutor Has Applied for Your Request</h2>
            <p>Hello {tutee_name},</p>
            <p>We're excited to let you know that a tutor has applied for your tutoring request in <strong>{subject_name}</strong>!</p>
            
            <h3>Next Steps:</h3>
            <p>To proceed with scheduling your tutoring session, please:</p>
            <ol>
                <li>Log into your tutoring dashboard</li>
                <li>Set your availability for the upcoming week</li>
                <li>The tutor will then finalize the schedule based on your preferences</li>
            </ol>
            
            <p><strong>Tutor:</strong> {tutor_name}</p>
            <p><strong>Subject:</strong> {subject_name}</p>
            
            <div style="margin: 30px 0; text-align: center;">
                <a href="{dashboard_url}" 
                   style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                    Set Your Availability
                </a>
            </div>
            
            <p><strong>Important:</strong> Please set your availability ASAP.</p>
            
            <p>If you have any questions or need assistance, please don't hesitate to contact us.</p>
            
            <p>Best regards,<br>The Tutoring Team</p>
        </body>
        </html>
        """
        
        # Create text content
        text_content = f"""
        Great News! A Tutor Has Applied for Your Request
        
        Hello {tutee_name},
        
        We're excited to let you know that a tutor has applied for your tutoring request in {subject_name}!
        
        Next Steps:
        To proceed with scheduling your tutoring session, please:
        1. Log into your tutoring dashboard
        2. Set your availability for the upcoming week
        3. The tutor will then finalize the schedule based on your preferences
        
        Tutor: {tutor_name}
        Subject: {subject_name}
        
        Set Your Availability: {dashboard_url}
        
        Important: Please set your availability ASAP.
        
        If you have any questions or need assistance, please don't hesitate to contact us.
        
        Best regards,
        The Tutoring Team
        """
        
        # Send email
        return self.send_email(tutee_email, email_subject, html_content, text_content)

    def send_tutor_scheduling_notification(self, tutor_email: str, tutor_name: str, 
                                         tutee_name: str, subject_name: str, 
                                         dashboard_url: str) -> bool:
        """
        Send scheduling notification email to tutor when tutee sets availability
        
        Args:
            tutor_email: Tutor's email address
            tutor_name: Tutor's full name
            tutee_name: Tutee's full name
            subject_name: Subject name for the tutoring session
            dashboard_url: URL to the tutor dashboard
            
        Returns:
            bool: True if email was sent successfully, False otherwise
        """
        # Create email subject
        email_subject = f"Student Has Set Availability for {subject_name} - Please Schedule Session"
        
        # Create HTML content
        html_content = f"""
        <html>
        <body>
            <h2>Great! Your Student Has Set Their Availability</h2>
            <p>Hello {tutor_name},</p>
            <p>Great news! Your student has set their availability for your tutoring session in <strong>{subject_name}</strong>.</p>
            
            <h3>Next Steps:</h3>
            <p>To finalize the tutoring session, please:</p>
            <ol>
                <li>Log into your tutoring dashboard</li>
                <li>Review the student's available time slots</li>
                <li>Choose the best time that works for both of you</li>
                <li>Confirm the session schedule</li>
            </ol>
            
            <p><strong>Student:</strong> {tutee_name}</p>
            <p><strong>Subject:</strong> {subject_name}</p>
            
            <div style="margin: 30px 0; text-align: center;">
                <a href="{dashboard_url}" 
                   style="background-color: #10B981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                    Schedule Session
                </a>
            </div>
            
            <p><strong>Important:</strong> Please schedule the session ASAP.</p>
            
            <p>If you have any questions or need assistance, please don't hesitate to contact us.</p>
            
            <p>Thank you for volunteering!<br>The Tutoring Team</p>
        </body>
        </html>
        """
        
        # Create text content
        text_content = f"""
        Great! Your Student Has Set Their Availability
        
        Hello {tutor_name},
        
        Great news! Your student has set their availability for your tutoring session in {subject_name}.
        
        Next Steps:
        To finalize the tutoring session, please:
        1. Log into your tutoring dashboard
        2. Review the student's available time slots
        3. Choose the best time that works for both of you
        4. Confirm the session schedule
        
        Student: {tutee_name}
        Subject: {subject_name}
        
        Schedule Session: {dashboard_url}
        
        Important: Please schedule the session ASAP.
        
        If you have any questions or need assistance, please don't hesitate to contact us.
        
        Thank you for volunteering!
        The Tutoring Team
        """
        
        # Send email
        return self.send_email(tutor_email, email_subject, html_content, text_content)


class SMTPEmailService(EmailService):
    """Email service using SMTP for sending notifications"""
    
    def __init__(self):
        """Initialize SMTP email service configuration"""
        self.host = os.environ.get("EMAIL_HOST")
        self.port = int(os.environ.get("EMAIL_PORT", "587"))
        self.username = os.environ.get("EMAIL_USERNAME")
        self.password = os.environ.get("EMAIL_PASSWORD")
        self.from_email = os.environ.get("EMAIL_FROM")
        
        # Validate configuration
        if not all([self.host, self.username, self.password, self.from_email]):
            logger.warning("SMTP email service not fully configured")
    
    def send_email(self, to_email: str, subject: str, body_html: str, 
                  body_text: Optional[str] = None, cc: Optional[List[str]] = None) -> bool:
        """
        Send an email using SMTP
        
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
            logger.error("SMTP email service not configured")
            return False
            
        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = self.from_email
            to_email_clean = self._scrub_hdsb_role_tag(to_email) or to_email
            msg['To'] = to_email_clean
            
            if cc:
                cc_clean = [self._scrub_hdsb_role_tag(c) or c for c in cc]
                msg['Cc'] = ", ".join(cc_clean)
                
            # Add text part if provided
            if body_text:
                msg.attach(MIMEText(body_text, 'plain'))
                
            # Add HTML part
            msg.attach(MIMEText(body_html, 'html'))
            
            # Send email
            with smtplib.SMTP(self.host, self.port) as server:
                server.starttls()
                server.login(self.username, self.password)
                
                recipients = [to_email_clean]
                if cc:
                    recipients.extend(cc_clean)
                    
                server.sendmail(self.from_email, recipients, msg.as_string())
                
            logger.info(f"Email sent to {to_email} via SMTP")
            return True
        except Exception as e:
            logger.error(f"Error sending email via SMTP: {str(e)}")
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
        
class BrevoEmailService(EmailService):
    """Email service using Brevo API for sending notifications"""
    
    def __init__(self):
        """Initialize Brevo email service configuration"""
        self.api_key = os.environ.get("BREVO_API_KEY")
        self.from_email = os.environ.get("EMAIL_FROM")
        self.from_name = os.environ.get("EMAIL_FROM_NAME", "Tutoring System")
        
        # Validate configuration
        if not all([self.api_key, self.from_email]):
            logger.warning("Brevo email service not fully configured")
        
        # Configure API client
        self.configuration = sib_api_v3_sdk.Configuration()
        self.configuration.api_key['api-key'] = self.api_key
        
    def send_email(self, to_email: str, subject: str, body_html: str, 
                  body_text: Optional[str] = None, cc: Optional[List[str]] = None) -> bool:
        """
        Send an email using Brevo API
        
        Args:
            to_email: Recipient email address
            subject: Email subject
            body_html: HTML content of the email
            body_text: Plain text content of the email (optional)
            cc: List of CC recipients (optional)
            
        Returns:
            bool: True if email was sent successfully, False otherwise
        """
        if not self.api_key:
            logger.error("Brevo API key not configured")
            return False
            
        try:
            # Create API instance
            api_instance = sib_api_v3_sdk.TransactionalEmailsApi(sib_api_v3_sdk.ApiClient(self.configuration))
            
            # Create sender
            sender = {"email": self.from_email, "name": self.from_name}
            
            # Create recipient
            to_email_clean = self._scrub_hdsb_role_tag(to_email) or to_email
            to = [{"email": to_email_clean}]
            
            # Create CC recipients if provided
            cc_list = None
            if cc:
                cc_list = [{"email": (self._scrub_hdsb_role_tag(email) or email)} for email in cc]
            
            # Create email
            send_smtp_email = sib_api_v3_sdk.SendSmtpEmail(
                to=to,
                sender=sender,
                subject=subject,
                html_content=body_html,
                cc=cc_list
            )
            
            # Add text content if provided
            if body_text:
                send_smtp_email.text_content = body_text
                
            # Send email
            api_response = api_instance.send_transac_email(send_smtp_email)
            logger.info(f"Email sent to {to_email} with message ID: {api_response.message_id}")
            return True
            
        except ApiException as e:
            logger.error(f"Brevo API exception: {e}")
            return False
        except Exception as e:
            logger.error(f"Error sending email via Brevo: {str(e)}")
            return False


class MailjetEmailService(EmailService):
    """Email service using Mailjet API for sending notifications"""
    
    def __init__(self):
        """Initialize Mailjet email service configuration"""
        self.api_key = os.environ.get("MAILJET_API_KEY")
        self.api_secret = os.environ.get("MAILJET_API_SECRET")
        self.from_email = os.environ.get("EMAIL_FROM")
        self.from_name = os.environ.get("EMAIL_FROM_NAME", "Tutoring System")
        
        # Validate configuration
        if not all([self.api_key, self.api_secret, self.from_email]):
            logger.warning("Mailjet email service not fully configured")
        
        # Initialize Mailjet client
        self.mailjet = Client(auth=(self.api_key, self.api_secret), version='v3.1')
        
    def send_email(self, to_email: str, subject: str, body_html: str, 
                  body_text: Optional[str] = None, cc: Optional[List[str]] = None) -> bool:
        """
        Send an email using Mailjet API
        
        Args:
            to_email: Recipient email address
            subject: Email subject
            body_html: HTML content of the email
            body_text: Plain text content of the email (optional)
            cc: List of CC recipients (optional)
            
        Returns:
            bool: True if email was sent successfully, False otherwise
        """
        if not all([self.api_key, self.api_secret, self.from_email]):
            logger.error("Mailjet API credentials not configured")
            return False
            
        try:
            # Prepare recipients
            to_email_clean = self._scrub_hdsb_role_tag(to_email) or to_email
            
            # Prepare email data
            email_data = {
                'Messages': [
                    {
                        "From": {
                            "Email": self.from_email,
                            "Name": self.from_name
                        },
                        "To": [{"Email": to_email_clean}],
                        "Subject": subject,
                        "HTMLPart": body_html,
                    }
                ]
            }
            
            # Add text content if provided
            if body_text:
                email_data['Messages'][0]["TextPart"] = body_text
            
            # Add CC recipients if provided
            if cc:
                cc_recipients = []
                for cc_email in cc:
                    cc_email_clean = self._scrub_hdsb_role_tag(cc_email) or cc_email
                    cc_recipients.append({"Email": cc_email_clean})
                email_data['Messages'][0]["Cc"] = cc_recipients
            
            # Send email
            result = self.mailjet.send.create(data=email_data)
            
            if result.status_code == 200:
                logger.info(f"Email sent to {to_email} via Mailjet")
                return True
            else:
                logger.error(f"Mailjet API error: {result.status_code} - {result.json()}")
                return False
                
        except Exception as e:
            logger.error(f"Error sending email via Mailjet: {str(e)}")
            return False


def get_email_service() -> EmailService:
    """
    Get the email service instance
    
    Returns:
        EmailService: Email service instance
    """
    return EmailService()

def send_invitation_email(to_email: str, invitation_url: str, role: str) -> bool:
    # Invitations removed from the system: make this a no-op
    return False