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

from datetime import datetime, timezone
from werkzeug.security import generate_password_hash
from app.services.audit_service import audit_service

@admin_bp.route("/staff-accounts", methods=["GET", "POST"])
@require_roles("ADMIN", "SUPER_ADMIN")
def handle_staff_accounts():
    if request.method == "GET":
        try:
            profiles = db.execute_query(
                """SELECT p.id, p.full_name, p.email, (p.pin_hash IS NOT NULL AND p.pin_hash != '') as has_pin, p.created_at
                   FROM profiles p
                   ORDER BY p.created_at DESC"""
            )
            user_roles_rows = db.execute_query(
                """SELECT ur.user_id, r.name as role
                   FROM user_roles ur
                   JOIN roles r ON ur.role_id = r.id"""
            )
            user_roles_map = {}
            for r in user_roles_rows:
                user_roles_map.setdefault(r["user_id"], []).append(r["role"])

            staff_list = []
            valid_roles = ('SUPER_ADMIN', 'ADMIN', 'EVENT_MANAGER', 'OFFLINE_COLLECTOR', 'GATE_STAFF', 'FOOD_STAFF')
            for p in profiles:
                roles = user_roles_map.get(p["id"], [])
                if any(r in valid_roles for r in roles):
                    primary_role = "STUDENT"
                    for r in valid_roles:
                        if r in roles:
                            primary_role = r
                            break
                    staff_list.append({
                        "id": p["id"],
                        "full_name": p["full_name"],
                        "email": p["email"],
                        "role": primary_role,
                        "roles": roles,
                        "has_pin": bool(p["has_pin"]),
                        "created_at": p["created_at"],
                    })
            return jsonify({"staff_accounts": staff_list}), 200
        except Exception:
            return internal_error("fetching staff accounts")

    elif request.method == "POST":
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

@admin_bp.route("/staff-accounts/<user_id>/roles", methods=["PATCH"])
@require_roles("SUPER_ADMIN")
def update_staff_roles(user_id):
    try:
        body = request.get_json() or {}
        target_role = str(body.get("role", "")).strip().upper()
        enabled = bool(body.get("enabled", False))

        allowed_roles = {'OFFLINE_COLLECTOR', 'GATE_STAFF', 'FOOD_STAFF', 'EVENT_MANAGER', 'ADMIN'}
        if target_role not in allowed_roles:
            return jsonify({"error": f"Invalid role toggle. Allowed roles: {', '.join(sorted(allowed_roles))}"}), 400

        target = db.execute_one("SELECT id, full_name, email FROM profiles WHERE id = %s", (user_id,))
        if not target:
            return jsonify({"error": "Staff profile not found."}), 404

        role_obj = db.execute_one("SELECT id FROM roles WHERE name = %s", (target_role,))
        if not role_obj:
            return jsonify({"error": f"Role {target_role} does not exist."}), 404

        now = datetime.now(timezone.utc).isoformat()
        if enabled:
            db.execute_write(
                """INSERT INTO user_roles (id, user_id, role_id, created_at)
                   VALUES (%s, %s, %s, %s)
                   ON CONFLICT(user_id, role_id) DO NOTHING""",
                (str(uuid.uuid4()), user_id, role_obj["id"], now)
            )
        else:
            db.execute_write(
                "DELETE FROM user_roles WHERE user_id = %s AND role_id = %s",
                (user_id, role_obj["id"])
            )

        updated_roles_rows = db.execute_query(
            """SELECT r.name FROM user_roles ur
               JOIN roles r ON ur.role_id = r.id
               WHERE ur.user_id = %s""",
            (user_id,)
        )
        updated_roles = [r["name"] for r in updated_roles_rows]

        audit_service.log(
            "UPDATE_STAFF_PRIVILEGES",
            "profile",
            user_id,
            g.current_user["id"],
            {"staff_name": target["full_name"], "toggled_role": target_role, "enabled": enabled, "roles": updated_roles},
        )
        return jsonify({
            "message": f"Privilege '{target_role.replace('_', ' ')}' {'granted to' if enabled else 'revoked from'} {target['full_name']}.",
            "roles": updated_roles
        }), 200
    except Exception:
        return internal_error("updating staff privileges")

@admin_bp.route("/staff-accounts/<user_id>/pin", methods=["POST", "PATCH"])
@require_roles("ADMIN", "SUPER_ADMIN")
def set_staff_pin(user_id):
    try:
        body = request.get_json() or {}
        pin = str(body.get("pin", "")).strip()
        if len(pin) != 6 or not pin.isdigit():
            return jsonify({"error": "PIN must be exactly 6 digits."}), 400
        
        target = db.execute_one("SELECT id, full_name, email FROM profiles WHERE id = %s", (user_id,))
        if not target:
            return jsonify({"error": "Staff profile not found."}), 404

        pin_hash = generate_password_hash(pin)
        now = datetime.now(timezone.utc).isoformat()
        db.execute_write(
            "UPDATE profiles SET pin_hash = %s, updated_at = %s WHERE id = %s",
            (pin_hash, now, user_id),
        )
        audit_service.log(
            "SET_STAFF_PIN",
            "profile",
            user_id,
            g.current_user["id"],
            {"staff_name": target["full_name"], "staff_email": target["email"]},
        )
        return jsonify({"message": f"6-Digit PIN successfully updated for {target['full_name']}."}), 200
    except Exception:
        return internal_error("setting staff PIN")

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
