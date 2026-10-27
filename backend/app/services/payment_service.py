import hashlib
import hmac
import json
import threading
import uuid
from datetime import datetime, timezone

from flask import current_app, has_app_context

from app.config import config
from app.db import db
from app.services.audit_service import audit_service
from app.services.ticket_service import ticket_service
from app.services.email_service import email_service
from app.utils.payment_access import create_access_token
from app.utils.timezone import now_ist_iso
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
            "SELECT * FROM payments WHERE registration_id = %s AND status IN ('CREATED', 'SUPERSEDED', 'FAILED') ORDER BY created_at DESC",
            (registration_id,),
        )
        if existing:
            existing_gw = existing.get("gateway") or existing.get("payment_method") or "RAZORPAY"
            order_ref = existing.get("gateway_order_id") or existing.get("razorpay_order_id")
            if order_ref and not current_app.config.get("TESTING"):
                try:
                    existing_gw_inst = gateway_factory.get_gateway(existing_gw)
                    verification = existing_gw_inst.verify_payment(existing, {"order_id": order_ref})
                    if verification.get("verified"):
                        PaymentService._fulfill_payment(
                            existing,
                            verification["payment_id"],
                            verification["signature"],
                        )
                        ticket = db.execute_one("SELECT id FROM tickets WHERE registration_id = %s", (registration_id,))
                        return {
                            "already_paid": True,
                            "ticket_id": ticket["id"] if ticket else None,
                            "message": "Registration is already paid.",
                        }
                except Exception as exc:
                    current_app.logger.debug("Existing order %s not paid yet: %s", order_ref, exc)

            if existing.get("status") == "CREATED" and existing_gw == gw.name and gw.name == "RAZORPAY":
                existing_amount = float(existing["amount"])
                calc_fee = round(existing_amount - ticket_price, 2) if existing_amount > ticket_price else 0.0
                order_id = existing.get("gateway_order_id") or existing.get("razorpay_order_id")

                order_valid_on_current_gateway = False
                if not current_app.config.get("TESTING"):
                    try:
                        rzp_client = gw._get_client()
                        rzp_order = rzp_client.order.fetch(order_id)
                        if rzp_order and rzp_order.get("status") in ("created", "attempted"):
                            order_valid_on_current_gateway = True
                    except Exception as chk_err:
                        current_app.logger.warning(
                            "Existing Razorpay order %s does not exist on active merchant account (superseding): %s",
                            order_id,
                            chk_err,
                        )
                        order_valid_on_current_gateway = False
                else:
                    order_valid_on_current_gateway = True

                if order_valid_on_current_gateway:
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
                    now_iso = now_ist_iso()
                    db.execute_write(
                        "UPDATE payments SET status = 'SUPERSEDED', updated_at = %s WHERE id = %s",
                        (now_iso, existing["id"]),
                    )
            elif existing.get("status") == "CREATED":
                # Mark previous pending order superseded to generate a fresh order & session for Cashfree/PhonePe or when gateway changed
                now_iso = now_ist_iso()
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
        now = now_ist_iso()
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
                 AND (razorpay_order_id = %s OR gateway_order_id = %s)
               ORDER BY created_at DESC""",
            (registration_id, eff_order_id, eff_order_id),
        )
        if not payment:
            # Fallback: find any pending payment for this registration if specific order mismatch
            payment = db.execute_one(
                """SELECT * FROM payments 
                   WHERE registration_id = %s AND status IN ('CREATED', 'SUPERSEDED')
                   ORDER BY created_at DESC""",
                (registration_id,),
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
        try:
            event = json.loads(raw_body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ValueError("Invalid webhook payload.") from exc
        if not isinstance(event, dict):
            raise ValueError("Invalid webhook payload.")

        # Signature verification check
        sig_valid = False
        if config.RAZORPAY_WEBHOOK_SECRET and signature_header:
            expected = hmac.new(
                config.RAZORPAY_WEBHOOK_SECRET.encode("utf-8"), raw_body, hashlib.sha256
            ).hexdigest()
            sig_valid = hmac.compare_digest(expected, signature_header)

        if not sig_valid:
            current_app.logger.warning("Razorpay webhook signature mismatch or unconfigured; falling back to authoritative direct API verification")

        event_type = event.get("event")
        payload = event.get("payload") if isinstance(event.get("payload"), dict) else {}
        payment_payload = payload.get("payment", {}) if isinstance(payload.get("payment"), dict) else {}
        order_payload = payload.get("order", {}) if isinstance(payload.get("order"), dict) else {}

        entity = payment_payload.get("entity", {}) if isinstance(payment_payload.get("entity"), dict) else {}
        order_entity = order_payload.get("entity", {}) if isinstance(order_payload.get("entity"), dict) else {}

        order_id = entity.get("order_id") or order_entity.get("id")
        payment_id = entity.get("id")

        if not order_id:
            return {"status": "IGNORED", "reason": "No order_id found"}

        payment = db.execute_one(
            "SELECT * FROM payments WHERE razorpay_order_id = %s OR gateway_order_id = %s",
            (order_id, order_id),
        )

        if event_type in ("payment.captured", "order.paid") and payment:
            if payment.get("status") == "PAID":
                return {"status": "SUCCESS", "event": event_type or "ALREADY_PAID"}

            if sig_valid and entity:
                expected_amount = int(round(float(payment["amount"]) * 100))
                if (
                    entity.get("status") != "captured"
                    or entity.get("amount") != expected_amount
                    or entity.get("currency") != payment.get("currency", "INR")
                ):
                    raise ValueError("Captured payment does not match the expected order amount.")
                return PaymentService._fulfill_payment(payment, payment_id or f"pay_{order_id}", "WEBHOOK_VERIFIED")
            else:
                gw = gateway_factory.get_gateway("RAZORPAY")
                verification = gw.verify_payment(payment, {
                    "order_id": order_id,
                    "payment_id": payment_id,
                    "signature": "RAZORPAY_WEBHOOK_API_VERIFIED",
                })
                return PaymentService._fulfill_payment(
                    payment,
                    verification["payment_id"],
                    verification["signature"],
                )
        elif event_type == "payment.failed" and payment:
            # 1. If payment is already settled as PAID, ignore failure of any previous/concurrent attempt
            if payment.get("status") == "PAID":
                return {"status": "SUCCESS", "event": "ALREADY_PAID"}

            # 2. If payment is already marked FAILED, avoid re-processing or re-emailing (Idempotency)
            if payment.get("status") == "FAILED":
                return {"status": "SUCCESS", "event": "ALREADY_FAILED"}

            db.execute_write(
                "UPDATE payments SET status = 'FAILED', updated_at = %s WHERE id = %s AND status = 'CREATED'",
                (now_ist_iso(), payment["id"]),
            )
            audit_service.log(
                "PAYMENT_FAILED", "payment", payment["id"], details={"order_id": order_id}
            )

            registration = db.execute_one(
                """SELECT r.id, r.status, r.full_name, r.email, e.title AS event_title FROM registrations r
                   JOIN events e ON e.id = r.event_id WHERE r.id = %s""",
                (payment["registration_id"],),
            )
            if not registration:
                return {"status": "SUCCESS", "event": event_type}

            # 3. If registration is already PAID, has another paid payment, or has a valid ticket issued, DO NOT send a payment failure email!
            if registration.get("status") in ("PAID", "OFFLINE_PAID"):
                return {"status": "SUCCESS", "event": "ALREADY_PAID"}

            any_paid = db.execute_one(
                "SELECT id FROM payments WHERE registration_id = %s AND status = 'PAID' LIMIT 1",
                (registration["id"],),
            )
            if any_paid:
                return {"status": "SUCCESS", "event": "ALREADY_PAID"}

            ticket = db.execute_one(
                "SELECT id FROM tickets WHERE registration_id = %s LIMIT 1",
                (registration["id"],),
            )
            if ticket:
                return {"status": "SUCCESS", "event": "TICKET_ALREADY_ISSUED"}

            # 4. Check if an email was already sent for this registration to prevent spam loops on retries
            already_sent = db.execute_one(
                """SELECT id FROM email_logs
                   WHERE recipient = %s
                     AND template_name = 'emails/payment_failed.html'
                     AND status IN ('SENT', 'MOCKED', 'PENDING')
                   LIMIT 1""",
                (registration["email"],),
            )
            if already_sent:
                return {"status": "SUCCESS", "event": "ALREADY_NOTIFIED"}

            token, token_hash = create_access_token()
            db.execute_write(
                "UPDATE registrations SET payment_access_token_hash = %s, updated_at = %s WHERE id = %s AND status = 'PENDING_PAYMENT'",
                (token_hash, now_ist_iso(), registration["id"]),
            )
            registration["payment_url"] = (
                f"{config.APP_URL.rstrip('/')}/checkout/{registration['id']}#access_token={token}"
            )

            email_kwargs = {
                "recipient": registration["email"],
                "subject": f"Payment needs attention — {registration['event_title']}",
                "template_name": "emails/payment_failed.html",
                "context": registration,
                "metadata": {"registration_id": registration["id"]},
            }

            # Send email asynchronously so webhook endpoint returns immediately (<=100ms) to prevent gateway timeout and retries
            if has_app_context() and current_app.config.get("TESTING"):
                email_service.send_email(**email_kwargs)
            else:
                threading.Thread(target=email_service.send_email, kwargs=email_kwargs, daemon=True).start()

        return {"status": "SUCCESS", "event": event_type}

    @staticmethod
    def process_cashfree_webhook(raw_body: bytes, signature_header: str | None, timestamp_header: str | None):
        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ValueError("Invalid webhook payload.") from exc

        if not isinstance(payload, dict):
            raise ValueError("Invalid webhook payload.")

        # Cashfree signature verification: signs timestamp + raw_body
        if config.CASHFREE_SECRET_KEY and signature_header and timestamp_header:
            import base64
            computed = base64.b64encode(
                hmac.new(
                    config.CASHFREE_SECRET_KEY.encode("utf-8"),
                    f"{timestamp_header}".encode("utf-8") + raw_body,
                    hashlib.sha256,
                ).digest()
            ).decode("utf-8")
            if not hmac.compare_digest(computed, signature_header):
                current_app.logger.warning("Cashfree webhook signature mismatch; falling back to direct API verification")

        data = payload.get("data") if isinstance(payload.get("data"), dict) else payload
        order = data.get("order") if isinstance(data.get("order"), dict) else {}
        payment_info = data.get("payment") if isinstance(data.get("payment"), dict) else {}

        order_id = order.get("order_id") or payload.get("order_id") or data.get("order_id")
        payment_id = str(payment_info.get("cf_payment_id") or payment_info.get("payment_id") or f"cf_wh_{order_id}")
        event_type = payload.get("type") or payload.get("event") or ""

        if not order_id:
            return {"status": "IGNORED", "reason": "No order_id found"}

        payment = db.execute_one(
            "SELECT * FROM payments WHERE razorpay_order_id = %s OR gateway_order_id = %s",
            (order_id, order_id),
        )
        if not payment:
            return {"status": "IGNORED", "reason": "Payment order not found"}

        if payment["status"] == "PAID":
            return {"status": "SUCCESS", "event": event_type or "ALREADY_PAID"}

        if "FAILED" in event_type.upper() or "DROP" in event_type.upper():
            db.execute_write(
                "UPDATE payments SET status = 'FAILED', updated_at = %s WHERE id = %s AND status = 'CREATED'",
                (now_ist_iso(), payment["id"]),
            )
            return {"status": "SUCCESS", "event": event_type}

        # Authoritatively verify with Cashfree gateway
        gw = gateway_factory.get_gateway("CASHFREE")
        verification = gw.verify_payment(payment, {
            "order_id": order_id,
            "payment_id": payment_id,
            "signature": signature_header or "CASHFREE_WEBHOOK_VERIFIED",
        })

        return PaymentService._fulfill_payment(
            payment,
            verification["payment_id"],
            verification["signature"],
        )

    @staticmethod
    def _fulfill_payment(payment: dict, payment_id: str, signature: str):
        now = now_ist_iso()
        if payment["status"] == "PAID":
            existing_pid = payment.get("gateway_payment_id") or payment.get("razorpay_payment_id")
            if existing_pid and existing_pid != payment_id:
                raise ValueError("Payment order was already settled by another payment.")
            db.execute_write(
                "UPDATE registrations SET status = 'PAID', created_at = %s, updated_at = %s WHERE id = %s AND status = 'PENDING_PAYMENT'",
                (now, now, payment["registration_id"]),
            )
            ticket = ticket_service.issue_ticket(payment["registration_id"])
            return {
                "status": "PAID",
                "registration_id": payment["registration_id"],
                "ticket_id": ticket["id"],
                "ticket_code": ticket["ticket_code"],
            }
        if payment["status"] not in ("CREATED", "SUPERSEDED", "FAILED"):
            raise ValueError("Payment is not eligible for fulfillment.")

        updated = db.execute_write(
            """UPDATE payments 
               SET razorpay_payment_id = %s, razorpay_signature = %s,
                   gateway_payment_id = %s, gateway_signature = %s,
                   status = 'PAID', updated_at = %s
               WHERE id = %s AND status IN ('CREATED', 'SUPERSEDED', 'FAILED')""",
            (payment_id, signature, payment_id, signature, now, payment["id"]),
        )
        if not updated:
            refreshed = db.execute_one("SELECT * FROM payments WHERE id = %s", (payment["id"],))
            return PaymentService._fulfill_payment(refreshed, payment_id, signature)

        db.execute_write(
            "UPDATE registrations SET status = 'PAID', created_at = %s, updated_at = %s WHERE id = %s",
            (now, now, payment["registration_id"]),
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
