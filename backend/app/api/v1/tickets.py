from flask import Blueprint, jsonify, request, g
from app.services.ticket_service import ticket_service
from app.middleware.auth import auth_middleware, require_auth, require_roles
from app.api.v1.errors import internal_error
from app.utils.payment_access import registration_token_matches, ticket_token_matches

tickets_bp = Blueprint("tickets", __name__, url_prefix="/api/v1/tickets")

@tickets_bp.route("/<ticket_id>", methods=["GET"])
def get_ticket(ticket_id):
    auth_middleware()
    ticket = ticket_service.get_ticket_by_id(ticket_id)
    if not ticket:
        return jsonify({"error": f"Ticket '{ticket_id}' not found."}), 404
    current_user = getattr(g, "current_user", None)
    authorized = bool(
        current_user
        and ticket_service.can_access(ticket, current_user["id"], getattr(g, "user_roles", []))
    ) or registration_token_matches(
        ticket["registration_id"],
        request.headers.get("X-Registration-Token"),
    ) or ticket_token_matches(
        ticket_id,
        request.headers.get("X-Ticket-Token"),
    )
    if not authorized:
        return jsonify({"error": "Forbidden. You cannot view this ticket."}), 403
    ticket.pop("public_access_token_hash", None)
    return jsonify({"ticket": ticket}), 200

@tickets_bp.route("/<ticket_id>/resend", methods=["POST"])
@require_auth
def resend_ticket_email(ticket_id):
    try:
        user_id = g.current_user["id"]
        ticket = ticket_service.get_ticket_by_id(ticket_id)
        if not ticket or not ticket_service.can_access(ticket, user_id, g.user_roles):
            return jsonify({"error": "Forbidden. You cannot resend this ticket."}), 403
        success = ticket_service.resend_ticket_email(ticket_id, user_id=user_id)
        if success:
            return jsonify({"message": "Ticket email sent successfully."}), 200
        return jsonify({"error": "Failed sending ticket email."}), 500
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception:
        return internal_error("resending a ticket")

@tickets_bp.route("/<ticket_id>/reissue", methods=["POST"])
@require_roles("ADMIN", "EVENT_MANAGER")
def reissue_ticket(ticket_id):
    try:
        req_data = request.get_json() or {}
        reason = req_data.get("reason", "Administrative reissue request")
        user_id = g.current_user["id"]
        existing = ticket_service.get_ticket_by_id(ticket_id)
        if not existing or not ticket_service.can_access(existing, user_id, g.user_roles):
            return jsonify({"error": "Forbidden. Ticket event is not assigned to you."}), 403
        ticket = ticket_service.reissue_ticket(ticket_id, reason=reason, user_id=user_id)
        return jsonify({"message": "Ticket reissued successfully.", "ticket": ticket}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception:
        return internal_error("reissuing a ticket")
