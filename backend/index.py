from flask import Flask, request, jsonify
import json

app = Flask(__name__)

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