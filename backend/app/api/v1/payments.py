from flask import Blueprint, jsonify, request, g
from pydantic import ValidationError
from app.schemas.payment import CreateOrderRequest, VerifyPaymentRequest
from app.services.payment_service import payment_service
from app.middleware.auth import auth_middleware
from app.middleware.rate_limit import rate_limit
from app.db import db
from app.api.v1.errors import format_validation_error, internal_error
from app.utils.payment_access import registration_token_matches

from app.services.ticket_service import ticket_service
from app.services.gateways.factory import gateway_factory

payments_bp = Blueprint("payments", __name__, url_prefix="/api/v1")

def _can_access_registration(registration_id: str, token: str | None = None) -> bool:
    registration = db.execute_one("SELECT user_id FROM registrations WHERE id = %s", (registration_id,))
    if not registration:
        return False
    current_user = getattr(g, "current_user", None)
    if current_user and (
        "ADMIN" in getattr(g, "user_roles", [])
        or registration.get("user_id") == current_user["id"]
    ):
        return True
    
    candidate_token = (
        token
        or request.headers.get("X-Registration-Token")
        or request.args.get("token")
        or request.args.get("access_token")
    )
    return registration_token_matches(
        registration_id,
        candidate_token,
    )

@payments_bp.route("/payments/create-order", methods=["POST"])
@rate_limit(60, 60)
def create_order():
    try:
        auth_middleware()
        data = CreateOrderRequest(**(request.get_json() or {}))
        candidate_token = (
            data.registration_token
            or request.headers.get("X-Registration-Token")
            or request.args.get("token")
            or request.args.get("access_token")
        )
        if not _can_access_registration(data.registration_id, candidate_token):
            return jsonify({"error": "Forbidden. You cannot pay for this registration."}), 403
        res = payment_service.create_order(data.registration_id, registration_token=candidate_token)
        return jsonify(res), 200
    except ValidationError as e:
        return jsonify({"error": format_validation_error(e), "details": e.errors()}), 422
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception:
        return internal_error("creating a payment order")

@payments_bp.route("/payments/verify", methods=["POST"])
@rate_limit(60, 60)
def verify_payment():
    try:
        auth_middleware()
        data = VerifyPaymentRequest(**(request.get_json() or {}))
        candidate_token = (
            data.registration_token
            or request.headers.get("X-Registration-Token")
            or request.args.get("token")
            or request.args.get("access_token")
        )
        if not _can_access_registration(data.registration_id, candidate_token):
            return jsonify({"error": "Forbidden. You cannot verify this registration."}), 403
        res = payment_service.verify_payment(
            registration_id=data.registration_id,
            razorpay_order_id=data.razorpay_order_id,
            razorpay_payment_id=data.razorpay_payment_id,
            razorpay_signature=data.razorpay_signature,
            order_id=data.order_id,
            payment_id=data.payment_id,
            signature=data.signature,
            gateway=data.gateway,
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

@payments_bp.route("/webhooks/cashfree", methods=["POST"])
@rate_limit(120, 60)
def cashfree_webhook():
    try:
        raw_body = request.get_data()
        signature = request.headers.get("x-webhook-signature")
        timestamp = request.headers.get("x-webhook-timestamp")
        res = payment_service.process_cashfree_webhook(raw_body, signature, timestamp)
        return jsonify(res), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception:
        return internal_error("processing a Cashfree webhook")


def _mask_email(email: str) -> str:
    if not email or "@" not in email:
        return "your registered email"
    name, domain = email.split("@", 1)
    if len(name) <= 2:
        masked_name = name[0] + "*"
    else:
        visible_prefix = name[:2]
        visible_suffix = name[-1]
        mask_len = min(max(len(name) - 3, 2), 6)
        masked_name = visible_prefix + ("*" * mask_len) + visible_suffix
    return f"{masked_name}@{domain}"


@payments_bp.route("/payments/reconcile-and-resend", methods=["POST"])
@rate_limit(15, 60)
def reconcile_and_resend():
    """
    Secure self-service verification for students.
    Checks payment status with gateways (Razorpay/Cashfree).
    If paid, fulfills and sends the ticket EXCLUSIVELY to the student's registered email.
    NEVER leaks QR codes or ticket tokens to the public screen.
    """
    try:
        body = request.get_json() or {}
        roll_number = str(body.get("roll_number", "")).strip().upper()
        if not roll_number or len(roll_number) < 4:
            return jsonify({"error": "A valid roll number is required."}), 400

        # Find registration by roll number
        reg = db.execute_one(
            "SELECT * FROM registrations WHERE roll_number = %s ORDER BY created_at DESC",
            (roll_number,),
        )
        if not reg:
            return jsonify({
                "status": "NOT_FOUND",
                "message": f"No registration record found for roll number '{roll_number}'. Please submit the event registration form first."
            }), 200

        masked = _mask_email(reg["email"])

        # Case 1: Registration is already marked PAID
        if reg["status"] in ("PAID", "OFFLINE_PAID"):
            ticket = db.execute_one("SELECT * FROM tickets WHERE registration_id = %s", (reg["id"],))
            if not ticket:
                ticket = ticket_service.issue_ticket(reg["id"], send_notification=True)
            else:
                full_ticket = ticket_service.get_ticket_by_id(ticket["id"])
                ticket_service.send_ticket_email(full_ticket)

            return jsonify({
                "status": "SUCCESS",
                "message": f"Payment is confirmed! Your digital ticket pass and QR code have been dispatched to your email: {masked}.",
                "masked_email": masked,
                "student_name": reg["full_name"],
            }), 200

        # Case 2: Registration is PENDING_PAYMENT -> Check payment gateways in real-time
        payments = db.execute_query(
            "SELECT * FROM payments WHERE registration_id = %s AND status IN ('CREATED', 'SUPERSEDED', 'FAILED') ORDER BY created_at DESC",
            (reg["id"],),
        )

        verified_payment = None
        for p in payments:
            gw_name = p.get("gateway") or p.get("payment_method") or "RAZORPAY"
            order_ref = p.get("gateway_order_id") or p.get("razorpay_order_id")
            if not order_ref:
                continue
            try:
                gw = gateway_factory.get_gateway(gw_name)
                verification = gw.verify_payment(p, {"order_id": order_ref})
                if verification.get("verified"):
                    verified_payment = (p, verification)
                    break
            except Exception:
                continue

        if verified_payment:
            p, verification = verified_payment
            payment_service._fulfill_payment(p, verification["payment_id"], verification["signature"])
            return jsonify({
                "status": "SUCCESS",
                "message": f"Payment verified from gateway! Your entry ticket and QR pass have been issued and sent to your email: {masked}.",
                "masked_email": masked,
                "student_name": reg["full_name"],
            }), 200

        return jsonify({
            "status": "PENDING",
            "message": "Payment has not been completed yet or is awaiting bank confirmation. If money was debited, please wait 1-2 minutes and click again.",
            "masked_email": masked,
        }), 200

    except Exception:
        return internal_error("checking payment status")
