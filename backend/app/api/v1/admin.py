import uuid
from flask import Blueprint, jsonify, request, g, Response
from pydantic import ValidationError
from app.schemas.event import EventCreate, EventUpdate
from app.schemas.staff_account import StaffAccountCreate
from app.services.event_service import event_service
from app.services.staff_account_service import StaffAccountError, staff_account_service
from app.services.report_service import report_service
from app.middleware.auth import require_roles
from app.db import db
from app.api.v1.errors import format_validation_error, internal_error

admin_bp = Blueprint("admin", __name__, url_prefix="/api/v1/admin")

def get_manager_assigned_event_ids(user_id: str) -> list:
    """Helper to fetch event IDs assigned to an EVENT_MANAGER."""
    rows = db.execute_query(
        "SELECT event_id FROM event_managers WHERE user_id = %s",
        (user_id,)
    )
    assigned = [r["event_id"] for r in rows] if rows else []
    # Also include events created by this manager
    created_rows = db.execute_query(
        "SELECT id FROM events WHERE created_by = %s",
        (user_id,)
    )
    if created_rows:
        assigned.extend([r["id"] for r in created_rows])
    return list(set(assigned))

def enforce_event_access(event_id: str):
    """If user is EVENT_MANAGER, ensures the event_id is within their assigned scope."""
    if "ADMIN" in g.user_roles:
        return True
    if "EVENT_MANAGER" in g.user_roles:
        assigned = get_manager_assigned_event_ids(g.current_user["id"])
        if event_id not in assigned:
            return False
    return True

@admin_bp.route("/events", methods=["POST"])
@require_roles("ADMIN")
def create_event():
    try:
        data = EventCreate(**(request.get_json() or {}))
        user_id = g.current_user["id"]
        event = event_service.create_event(data, created_by_user_id=user_id)
        return jsonify({"message": "Event created successfully.", "event": event}), 201
    except ValidationError as e:
        return jsonify({"error": format_validation_error(e), "details": e.errors()}), 422
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception:
        return internal_error("creating an event")

@admin_bp.route("/events", methods=["GET"])
@require_roles("ADMIN", "EVENT_MANAGER")
def list_all_events():
    """List events for management. EVENT_MANAGER sees assigned events only."""
    try:
        status = request.args.get("status")
        events = event_service.get_all_events(status_filter=status)
        if "ADMIN" not in g.user_roles and "EVENT_MANAGER" in g.user_roles:
            assigned = get_manager_assigned_event_ids(g.current_user["id"])
            events = [e for e in events if e["id"] in assigned]
        return jsonify({"events": events}), 200
    except Exception:
        return internal_error("fetching events")

@admin_bp.route("/events/<event_id>", methods=["PATCH"])
@require_roles("ADMIN", "EVENT_MANAGER")
def update_event(event_id):
    try:
        if not enforce_event_access(event_id):
            return jsonify({"error": "Forbidden. Event not assigned to you."}), 403
        data = EventUpdate(**(request.get_json() or {}))
        user_id = g.current_user["id"]
        event = event_service.update_event(event_id, data, user_id=user_id)
        return jsonify({"message": "Event updated successfully.", "event": event}), 200
    except ValidationError as e:
        return jsonify({"error": format_validation_error(e), "details": e.errors()}), 422
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception:
        return internal_error("updating an event")

@admin_bp.route("/staff-accounts", methods=["POST"])
@require_roles("ADMIN")
def create_staff_account():
    try:
        data = StaffAccountCreate(**(request.get_json() or {}))
        account = staff_account_service.create_account(
            data,
            created_by=g.current_user["id"],
        )
        return jsonify({"message": "Staff account created successfully.", "account": account}), 201
    except ValidationError as e:
        return jsonify({"error": format_validation_error(e), "details": e.errors()}), 422
    except StaffAccountError as e:
        return jsonify({"error": str(e)}), e.status_code
    except Exception:
        return internal_error("creating a staff account")

@admin_bp.route("/dashboard", methods=["GET"])
@require_roles("ADMIN", "EVENT_MANAGER")
def get_dashboard_metrics():
    try:
        event_id = request.args.get("event_id")
        if "EVENT_MANAGER" in g.user_roles and not event_id:
            return jsonify({"error": "Event managers must select an assigned event."}), 400
        if event_id and not enforce_event_access(event_id):
            return jsonify({"error": "Forbidden. Event not assigned to you."}), 403
        metrics = report_service.get_admin_dashboard_metrics(event_id=event_id)
        return jsonify(metrics), 200
    except Exception:
        return internal_error("fetching dashboard metrics")

@admin_bp.route("/reports/registrations", methods=["GET"])
@require_roles("ADMIN", "EVENT_MANAGER")
def report_registrations():
    try:
        event_id = request.args.get("event_id")
        if "EVENT_MANAGER" in g.user_roles and not event_id:
            return jsonify({"error": "Event managers must select an assigned event."}), 400
        if event_id and not enforce_event_access(event_id):
            return jsonify({"error": "Forbidden. Event not assigned to you."}), 403
        limit = int(request.args.get("limit", 200))
        rows = report_service.get_registrations_report(event_id=event_id, limit=limit)
        return jsonify({"registrations": rows}), 200
    except Exception:
        return internal_error("building the registration report")

@admin_bp.route("/reports/registrations/csv", methods=["GET"])
@require_roles("ADMIN", "EVENT_MANAGER")
def export_csv():
    try:
        event_id = request.args.get("event_id")
        if "EVENT_MANAGER" in g.user_roles and not event_id:
            return jsonify({"error": "Event managers must select an assigned event."}), 400
        if event_id and not enforce_event_access(event_id):
            return jsonify({"error": "Forbidden. Event not assigned to you."}), 403
        csv_data = report_service.export_registrations_csv(event_id=event_id)
        filename = f"sphoorthy_registrations_{event_id or 'all'}.csv"
        return Response(
            csv_data,
            mimetype="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception:
        return internal_error("exporting the registration report")

@admin_bp.route("/reports/payments", methods=["GET"])
@require_roles("ADMIN", "EVENT_MANAGER")
def report_payments():
    try:
        event_id = request.args.get("event_id")
        if "EVENT_MANAGER" in g.user_roles and not event_id:
            return jsonify({"error": "Event managers must select an assigned event."}), 400
        if event_id and not enforce_event_access(event_id):
            return jsonify({"error": "Forbidden. Event not assigned to you."}), 403
        limit = int(request.args.get("limit", 200))
        rows = report_service.get_payments_report(event_id=event_id, limit=limit)
        return jsonify({"payments": rows}), 200
    except Exception:
        return internal_error("building the payments report")

@admin_bp.route("/reports/entries", methods=["GET"])
@require_roles("ADMIN", "EVENT_MANAGER")
def report_entries():
    try:
        event_id = request.args.get("event_id")
        if "EVENT_MANAGER" in g.user_roles and not event_id:
            return jsonify({"error": "Event managers must select an assigned event."}), 400
        if event_id and not enforce_event_access(event_id):
            return jsonify({"error": "Forbidden. Event not assigned to you."}), 403
        limit = int(request.args.get("limit", 200))
        rows = report_service.get_gate_entries_report(event_id=event_id, limit=limit)
        return jsonify({"entries": rows}), 200
    except Exception:
        return internal_error("building the gate entries report")

@admin_bp.route("/reports/offline", methods=["GET"])
@require_roles("ADMIN", "EVENT_MANAGER")
def report_offline():
    try:
        event_id = request.args.get("event_id")
        if "EVENT_MANAGER" in g.user_roles and not event_id:
            return jsonify({"error": "Event managers must select an assigned event."}), 400
        if event_id and not enforce_event_access(event_id):
            return jsonify({"error": "Forbidden. Event not assigned to you."}), 403
        limit = int(request.args.get("limit", 200))
        rows = report_service.get_offline_collections_report(event_id=event_id, limit=limit)
        return jsonify({"offline_collections": rows}), 200
    except Exception:
        return internal_error("building the offline collections report")

@admin_bp.route("/audit-logs", methods=["GET"])
@require_roles("ADMIN")
def get_audit_logs():
    try:
        limit = int(request.args.get("limit", 100))
        logs = report_service.get_audit_logs(limit=limit)
        return jsonify({"audit_logs": logs}), 200
    except Exception:
        return internal_error("fetching audit logs")
