from flask import Blueprint, jsonify, request, g
from pydantic import ValidationError
from app.schemas.payment import CreateOrderRequest, VerifyPaymentRequest
from app.services.payment_service import payment_service
from app.middleware.auth import auth_middleware
from app.middleware.rate_limit import rate_limit
from app.db import db
from app.api.v1.errors import format_validation_error, internal_error
from app.utils.payment_access import registration_token_matches

payments_bp = Blueprint("payments", __name__, url_prefix="/api/v1")

def _can_access_registration(registration_id: str) -> bool:
    registration = db.execute_one("SELECT user_id FROM registrations WHERE id = %s", (registration_id,))
    if not registration:
        return False
    current_user = getattr(g, "current_user", None)
    if current_user and (
        "ADMIN" in getattr(g, "user_roles", [])
        or registration.get("user_id") == current_user["id"]
    ):
        return True
    return registration_token_matches(
        registration_id,
        request.headers.get("X-Registration-Token"),
    )

@payments_bp.route("/payments/create-order", methods=["POST"])
@rate_limit(10, 60)
def create_order():
    try:
        auth_middleware()
        data = CreateOrderRequest(**(request.get_json() or {}))
        if not _can_access_registration(data.registration_id):
            return jsonify({"error": "Forbidden. You cannot pay for this registration."}), 403
        res = payment_service.create_order(data.registration_id)
        return jsonify(res), 200
    except ValidationError as e:
        return jsonify({"error": format_validation_error(e), "details": e.errors()}), 422
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception:
        return internal_error("creating a payment order")

@payments_bp.route("/payments/verify", methods=["POST"])
@rate_limit(10, 60)
def verify_payment():
    try:
        auth_middleware()
        data = VerifyPaymentRequest(**(request.get_json() or {}))
        if not _can_access_registration(data.registration_id):
            return jsonify({"error": "Forbidden. You cannot verify this registration."}), 403
        res = payment_service.verify_payment(
            registration_id=data.registration_id,
            razorpay_order_id=data.razorpay_order_id,
            razorpay_payment_id=data.razorpay_payment_id,
            razorpay_signature=data.razorpay_signature
        )
        return jsonify(res), 200
    except ValidationError as e:
        return jsonify({"error": format_validation_error(e), "details": e.errors()}), 422
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception:
        return internal_error("verifying a payment")

@payments_bp.route("/webhooks/razorpay", methods=["POST"])
@rate_limit(120, 60)
def razorpay_webhook():
    try:
        raw_body = request.get_data()
        signature_header = request.headers.get("X-Razorpay-Signature")
        res = payment_service.process_webhook(raw_body, signature_header)
        return jsonify(res), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception:
        return internal_error("processing a Razorpay webhook")
