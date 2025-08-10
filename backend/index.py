from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import re

app = Flask(__name__)

# Align CORS with main app entrypoint for any deployments using this file
allowed_origins = [
    "http://localhost:3000",
    "https://localhost:3000",
    "https://tutoringapp.ca",
    "https://www.tutoringapp.ca",
    "https://app.tutoringapp.ca",
    "https://frontend.tutoringapp.ca",
    "https://tutorappdev.vercel.app",
    re.compile(r"^https://.*\\.vercel\\.app$"),
]

CORS(
    app,
    origins=allowed_origins,
    supports_credentials=True,
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
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
    """Simple Google Forms webhook endpoint"""
    try:
        data = request.get_json() or {}
        return jsonify({
            "success": True, 
            "message": "Webhook received",
            "timestamp": data.get("timestamp", "unknown")
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# This is what Vercel needs
def handler(event, context):
    return app

if __name__ == '__main__':
    app.run(debug=True)