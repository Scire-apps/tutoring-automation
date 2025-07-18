import os
import json
import logging
from typing import Dict, Any, Optional
from flask import Request

# Configure logging
logger = logging.getLogger(__name__)

class GoogleFormsHandler:
    """Handler for Google Forms webhook integration using Apps Script"""
    
    @staticmethod
    def verify_webhook_signature(request: Request) -> bool:
        """
        Verify the secret key from Google Apps Script webhook
        
        Args:
            request: Flask request object
            
        Returns:
            bool: True if secret is valid, False otherwise
        """
        webhook_secret = os.environ.get("GOOGLE_FORMS_WEBHOOK_SECRET")
        if not webhook_secret:
            logger.warning("GOOGLE_FORMS_WEBHOOK_SECRET not set, skipping signature verification")
            return True
            
        # Check for the secret in the header
        request_secret = request.headers.get("X-Webhook-Secret")
        if not request_secret:
            logger.warning("No X-Webhook-Secret header found in request")
            return False
            
        # Simple equality check for the secret
        return webhook_secret == request_secret
    
    @staticmethod
    def parse_form_data(request_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Parse Google Forms webhook data into a structured format
        
        Args:
            request_data: Raw webhook data from Google Forms
            
        Returns:
            Dict: Structured form data or None if parsing fails
        """
        try:
            # Extract form responses
            form_id = request_data.get("formId")
            form_title = request_data.get("formTitle")
            responses = {}
            
            # Process each question and answer
            for item in request_data.get("responses", []):
                question = item.get("questionTitle", "")
                answer = item.get("answer", "")
                responses[question] = answer
                
            # Create structured data
            structured_data = {
                "form_id": form_id,
                "form_title": form_title,
                "timestamp": request_data.get("timestamp"),
                "responses": responses
            }
            
            return structured_data
        except Exception as e:
            logger.error(f"Error parsing form data: {str(e)}")
            return None
    
    @staticmethod
    def extract_tutoring_request(form_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Extract tutoring request details from parsed form data
        
        Args:
            form_data: Parsed form data
            
        Returns:
            Dict: Tutoring request details or None if extraction fails
        """
        try:
            responses = form_data.get("responses", {})
            
            # Map expected form fields to internal structure
            # These field names should match the actual Google Form questions
            tutoring_request = {
                "tutee_name": responses.get("Full Name", ""),
                "tutee_email": responses.get("Email Address", ""),
                "subject": responses.get("Subject", ""),
                "grade_level": responses.get("Grade Level", ""),
                "school": responses.get("School", ""),
                "availability": responses.get("Availability", ""),
                "location_preference": responses.get("Location Preference", ""),
                "additional_notes": responses.get("Additional Notes", ""),
                "timestamp": form_data.get("timestamp")
            }
            
            # Validate required fields
            required_fields = ["tutee_name", "tutee_email", "subject"]
            for field in required_fields:
                if not tutoring_request.get(field):
                    logger.warning(f"Missing required field: {field}")
                    return None
                    
            return tutoring_request
        except Exception as e:
            logger.error(f"Error extracting tutoring request: {str(e)}")
            return None