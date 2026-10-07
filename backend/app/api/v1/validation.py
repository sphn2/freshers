from flask import Blueprint, jsonify, request, g
from pydantic import ValidationError
from app.schemas.validation import GateValidationRequest, FoodValidationRequest
from app.services.validation_service import validation_service
from app.middleware.auth import require_roles
from app.api.v1.errors import internal_error
from app.db import db

validation_bp = Blueprint("validation", __name__, url_prefix="/api/v1/validation")


def _manager_can_access_event(event_id: str, user_id: str) -> bool:
    return db.execute_one(
        """SELECT event_id FROM event_managers
           WHERE event_id = %s AND user_id = %s
           UNION
           SELECT id AS event_id FROM events
           WHERE id = %s AND created_by = %s""",
        (event_id, user_id, event_id, user_id),
    ) is not None


@validation_bp.route("/gate", methods=["POST"])
@require_roles("GATE_STAFF", "ADMIN", "EVENT_MANAGER")
def validate_gate():
    try:
        data = GateValidationRequest(**(request.get_json() or {}))
        if (
            "EVENT_MANAGER" in g.user_roles
            and "ADMIN" not in g.user_roles
            and not _manager_can_access_event(data.event_id, g.current_user["id"])
        ):
            return jsonify({"error": "Forbidden. Event not assigned to you."}), 403
        staff_id = g.current_user["id"]
        res = validation_service.validate_gate(data, staff_user_id=staff_id)
        return jsonify(res.model_dump()), 200
    except ValidationError as e:
        return jsonify({"error": "Validation error", "details": e.errors()}), 422
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception:
        return internal_error("validating gate entry")

@validation_bp.route("/food", methods=["POST"])
@require_roles("FOOD_STAFF", "ADMIN", "EVENT_MANAGER")
def validate_food():
    try:
        data = FoodValidationRequest(**(request.get_json() or {}))
        if (
            "EVENT_MANAGER" in g.user_roles
            and "ADMIN" not in g.user_roles
            and not _manager_can_access_event(data.event_id, g.current_user["id"])
        ):
            return jsonify({"error": "Forbidden. Event not assigned to you."}), 403
        staff_id = g.current_user["id"]
        res = validation_service.validate_food(data, staff_user_id=staff_id)
        return jsonify(res.model_dump()), 200
    except ValidationError as e:
        return jsonify({"error": "Validation error", "details": e.errors()}), 422
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception:
        return internal_error("validating food entitlement")
