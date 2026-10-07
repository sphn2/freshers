from flask import Blueprint, jsonify, request, g
from app.services.event_service import event_service
from app.services.registration_service import registration_service
from app.middleware.auth import require_auth
from app.middleware.rate_limit import rate_limit
from app.api.v1.errors import internal_error

events_bp = Blueprint("events", __name__, url_prefix="/api/v1/events")

@events_bp.route("", methods=["GET"])
def list_events():
    status = request.args.get("status", "PUBLISHED").upper()
    if status not in {"PUBLISHED", "LIVE"}:
        return jsonify({"error": "Public event status must be PUBLISHED or LIVE."}), 400
    events = event_service.get_all_events(status_filter=status)
    return jsonify({"events": events}), 200

@events_bp.route("/<slug>", methods=["GET"])
def get_event_by_slug(slug):
    event = event_service.get_public_event_by_slug(slug)
    if not event:
        return jsonify({"error": "Event not found."}), 404
    return jsonify(event), 200

@events_bp.route("/<event_id>/autofill/<roll_number>", methods=["GET"])
@require_auth
@rate_limit(10, 60)
def autofill_student(event_id, roll_number):
    if "STUDENT" not in g.user_roles:
        return jsonify({"error": "Only students can use registration auto-fill."}), 403
    try:
        data = registration_service.autofill_student_lookup(
            event_id, roll_number, user_email=g.current_user.get("email")
        )
        return jsonify(data.model_dump()), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception:
        return internal_error("looking up a student directory record")
