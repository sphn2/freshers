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
@require_roles("ADMIN")
def update_event(event_id):
    try:
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
            is_super_admin = "SUPER_ADMIN" in g.user_roles
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
                # Hide Super Admin accounts from ordinary Admins
                if not is_super_admin and "SUPER_ADMIN" in roles:
                    continue
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
            if data.role == "ADMIN" and "SUPER_ADMIN" not in g.user_roles:
                return jsonify({"error": "Forbidden. Only Super Admin can create Admin accounts."}), 403
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
@require_roles("SUPER_ADMIN")
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

@admin_bp.route("/registrations/<registration_id>/email", methods=["PATCH"])
@require_roles("ADMIN", "EVENT_MANAGER")
def update_registration_email(registration_id):
    try:
        reg = db.execute_one("SELECT * FROM registrations WHERE id = %s", (registration_id,))
        if not reg:
            return jsonify({"error": "Registration not found."}), 404
        if not enforce_event_access(reg["event_id"]):
            return jsonify({"error": "Forbidden. Event not assigned to you."}), 403

        body = request.get_json() or {}
        new_email = str(body.get("email", "")).strip().lower()
        if not new_email or "@" not in new_email or "." not in new_email:
            return jsonify({"error": "Invalid email address provided."}), 400

        existing = db.execute_one(
            "SELECT id FROM registrations WHERE event_id = %s AND LOWER(email) = %s AND id != %s",
            (reg["event_id"], new_email, registration_id)
        )
        if existing:
            return jsonify({"error": "Another registration for this event already uses this email address."}), 400

        old_email = reg["email"]
        now = datetime.now(timezone.utc).isoformat()
        db.execute_write(
            "UPDATE registrations SET email = %s, updated_at = %s WHERE id = %s",
            (new_email, now, registration_id)
        )
        audit_service.log(
            "UPDATE_REGISTRATION_EMAIL",
            "registration",
            registration_id,
            g.current_user["id"],
            {"old_email": old_email, "new_email": new_email, "event_id": reg["event_id"]},
        )
        return jsonify({"message": f"Registration email updated from {old_email} to {new_email}.", "email": new_email}), 200
    except Exception:
        return internal_error("updating registration email")

@admin_bp.route("/registrations/<registration_id>/resend-ticket", methods=["POST"])
@require_roles("ADMIN", "EVENT_MANAGER")
def resend_ticket_email(registration_id):
    try:
        reg = db.execute_one("SELECT * FROM registrations WHERE id = %s", (registration_id,))
        if not reg:
            return jsonify({"error": "Registration not found."}), 404
        if not enforce_event_access(reg["event_id"]):
            return jsonify({"error": "Forbidden. Event not assigned to you."}), 403

        ticket = db.execute_one("SELECT id FROM tickets WHERE registration_id = %s", (registration_id,))
        if not ticket:
            return jsonify({"error": "No ticket has been issued for this registration yet."}), 400

        from app.services.ticket_service import TicketService
        TicketService.resend_ticket_email(ticket["id"], user_id=g.current_user["id"])
        return jsonify({"message": f"Digital ticket pass successfully re-sent to {reg['email']}."}), 200
    except Exception:
        return internal_error("resending ticket email")

@admin_bp.route("/registrations/resend-all-tickets", methods=["POST"])
@require_roles("ADMIN", "EVENT_MANAGER")
def resend_all_tickets():
    try:
        body = request.get_json() or {}
        event_id = body.get("event_id") or request.args.get("event_id")

        if "EVENT_MANAGER" in g.user_roles and not event_id:
            return jsonify({"error": "Event managers must select an assigned event to resend tickets."}), 400
        if event_id and not enforce_event_access(event_id):
            return jsonify({"error": "Forbidden. Event not assigned to you."}), 403

        where_clause = "WHERE r.event_id = %s" if event_id else ""
        params = (event_id,) if event_id else ()

        tickets = db.execute_query(
            f"""SELECT t.id, t.registration_id, r.email
                FROM tickets t
                JOIN registrations r ON t.registration_id = r.id
                {where_clause}""",
            params
        )

        if not tickets:
            return jsonify({"message": "No issued tickets found to resend."}), 200

        from app.services.ticket_service import TicketService
        success_count = 0
        for ticket in tickets:
            try:
                TicketService.resend_ticket_email(ticket["id"], user_id=g.current_user["id"])
                success_count += 1
            except Exception:
                continue

        audit_service.log(
            "RESEND_ALL_TICKETS",
            "event",
            event_id or "ALL",
            g.current_user["id"],
            {"total_tickets": len(tickets), "successful_sends": success_count}
        )

        return jsonify({"message": f"Successfully re-sent ticket pass emails to {success_count} participant(s)."}), 200
    except Exception:
        return internal_error("resending tickets to all participants")

@admin_bp.route("/registrations/<registration_id>/resend-mail", methods=["POST"])
@require_roles("ADMIN", "EVENT_MANAGER")
def resend_any_mail(registration_id):
    try:
        reg = db.execute_one(
            """SELECT r.*, e.title as event_title, e.venue, e.start_time
               FROM registrations r JOIN events e ON r.event_id = e.id
               WHERE r.id = %s""",
            (registration_id,)
        )
        if not reg:
            return jsonify({"error": "Registration not found."}), 404
        if not enforce_event_access(reg["event_id"]):
            return jsonify({"error": "Forbidden. Event not assigned to you."}), 403

        body = request.get_json() or {}
        mail_type = str(body.get("mail_type", "TICKET")).upper()

        sent_messages = []
        from app.services.email_service import email_service
        from app.services.ticket_service import TicketService
        from app.config import config

        if mail_type in ("TICKET", "ALL"):
            ticket = db.execute_one("SELECT id FROM tickets WHERE registration_id = %s", (registration_id,))
            if ticket:
                TicketService.resend_ticket_email(ticket["id"], user_id=g.current_user["id"])
                sent_messages.append("Digital Ticket Pass")
            elif mail_type == "TICKET":
                return jsonify({"error": "No ticket has been issued for this registration yet."}), 400

        if mail_type in ("PAYMENT", "PAYMENT_LINK", "ALL"):
            from app.utils.payment_access import create_access_token
            payment_token, token_hash = create_access_token()
            db.execute_write(
                "UPDATE registrations SET payment_access_token_hash = %s WHERE id = %s",
                (token_hash, registration_id)
            )
            checkout_url = f"{config.APP_URL.rstrip('/')}/checkout/{registration_id}#access_token={payment_token}"
            email_service.send_email(
                recipient=reg["email"],
                subject=f"Registration & Payment Details — {reg['event_title']}",
                template_name="emails/registration_confirmed.html",
                context={
                    "student_name": reg["full_name"],
                    "event_title": reg["event_title"],
                    "ticket_price": reg["ticket_price"],
                    "is_free": float(reg["ticket_price"]) == 0,
                    "ticket_code": None,
                    "roll_number": reg["roll_number"],
                    "department": reg["department"],
                    "venue": reg["venue"],
                    "event_time": reg["start_time"],
                    "checkout_url": checkout_url,
                    "existing_pending": reg["status"] == "PENDING_PAYMENT",
                },
                metadata={"registration_id": registration_id},
            )
            sent_messages.append("Payment/Registration Email")

        if mail_type in ("GATE", "ALL"):
            ticket = db.execute_one("SELECT * FROM tickets WHERE registration_id = %s", (registration_id,))
            if ticket and ticket.get("gate_validated_at"):
                email_service.send_email(
                    recipient=reg["email"],
                    subject=f"Ticket Validated — {reg['event_title']}",
                    template_name="emails/gate_validated.html",
                    context={
                        "student_name": reg["full_name"],
                        "event_title": reg["event_title"],
                        "ticket_code": ticket["ticket_code"],
                        "gate_location": ticket.get("gate_location", "Main Gate"),
                        "validated_at": ticket["gate_validated_at"],
                    },
                    metadata={"registration_id": registration_id, "ticket_id": ticket["id"]},
                )
                sent_messages.append("Gate Entry Email")
            elif mail_type == "GATE":
                return jsonify({"error": "Gate entry has not been validated for this student yet."}), 400

        if mail_type in ("FOOD", "ALL"):
            ticket = db.execute_one("SELECT * FROM tickets WHERE registration_id = %s", (registration_id,))
            food = db.execute_one("SELECT * FROM food_entitlements WHERE ticket_id = %s", (ticket["id"],)) if ticket else None
            if food and food.get("status") == "CLAIMED":
                email_service.send_email(
                    recipient=reg["email"],
                    subject=f"Food Coupon Claimed — {reg['event_title']}",
                    template_name="emails/food_validated.html",
                    context={
                        "student_name": reg["full_name"],
                        "event_title": reg["event_title"],
                        "ticket_code": ticket["ticket_code"],
                        "food_location": food.get("food_location", "Food Counter"),
                        "validated_at": food.get("food_validated_at", ""),
                    },
                    metadata={"registration_id": registration_id, "ticket_id": ticket["id"]},
                )
                sent_messages.append("Food Claim Email")
            elif mail_type == "FOOD":
                return jsonify({"error": "Food coupon has not been claimed for this student yet."}), 400

        if not sent_messages:
            return jsonify({"error": "No matching email type could be dispatched for this registration."}), 400

        return jsonify({"message": f"Successfully re-sent {', '.join(sent_messages)} to {reg['email']}."}), 200
    except Exception:
        return internal_error("resending registration email")

@admin_bp.route("/reports/email-logs", methods=["GET"])
@require_roles("ADMIN", "EVENT_MANAGER")
def report_email_logs():
    try:
        limit = int(request.args.get("limit", 200))
        logs = db.execute_query(
            "SELECT * FROM email_logs ORDER BY created_at DESC LIMIT %s",
            (limit,)
        )
        return jsonify({"email_logs": logs or []}), 200
    except Exception:
        return internal_error("fetching email logs")

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

from app.services.system_settings_service import system_settings_service

@admin_bp.route("/settings/convenience-fee", methods=["GET", "PUT"])
@require_roles("SUPER_ADMIN")
def manage_convenience_fee_settings():
    if request.method == "GET":
        try:
            settings = system_settings_service.get_convenience_fee_settings()
            return jsonify(settings), 200
        except Exception:
            return internal_error("fetching convenience fee settings")
    elif request.method == "PUT":
        try:
            body = request.get_json() or {}
            enabled = body.get("enabled")
            amount = body.get("amount")
            roles = getattr(g, "user_roles", [])
            updated = system_settings_service.update_convenience_fee_settings(
                enabled=enabled if isinstance(enabled, bool) else None,
                amount=float(amount) if amount is not None else None,
                roles=roles,
            )
            return jsonify({
                "message": "GST & Convenience fee settings updated successfully.",
                "settings": updated,
            }), 200
        except PermissionError as e:
            return jsonify({"error": str(e)}), 403
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        except Exception:
            return internal_error("updating convenience fee settings")
