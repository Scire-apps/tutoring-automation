from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json
from datetime import datetime, timedelta, timezone
import secrets
import re

app = Flask(__name__)

# Consistent CORS configuration for deployments using this entrypoint
allowed_origins = [
    "http://localhost:3000",
    "https://localhost:3000",
    "https://tutoringapp.ca",
    "https://www.tutoringapp.ca",
    "https://app.tutoringapp.ca",
    "https://frontend.tutoringapp.ca",
    "https://tutorappdev.vercel.app",
    re.compile(r"^https://.*\.vercel\.app$"),
]

CORS(
    app,
    origins=allowed_origins,
    supports_credentials=True,
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=[
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Accept",
        "Origin",
    ],
    expose_headers=["Content-Disposition"],
)

@app.route('/')
def hello():
    return jsonify({"message": "Tutoring Automation Backend API"})

@app.route('/health')
def health_check():
    return jsonify({"status": "healthy"})

@app.route('/api/webhook/google-forms', methods=['POST'])
def google_forms_webhook():
    """Google Forms webhook endpoint"""
    try:
        # Get webhook secret from environment
        webhook_secret = os.environ.get("GOOGLE_FORMS_WEBHOOK_SECRET", "tutoring_webhook_secret_2024")
        
        # Verify webhook signature
        request_secret = request.headers.get("X-Webhook-Secret")
        if not request_secret or webhook_secret != request_secret:
            return jsonify({"error": "Invalid signature"}), 401
        
        # Get form data
        form_data = request.get_json()
        if not form_data:
            return jsonify({"error": "Invalid form data"}), 400
        
        # Extract responses
        responses = {}
        for item in form_data.get("responses", []):
            question = item.get("questionTitle", "")
            answer = item.get("answer", "")
            responses[question] = answer
        
        # Extract tutoring request
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
                return jsonify({"error": f"Missing required field: {field}"}), 400
        
        # For now, just return success (we'll add database integration later)
        return jsonify({
            "success": True, 
            "message": "Tutoring request received",
            "data": tutoring_request
        }), 201
        
    except Exception as e:
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500

# For Vercel
def handler(request):
    return app(request.environ, lambda status, headers: None)

if __name__ == '__main__':
    app.run(debug=True)