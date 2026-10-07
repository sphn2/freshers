import hashlib
import hmac
import json
import uuid
from datetime import datetime, timezone

import razorpay
from flask import current_app

from app.config import config
from app.db import db
from app.services.audit_service import audit_service
from app.services.ticket_service import ticket_service
from app.services.email_service import email_service
from app.utils.payment_access import create_access_token


class PaymentService:
    @staticmethod
    def _get_razorpay_client():
        if not config.RAZORPAY_KEY_ID or not config.RAZORPAY_KEY_SECRET:
            raise ValueError("Online payments are not configured.")
        return razorpay.Client(auth=(config.RAZORPAY_KEY_ID, config.RAZORPAY_KEY_SECRET))

    @staticmethod
    def create_order(registration_id: str):
        reg = db.execute_one(
            """SELECT r.*, e.allow_online FROM registrations r
               JOIN events e ON e.id = r.event_id WHERE r.id = %s""",
            (registration_id,),
        )
        if not reg:
            raise ValueError("Registration not found.")
        if not reg.get("allow_online"):
            raise ValueError("Online payment is disabled for this event.")
        if reg["status"] in ("PAID", "OFFLINE_PAID"):
            ticket = db.execute_one("SELECT id FROM tickets WHERE registration_id = %s", (registration_id,))
            if not ticket:
                ticket = ticket_service.issue_ticket(registration_id)
            return {"already_paid": True, "ticket_id": ticket["id"] if ticket else None, "message": "Registration is already paid."}
        if reg["status"] != "PENDING_PAYMENT":
            raise ValueError("This registration cannot be paid online.")

        existing = db.execute_one(
            "SELECT * FROM payments WHERE registration_id = %s AND status = 'CREATED' ORDER BY created_at DESC",
            (registration_id,),
        )
        if existing:
            return {"order_id": existing["razorpay_order_id"], "amount": float(existing["amount"]), "currency": "INR", "key_id": config.RAZORPAY_KEY_ID, "registration_id": registration_id}

        amount_in_paise = int(round(float(reg["ticket_price"]) * 100))
        if current_app.config.get("TESTING"):
            order_id = f"order_test_{uuid.uuid4().hex[:12]}"
        else:
            try:
                order = PaymentService._get_razorpay_client().order.create({
                    "amount": amount_in_paise,
                    "currency": "INR",
                    "receipt": f"reg_{registration_id[:16]}",
                    "notes": {"registration_id": registration_id},
                })
                order_id = order["id"]
            except Exception as exc:
                audit_service.log("PAYMENT_ORDER_FAILED", "registration", registration_id, details={"error": str(exc)})
                raise ValueError("Unable to create the payment order. Please retry shortly.") from exc

        now = datetime.now(timezone.utc).isoformat()
        db.execute_write(
            """INSERT INTO payments (id, registration_id, razorpay_order_id, amount, currency, status, payment_method, created_at, updated_at)
               VALUES (%s, %s, %s, %s, 'INR', 'CREATED', 'RAZORPAY', %s, %s)""",
            (str(uuid.uuid4()), registration_id, order_id, float(reg["ticket_price"]), now, now),
        )
        return {"order_id": order_id, "amount": float(reg["ticket_price"]), "currency": "INR", "key_id": config.RAZORPAY_KEY_ID, "registration_id": registration_id}

    @staticmethod
    def verify_payment(registration_id: str, razorpay_order_id: str, razorpay_payment_id: str, razorpay_signature: str):
        payment = db.execute_one(
            "SELECT * FROM payments WHERE registration_id = %s AND razorpay_order_id = %s",
            (registration_id, razorpay_order_id),
        )
        if not payment:
            raise ValueError("Payment order does not belong to this registration.")
        if current_app.config.get("TESTING"):
            if razorpay_signature != "test_signature":
                raise ValueError("Invalid test payment signature.")
        else:
            if not config.RAZORPAY_KEY_SECRET:
                raise ValueError("Payment verification is not configured.")
            expected = hmac.new(
                config.RAZORPAY_KEY_SECRET.encode("utf-8"),
                f"{razorpay_order_id}|{razorpay_payment_id}".encode("utf-8"),
                hashlib.sha256,
            ).hexdigest()
            if not hmac.compare_digest(expected, razorpay_signature):
                raise ValueError("Invalid Razorpay payment signature.")
            try:
                provider_payment = PaymentService._get_razorpay_client().payment.fetch(
                    razorpay_payment_id
                )
            except Exception as exc:
                current_app.logger.exception("Could not confirm payment status with Razorpay.")
                raise ValueError("Unable to confirm payment status with Razorpay.") from exc
            expected_amount = int(round(float(payment["amount"]) * 100))
            if (
                provider_payment.get("order_id") != razorpay_order_id
                or provider_payment.get("status") != "captured"
                or provider_payment.get("amount") != expected_amount
                or provider_payment.get("currency") != payment["currency"]
            ):
                raise ValueError("Payment has not been captured for the expected order amount.")
        return PaymentService._fulfill_payment(payment, razorpay_payment_id, razorpay_signature)

    @staticmethod
    def process_webhook(raw_body: bytes, signature_header: str | None):
        if not config.RAZORPAY_WEBHOOK_SECRET or not signature_header:
            raise ValueError("Webhook signature is required.")
        expected = hmac.new(config.RAZORPAY_WEBHOOK_SECRET.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, signature_header):
            raise ValueError("Invalid webhook signature.")

        try:
            event = json.loads(raw_body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ValueError("Invalid webhook payload.") from exc
        if not isinstance(event, dict):
            raise ValueError("Invalid webhook payload.")
        event_type = event.get("event")
        payload = event.get("payload")
        payment_payload = payload.get("payment") if isinstance(payload, dict) else None
        entity = payment_payload.get("entity", {}) if isinstance(payment_payload, dict) else {}
        if not isinstance(entity, dict):
            raise ValueError("Invalid webhook payment entity.")
        order_id, payment_id = entity.get("order_id"), entity.get("id")
        payment = db.execute_one("SELECT * FROM payments WHERE razorpay_order_id = %s", (order_id,)) if order_id else None
        if event_type == "payment.captured" and payment and payment_id:
            expected_amount = int(round(float(payment["amount"]) * 100))
            if (
                entity.get("status") != "captured"
                or entity.get("amount") != expected_amount
                or entity.get("currency") != payment["currency"]
            ):
                raise ValueError("Captured payment does not match the expected order amount.")
            PaymentService._fulfill_payment(payment, payment_id, "WEBHOOK_VERIFIED")
        elif event_type == "payment.failed" and payment:
            db.execute_write("UPDATE payments SET status = 'FAILED', updated_at = %s WHERE id = %s AND status = 'CREATED'", (datetime.now(timezone.utc).isoformat(), payment["id"]))
            audit_service.log("PAYMENT_FAILED", "payment", payment["id"], details={"order_id": order_id})
            registration = db.execute_one(
                """SELECT r.id, r.full_name, r.email, e.title AS event_title FROM registrations r
                   JOIN events e ON e.id = r.event_id WHERE r.id = %s""",
                (payment["registration_id"],),
            )
            if registration:
                token, token_hash = create_access_token()
                db.execute_write(
                    "UPDATE registrations SET payment_access_token_hash = %s, updated_at = %s WHERE id = %s AND status = 'PENDING_PAYMENT'",
                    (token_hash, datetime.now(timezone.utc).isoformat(), registration["id"]),
                )
                registration["payment_url"] = (
                    f"{config.APP_URL.rstrip('/')}/checkout/{registration['id']}#access_token={token}"
                )
                email_service.send_email(
                    registration["email"],
                    f"Payment needs attention — {registration['event_title']}",
                    "emails/payment_failed.html",
                    registration,
                )
        return {"status": "SUCCESS", "event": event_type}

    @staticmethod
    def _fulfill_payment(payment: dict, payment_id: str, signature: str):
        if payment["status"] == "PAID":
            if payment.get("razorpay_payment_id") and payment["razorpay_payment_id"] != payment_id:
                raise ValueError("Payment order was already settled by another payment.")
            db.execute_write(
                "UPDATE registrations SET status = 'PAID', updated_at = %s WHERE id = %s AND status = 'PENDING_PAYMENT'",
                (datetime.now(timezone.utc).isoformat(), payment["registration_id"]),
            )
            ticket = ticket_service.issue_ticket(payment["registration_id"])
            return {"status": "PAID", "registration_id": payment["registration_id"], "ticket_id": ticket["id"], "ticket_code": ticket["ticket_code"]}
        if payment["status"] != "CREATED":
            raise ValueError("Payment is not eligible for fulfillment.")

        now = datetime.now(timezone.utc).isoformat()
        updated = db.execute_write(
            """UPDATE payments SET razorpay_payment_id = %s, razorpay_signature = %s, status = 'PAID', updated_at = %s
               WHERE id = %s AND status = 'CREATED'""",
            (payment_id, signature, now, payment["id"]),
        )
        if not updated:
            refreshed = db.execute_one("SELECT * FROM payments WHERE id = %s", (payment["id"],))
            return PaymentService._fulfill_payment(refreshed, payment_id, signature)
        db.execute_write("UPDATE registrations SET status = 'PAID', updated_at = %s WHERE id = %s AND status = 'PENDING_PAYMENT'", (now, payment["registration_id"]))
        ticket = ticket_service.issue_ticket(payment["registration_id"])
        email_service.send_email(
            recipient=ticket["email"],
            subject=f"Payment Confirmed — {ticket['event_title']}",
            template_name="emails/payment_success.html",
            context={"student_name": ticket["student_name"], "event_title": ticket["event_title"], "amount": payment["amount"], "ticket_code": ticket["ticket_code"]},
        )
        audit_service.log("PAYMENT_SUCCESS", "payment", payment["id"], details={"registration_id": payment["registration_id"], "order_id": payment["razorpay_order_id"]})
        return {"status": "PAID", "registration_id": payment["registration_id"], "ticket_id": ticket["id"], "ticket_code": ticket["ticket_code"]}


payment_service = PaymentService()
