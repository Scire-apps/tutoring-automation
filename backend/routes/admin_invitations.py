from flask import Blueprint, jsonify

# Legacy module kept for import safety; endpoints removed as invitations are deprecated
admin_invitations_bp = Blueprint('admin_invitations', __name__)

@admin_invitations_bp.route('/api/admin/invitations', methods=['GET','POST','DELETE'])
def invitations_removed():
    return jsonify({'error': 'Admin invitations feature removed'}), 410