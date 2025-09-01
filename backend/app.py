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
from routes.help import help_bp
import re

# Load environment variables
load_dotenv()

def create_app():
    """Create and configure the Flask application"""
    app = Flask(__name__)
    
    # Configure CORS to allow requests from frontend domains
    # Include specific domains and regex for Vercel previews
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
        resources={r"/api/*": {"origins": allowed_origins}},
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
        automatic_options=True,
        always_send=True,
    )

    # Extra safeguard: explicitly add CORS headers on every /api/* response
    def _origin_allowed(origin: str) -> bool:
        if not origin:
            return False
        for o in allowed_origins:
            try:
                # Support regex origins
                if hasattr(o, 'match'):
                    if o.match(origin):
                        return True
                else:
                    if o == origin:
                        return True
            except Exception:
                continue
        return False

    @app.after_request
    def add_api_cors_headers(resp):
        try:
            path = request.path or ''
            origin = request.headers.get('Origin')
            if path.startswith('/api/') and origin and _origin_allowed(origin):
                # Minimal secure headers: mirror specific allowed origin and allow credentials
                resp.headers['Access-Control-Allow-Origin'] = origin
                resp.headers['Vary'] = 'Origin'
                resp.headers['Access-Control-Allow-Credentials'] = 'true'
                # For safety, include common headers/methods if preflight slips through
                resp.headers.setdefault('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Requested-With, Accept, Origin')
                resp.headers.setdefault('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        except Exception:
            pass
        return resp
    
    # Register blueprints
    app.register_blueprint(api_bp)
    app.register_blueprint(tutor_management_bp)
    app.register_blueprint(email_notifications_bp)
    app.register_blueprint(tutee_bp)
    app.register_blueprint(tutor_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(jobs_bp)
    app.register_blueprint(help_bp)
    
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