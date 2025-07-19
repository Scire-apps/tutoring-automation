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
            
            # Parse first and last name
            first_name = responses.get("First and Last Name", "").split()[0] if responses.get("First and Last Name", "") else ""
            last_name = " ".join(responses.get("First and Last Name", "").split()[1:]) if len(responses.get("First and Last Name", "").split()) > 1 else ""
            
            # Parse availability into formatted string
            date = responses.get("Date:", "")
            start_time = responses.get("I am available from...", "")
            end_time = responses.get("Until...", "")
            availability_formatted = f"{date}, {start_time}-{end_time}" if all([date, start_time, end_time]) else ""
            
            # Map expected form fields to internal structure
            tutoring_request = {
                "school": responses.get("School", "White Oaks S.S."),
                "tutee_first_name": first_name,
                "tutee_last_name": last_name,
                "tutee_pronouns": responses.get("Pronouns", ""),
                "tutee_email": responses.get("Email", ""),
                "grade_level": responses.get("Grade", ""),
                "subject": responses.get("Subject", ""),
                "specific_topic": responses.get("What specific unit/topic/concept do you need help with?", ""),
                "course_level": responses.get("Level of Course/Program", ""),
                "urgency_level": int(responses.get("How Urgent?", 5)),  # Default to 5 if not provided
                "session_location": responses.get("Where do you want your session?", ""),
                "availability_date": responses.get("Date:", ""),
                "availability_start_time": responses.get("I am available from...", ""),
                "availability_end_time": responses.get("Until...", ""),
                "availability_formatted": availability_formatted,
                "timestamp": form_data.get("timestamp")
            }
            
            # Validate required fields
            required_fields = ["tutee_first_name", "tutee_email", "subject", "grade_level", "specific_topic", "course_level", "session_location"]
            for field in required_fields:
                if not tutoring_request.get(field):
                    logger.warning(f"Missing required field: {field}")
                    return None
            
            # Validate grade level
            if tutoring_request["grade_level"] not in ["9", "10", "11", "12"]:
                logger.warning(f"Invalid grade level: {tutoring_request['grade_level']}")
                return None
            
            # Validate course level
            valid_course_levels = ["ESL", "Academic", "ALP", "IB", "College", "University"]
            if tutoring_request["course_level"] not in valid_course_levels:
                logger.warning(f"Invalid course level: {tutoring_request['course_level']}")
                return None
            
            # Validate session location
            if tutoring_request["session_location"] not in ["In person", "Online"]:
                logger.warning(f"Invalid session location: {tutoring_request['session_location']}")
                return None
            
            # Validate urgency level
            if not (1 <= tutoring_request["urgency_level"] <= 10):
                logger.warning(f"Invalid urgency level: {tutoring_request['urgency_level']}")
                tutoring_request["urgency_level"] = 5  # Default to 5
                    
            return tutoring_request
        except Exception as e:
            logger.error(f"Error extracting tutoring request: {str(e)}")
            return None