from flask import Blueprint, jsonify, request, g
from pydantic import ValidationError
from app.schemas.offline import OfflineRegistrationRequest
from app.services.offline_service import offline_service
from app.middleware.auth import require_roles
from app.api.v1.errors import format_validation_error, internal_error

offline_bp = Blueprint("offline", __name__, url_prefix="/api/v1/offline")

@offline_bp.route("/registrations", methods=["POST"])
@require_roles("OFFLINE_COLLECTOR", "ADMIN")
def offline_register():
    try:
        data = OfflineRegistrationRequest(**(request.get_json() or {}))
        collector_id = g.current_user["id"]
        res = offline_service.register_offline_cash(data, collector_user_id=collector_id)
        return jsonify(res.model_dump()), 201
    except ValidationError as e:
        return jsonify({"error": format_validation_error(e), "details": e.errors()}), 422
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception:
        return internal_error("processing an offline registration")

@offline_bp.route("/summary", methods=["GET"])
@require_roles("OFFLINE_COLLECTOR", "ADMIN")
def collector_summary():
    try:
        collector_id = g.current_user["id"]
        event_id = request.args.get("event_id")
        summary = offline_service.get_collector_summary(collector_id, event_id=event_id)
        return jsonify(summary), 200
    except Exception:
        return internal_error("fetching the collection summary")
