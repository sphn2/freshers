from flask import Blueprint, jsonify, request, g
from pydantic import ValidationError
from app.schemas.offline import OfflineRegistrationRequest
from app.services.offline_service import offline_service
from app.middleware.auth import require_roles
from app.api.v1.errors import format_validation_error, internal_error
from app.db import db

offline_bp = Blueprint("offline", __name__, url_prefix="/api/v1/offline")

def _manager_can_access_event(event_id: str, user_id: str) -> bool:
    return db.execute_one(
        """SELECT event_id FROM event_managers
           WHERE event_id = %s AND user_id = %s
           UNION
           SELECT id AS event_id FROM events
           WHERE id = %s AND created_by = %s""",
        (event_id, user_id, event_id, user_id),
    ) is not None

@offline_bp.route("/registrations", methods=["POST"])
@require_roles("OFFLINE_COLLECTOR", "SUPER_ADMIN")
def offline_register():
    try:
        data = OfflineRegistrationRequest(**(request.get_json() or {}))
        if (
            "EVENT_MANAGER" in g.user_roles
            and "ADMIN" not in g.user_roles
            and "SUPER_ADMIN" not in g.user_roles
            and not _manager_can_access_event(data.event_id, g.current_user["id"])
        ):
            return jsonify({"error": "Forbidden. Event not assigned to you."}), 403
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
@require_roles("OFFLINE_COLLECTOR", "SUPER_ADMIN")
def collector_summary():
    try:
        collector_id = g.current_user["id"]
        event_id = request.args.get("event_id")
        if (
            event_id
            and "EVENT_MANAGER" in g.user_roles
            and "ADMIN" not in g.user_roles
            and "SUPER_ADMIN" not in g.user_roles
            and not _manager_can_access_event(event_id, collector_id)
        ):
            return jsonify({"error": "Forbidden. Event not assigned to you."}), 403
        summary = offline_service.get_collector_summary(collector_id, event_id=event_id)
        return jsonify(summary), 200
    except Exception:
        return internal_error("fetching the collection summary")
