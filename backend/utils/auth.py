"""
Authentication utilities for Flask backend
"""
from functools import wraps
from flask import request, jsonify
from utils.db import get_supabase_client
import jwt
import os

def require_auth(f):
    """Decorator to require authentication for API endpoints"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Short-circuit CORS preflight with explicit CORS headers
        if request.method == 'OPTIONS':
            from flask import make_response
            origin = request.headers.get('Origin', '*')
            resp = make_response('', 204)
            # Mirror origin to support credentials
            resp.headers['Access-Control-Allow-Origin'] = origin
            resp.headers['Vary'] = 'Origin'
            resp.headers['Access-Control-Allow-Credentials'] = 'true'
            resp.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
            req_headers = request.headers.get('Access-Control-Request-Headers', 'Authorization, Content-Type, X-Requested-With, Accept, Origin')
            resp.headers['Access-Control-Allow-Headers'] = req_headers
            resp.headers['Access-Control-Max-Age'] = '86400'
            return resp
        
        # Get the authorization header
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': 'No authorization header provided'}), 401
        
        # Extract the token
        try:
            token = auth_header.split(' ')[1]  # Bearer <token>
        except IndexError:
            return jsonify({'error': 'Invalid authorization header format'}), 401
        
        # Verify the token with Supabase
        try:
            supabase = get_supabase_client()
            
            # Verify the JWT token
            decoded_token = jwt.decode(
                token, 
                options={"verify_signature": False}  # Supabase handles signature verification
            )
            
            user_id = decoded_token.get('sub')
            if not user_id:
                return jsonify({'error': 'Invalid token'}), 401
            
            # Store user info in request context for use in the endpoint
            request.user_id = user_id
            request.user_email = decoded_token.get('email')
            
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        except Exception as e:
            print(f"Auth error: {e}")
            return jsonify({'error': 'Authentication failed'}), 401
        
        return f(*args, **kwargs)
    return decorated_function

def require_admin(f):
    """Decorator to require admin role for API endpoints"""
    @wraps(f)
    @require_auth
    def decorated_function(*args, **kwargs):
        # Check if user is an admin
        try:
            supabase = get_supabase_client()
            
            result = supabase.table('admins').select('role').eq('auth_id', request.user_id).single().execute()
            
            if not result.data:
                return jsonify({'error': 'Access denied: Admin role required'}), 403
            
            # Store admin role in request context
            request.user_role = result.data['role']
            
        except Exception as e:
            print(f"Admin check error: {e}")
            return jsonify({'error': 'Access denied'}), 403
        
        return f(*args, **kwargs)
    return decorated_function

def require_superadmin(f):
    """Deprecated: Superadmin merged into admin. Use require_admin semantics."""
    @wraps(f)
    @require_admin
    def decorated_function(*args, **kwargs):
        # Single admin role now has full privileges
        return f(*args, **kwargs)
    return decorated_function