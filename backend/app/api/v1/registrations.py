from flask import Blueprint, jsonify, request, g
from pydantic import ValidationError
from app.schemas.registration import RegistrationCreate
from app.services.registration_service import registration_service
from app.middleware.rate_limit import rate_limit
from app.middleware.auth import auth_middleware
from app.api.v1.errors import internal_error

registrations_bp = Blueprint("registrations", __name__, url_prefix="/api/v1")

@registrations_bp.route("/events/<event_id>/register", methods=["POST"])
@rate_limit(8, 60)
def register_student(event_id):
    try:
        body = request.get_json() or {}
        body["event_id"] = event_id
        data = RegistrationCreate(**body)
        
        registration = registration_service.register_student(data)
        payment_token = registration.pop("payment_token", None)
        existing_pending = registration.pop("existing_pending", False)
        payment_link_sent = registration.pop("payment_link_sent", False)
        if existing_pending and not payment_link_sent:
            return jsonify({
                "error": "Your earlier booking is still pending, but its payment email could not be delivered. Please check your email address or contact the event desk."
            }), 503
        
        return jsonify({
            "message": (
                "A payment link has been sent to your email for your existing pending registration."
                if existing_pending
                else "Registration created successfully."
            ),
            "registration": registration,
            "payment_token": payment_token,
            "existing_pending": existing_pending,
            "payment_link_sent": payment_link_sent,
        }), 200 if existing_pending else 201
    except ValidationError as e:
        return jsonify({"error": "Validation error", "details": e.errors()}), 422
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception:
        return internal_error("creating a registration")


@registrations_bp.route(
    "/registrations/<registration_id>/payment-link-email",
    methods=["POST"],
)
@rate_limit(4, 60)
def send_payment_link_email(registration_id):
    try:
        auth_middleware()
        token = request.headers.get("X-Registration-Token", "")
        sent = registration_service.send_payment_link_email(
            registration_id,
            token,
            user_id=g.current_user["id"] if g.current_user else None,
            roles=getattr(g, "user_roles", []),
        )
        if not sent:
            return jsonify({"error": "Could not send the payment email. You can still pay on this page."}), 503
        return jsonify({"message": "Payment link email sent."}), 200
    except PermissionError as e:
        return jsonify({"error": str(e)}), 403
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception:
        return internal_error("sending a payment link email")
