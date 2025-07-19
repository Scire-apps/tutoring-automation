from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from dotenv import load_dotenv
from routes.api import api_bp
from routes.admin_invitations import admin_invitations_bp

# Load environment variables
load_dotenv()

def create_app():
    """Create and configure the Flask application"""
    app = Flask(__name__)
    CORS(app)
    
    # Register blueprints
    app.register_blueprint(api_bp)
    app.register_blueprint(admin_invitations_bp)
    
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