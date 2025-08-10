from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from dotenv import load_dotenv
from routes.api import api_bp
from routes.tutor_management import tutor_management_bp
from routes.email_notifications import email_notifications_bp
from routes.tutee import tutee_bp
from routes.tutor import tutor_bp
from routes.auth import auth_bp
from routes.jobs import jobs_bp

# Load environment variables
load_dotenv()

def create_app():
    """Create and configure the Flask application"""
    app = Flask(__name__)
    
    # Configure CORS to allow requests from frontend domains
    CORS(app, origins=[
        "http://localhost:3000",
        "https://localhost:3000", 
        "https://tutoringapp.ca",
        "https://www.tutoringapp.ca",
        "https://app.tutoringapp.ca",
        "https://frontend.tutoringapp.ca"
    ], supports_credentials=True, methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])
    
    # Register blueprints
    app.register_blueprint(api_bp)
    app.register_blueprint(tutor_management_bp)
    app.register_blueprint(email_notifications_bp)
    app.register_blueprint(tutee_bp)
    app.register_blueprint(tutor_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(jobs_bp)
    
    @app.route('/')
    def hello():
        return jsonify({"message": "Tutoring Automation Backend API"})

    @app.route('/health')
    def health_check():
        return jsonify({"status": "healthy"})
        
    return app

# Create the app instance for Vercel
app = create_app()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8000))
    print(f"Starting Flask app on port {port}")
    app.run(debug=False, host='0.0.0.0', port=port)