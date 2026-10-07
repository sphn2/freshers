from flask import Blueprint, jsonify, g

from app.middleware.auth import require_auth

auth_bp = Blueprint("auth", __name__, url_prefix="/api/v1/auth")


@auth_bp.route("/me", methods=["GET"])
@require_auth
def current_user():
    """Return backend-authorized identity and roles for the frontend session."""
    return jsonify({"user": g.current_user, "roles": g.user_roles}), 200
