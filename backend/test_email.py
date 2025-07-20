import os
import sys
import logging
from dotenv import load_dotenv
from utils.email_service import get_email_service

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def test_send_email(recipient_email):
    """
    Test sending an email using the configured email service
    
    Args:
        recipient_email: Email address to send the test email to
    """
    # Load environment variables
    load_dotenv()
    
    # Get email service
    email_service = get_email_service()
    
    # Email content
    subject = "Test Email from Tutoring Automation System"
    html_content = """
    <html>
    <body>
        <h1>Test Email</h1>
        <p>This is a test email from the Tutoring Automation System.</p>
        <p>If you received this email, the email service is working correctly!</p>
        <p>Email service provider: <strong>{provider}</strong></p>
    </body>
    </html>
    """.format(provider=os.environ.get("EMAIL_SERVICE", "unknown"))
    
    text_content = """
    Test Email
    
    This is a test email from the Tutoring Automation System.
    
    If you received this email, the email service is working correctly!
    
    Email service provider: {provider}
    """.format(provider=os.environ.get("EMAIL_SERVICE", "unknown"))
    
    # Send email
    logger.info(f"Sending test email to {recipient_email}...")
    success = email_service.send_email(
        to_email=recipient_email,
        subject=subject,
        body_html=html_content,
        body_text=text_content
    )
    
    if success:
        logger.info("Email sent successfully!")
    else:
        logger.error("Failed to send email.")
    
    return success

def test_session_confirmation(tutor_email, tutee_email):
    """
    Test sending session confirmation emails
    
    Args:
        tutor_email: Tutor's email address
        tutee_email: Tutee's email address
    """
    # Load environment variables
    load_dotenv()
    
    # Get email service
    email_service = get_email_service()
    
    # Session details
    session_details = {
        "subject": "Algebra II",
        "date": "July 20, 2025",
        "time": "3:30 PM - 4:30 PM",
        "location": "School Library",
        "tutor_name": "John Doe",
        "tutee_name": "Jane Smith"
    }
    
    # Send confirmation emails
    logger.info(f"Sending session confirmation emails to {tutor_email} and {tutee_email}...")
    success = email_service.send_session_confirmation(
        tutor_email=tutor_email,
        tutee_email=tutee_email,
        session_details=session_details
    )
    
    if success:
        logger.info("Session confirmation emails sent successfully!")
    else:
        logger.error("Failed to send session confirmation emails.")
    
    return success

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_email.py <recipient_email> [test_type]")
        print("  test_type: 'simple' (default) or 'session'")
        sys.exit(1)
    
    recipient_email = sys.argv[1]
    test_type = sys.argv[2] if len(sys.argv) > 2 else "simple"
    
    if test_type == "session":
        # For session test, use the same email for both tutor and tutee
        test_session_confirmation(recipient_email, recipient_email)
    else:
        # Simple test
        test_send_email(recipient_email)