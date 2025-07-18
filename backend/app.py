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

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0', port=8002)