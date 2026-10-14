import hashlib
import hmac
import json
import uuid
from datetime import datetime, timezone

from flask import current_app

from app.config import config
from app.db import db
from app.services.audit_service import audit_service
from app.services.ticket_service import ticket_service
from app.services.email_service import email_service
from app.utils.payment_access import create_access_token
from app.services.system_settings_service import system_settings_service
from app.services.gateways.factory import gateway_factory

class PaymentService:
    @staticmethod
    def create_order(registration_id: str, registration_token: str | None = None):
        reg = db.execute_one(
            """SELECT r.*, e.allow_online, e.payment_gateway FROM registrations r
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
            return {
                "already_paid": True,
                "ticket_id": ticket["id"] if ticket else None,
                "message": "Registration is already paid.",
            }
        if reg["status"] != "PENDING_PAYMENT":
            raise ValueError("This registration cannot be paid online.")

        ticket_price = float(reg["ticket_price"])
        fee_settings = system_settings_service.get_convenience_fee_settings()
        fee_enabled = fee_settings["enabled"]
        fee_amount = float(fee_settings["amount"]) if fee_enabled else 0.0
        total_amount = round(ticket_price + fee_amount, 2)

        gw = gateway_factory.get_gateway(reg.get("payment_gateway"))

        existing = db.execute_one(
            "SELECT * FROM payments WHERE registration_id = %s AND status = 'CREATED' ORDER BY created_at DESC",
            (registration_id,),
        )
        if existing:
            existing_gw = existing.get("gateway") or existing.get("payment_method") or "RAZORPAY"
            if existing_gw == gw.name and gw.name == "RAZORPAY":
                existing_amount = float(existing["amount"])
                calc_fee = round(existing_amount - ticket_price, 2) if existing_amount > ticket_price else 0.0
                order_id = existing.get("gateway_order_id") or existing.get("razorpay_order_id")

                return {
                    "gateway": "RAZORPAY",
                    "order_id": order_id,
                    "key_id": config.RAZORPAY_KEY_ID,
                    "amount": existing_amount,
                    "ticket_price": ticket_price,
                    "convenience_fee": calc_fee,
                    "convenience_fee_enabled": calc_fee > 0,
                    "currency": existing.get("currency", "INR"),
                    "registration_id": registration_id,
                }
            else:
                # Mark previous pending order superseded to generate a fresh order & session for Cashfree/PhonePe or when gateway changed
                now_iso = datetime.now(timezone.utc).isoformat()
                db.execute_write(
                    "UPDATE payments SET status = 'SUPERSEDED', updated_at = %s WHERE id = %s",
                    (now_iso, existing["id"]),
                )

        order_data = gw.create_order(
            registration=reg,
            total_amount=total_amount,
            ticket_price=ticket_price,
            fee_amount=fee_amount,
            fee_enabled=fee_enabled,
            token=registration_token,
        )

        order_id = order_data["order_id"]
        now = datetime.now(timezone.utc).isoformat()
        db.execute_write(
            """INSERT INTO payments (
                id, registration_id, razorpay_order_id, gateway_order_id, gateway,
                amount, currency, status, payment_method, created_at, updated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, 'INR', 'CREATED', %s, %s, %s)""",
            (
                str(uuid.uuid4()),
                registration_id,
                order_id,
                order_id,
                gw.name,
                total_amount,
                gw.name,
                now,
                now,
            ),
        )

        return order_data

    @staticmethod
    def verify_payment(
        registration_id: str,
        razorpay_order_id: str | None = None,
        razorpay_payment_id: str | None = None,
        razorpay_signature: str | None = None,
        order_id: str | None = None,
        payment_id: str | None = None,
        signature: str | None = None,
        gateway: str | None = None,
    ):
        eff_order_id = order_id or razorpay_order_id
        eff_payment_id = payment_id or razorpay_payment_id
        eff_signature = signature or razorpay_signature

        if not eff_order_id:
            raise ValueError("Order ID is required to verify payment.")

        payment = db.execute_one(
            """SELECT * FROM payments 
               WHERE registration_id = %s 
                 AND (razorpay_order_id = %s OR gateway_order_id = %s)""",
            (registration_id, eff_order_id, eff_order_id),
        )
        if not payment:
            raise ValueError("Payment order does not belong to this registration.")

        gw_name = gateway or payment.get("gateway") or payment.get("payment_method") or "RAZORPAY"
        gw = gateway_factory.get_gateway(gw_name)

        payload = {
            "order_id": eff_order_id,
            "payment_id": eff_payment_id,
            "signature": eff_signature,
            "razorpay_order_id": razorpay_order_id,
            "razorpay_payment_id": razorpay_payment_id,
            "razorpay_signature": razorpay_signature,
        }

        verification = gw.verify_payment(payment, payload)
        return PaymentService._fulfill_payment(
            payment,
            verification["payment_id"],
            verification["signature"],
        )

    @staticmethod
    def process_webhook(raw_body: bytes, signature_header: str | None):
        if not config.RAZORPAY_WEBHOOK_SECRET or not signature_header:
            raise ValueError("Webhook signature is required.")
        expected = hmac.new(
            config.RAZORPAY_WEBHOOK_SECRET.encode("utf-8"), raw_body, hashlib.sha256
        ).hexdigest()
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
        payment = (
            db.execute_one(
                "SELECT * FROM payments WHERE razorpay_order_id = %s OR gateway_order_id = %s",
                (order_id, order_id),
            )
            if order_id
            else None
        )
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
            db.execute_write(
                "UPDATE payments SET status = 'FAILED', updated_at = %s WHERE id = %s AND status = 'CREATED'",
                (datetime.now(timezone.utc).isoformat(), payment["id"]),
            )
            audit_service.log(
                "PAYMENT_FAILED", "payment", payment["id"], details={"order_id": order_id}
            )
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
            existing_pid = payment.get("gateway_payment_id") or payment.get("razorpay_payment_id")
            if existing_pid and existing_pid != payment_id:
                raise ValueError("Payment order was already settled by another payment.")
            db.execute_write(
                "UPDATE registrations SET status = 'PAID', updated_at = %s WHERE id = %s AND status = 'PENDING_PAYMENT'",
                (datetime.now(timezone.utc).isoformat(), payment["registration_id"]),
            )
            ticket = ticket_service.issue_ticket(payment["registration_id"])
            return {
                "status": "PAID",
                "registration_id": payment["registration_id"],
                "ticket_id": ticket["id"],
                "ticket_code": ticket["ticket_code"],
            }
        if payment["status"] != "CREATED":
            raise ValueError("Payment is not eligible for fulfillment.")

        now = datetime.now(timezone.utc).isoformat()
        updated = db.execute_write(
            """UPDATE payments 
               SET razorpay_payment_id = %s, razorpay_signature = %s,
                   gateway_payment_id = %s, gateway_signature = %s,
                   status = 'PAID', updated_at = %s
               WHERE id = %s AND status = 'CREATED'""",
            (payment_id, signature, payment_id, signature, now, payment["id"]),
        )
        if not updated:
            refreshed = db.execute_one("SELECT * FROM payments WHERE id = %s", (payment["id"],))
            return PaymentService._fulfill_payment(refreshed, payment_id, signature)

        db.execute_write(
            "UPDATE registrations SET status = 'PAID', updated_at = %s WHERE id = %s AND status = 'PENDING_PAYMENT'",
            (now, payment["registration_id"]),
        )
        ticket = ticket_service.issue_ticket(payment["registration_id"])
        order_ref = payment.get("gateway_order_id") or payment.get("razorpay_order_id")
        audit_service.log(
            "PAYMENT_SUCCESS",
            "payment",
            payment["id"],
            details={
                "registration_id": payment["registration_id"],
                "order_id": order_ref,
                "gateway": payment.get("gateway", "RAZORPAY"),
            },
        )
        return {
            "status": "PAID",
            "registration_id": payment["registration_id"],
            "ticket_id": ticket["id"],
            "ticket_code": ticket["ticket_code"],
        }

payment_service = PaymentService()
