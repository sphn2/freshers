import hashlib
import hmac
import uuid
from typing import Dict, Any
import razorpay
from flask import current_app
from app.config import config
from app.services.gateways.base import BasePaymentGateway
from app.services.audit_service import audit_service

class RazorpayGateway(BasePaymentGateway):
    @property
    def name(self) -> str:
        return "RAZORPAY"

    def _get_client(self):
        if not config.RAZORPAY_KEY_ID or not config.RAZORPAY_KEY_SECRET:
            raise ValueError("Razorpay online payments are not configured.")
        return razorpay.Client(auth=(config.RAZORPAY_KEY_ID, config.RAZORPAY_KEY_SECRET))

    def create_order(
        self,
        registration: Dict[str, Any],
        total_amount: float,
        ticket_price: float,
        fee_amount: float,
        fee_enabled: bool,
        token: str | None = None,
    ) -> Dict[str, Any]:
        amount_in_paise = int(round(total_amount * 100))
        registration_id = registration["id"]

        if current_app.config.get("TESTING"):
            order_id = f"order_test_{uuid.uuid4().hex[:12]}"
        else:
            try:
                order = self._get_client().order.create({
                    "amount": amount_in_paise,
                    "currency": "INR",
                    "receipt": f"reg_{registration_id[:16]}",
                    "notes": {"registration_id": registration_id},
                })
                order_id = order["id"]
            except Exception as exc:
                audit_service.log(
                    "PAYMENT_ORDER_FAILED",
                    "registration",
                    registration_id,
                    details={"gateway": "RAZORPAY", "error": str(exc)},
                )
                raise ValueError("Unable to create the Razorpay order. Please retry shortly.") from exc

        return {
            "gateway": "RAZORPAY",
            "order_id": order_id,
            "amount": total_amount,
            "ticket_price": ticket_price,
            "convenience_fee": fee_amount,
            "convenience_fee_enabled": fee_enabled,
            "currency": "INR",
            "key_id": config.RAZORPAY_KEY_ID,
            "registration_id": registration_id,
        }

    def verify_payment(
        self,
        payment: Dict[str, Any],
        payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        order_id = payload.get("order_id") or payload.get("razorpay_order_id")
        payment_id = payload.get("payment_id") or payload.get("razorpay_payment_id")
        signature = payload.get("signature") or payload.get("razorpay_signature")

        if not order_id or not payment_id or not signature:
            raise ValueError("Missing Razorpay payment verification parameters.")

        if current_app.config.get("TESTING"):
            if signature != "test_signature":
                raise ValueError("Invalid test payment signature.")
            return {
                "verified": True,
                "payment_id": payment_id,
                "signature": signature,
                "raw": {"status": "test_captured"},
            }

        if not config.RAZORPAY_KEY_SECRET:
            raise ValueError("Payment verification is not configured.")

        expected = hmac.new(
            config.RAZORPAY_KEY_SECRET.encode("utf-8"),
            f"{order_id}|{payment_id}".encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(expected, signature):
            raise ValueError("Invalid Razorpay payment signature.")

        try:
            provider_payment = self._get_client().payment.fetch(payment_id)
        except Exception as exc:
            current_app.logger.exception("Could not confirm payment status with Razorpay.")
            raise ValueError("Unable to confirm payment status with Razorpay.") from exc

        expected_amount = int(round(float(payment["amount"]) * 100))
        if (
            provider_payment.get("order_id") != order_id
            or provider_payment.get("status") != "captured"
            or provider_payment.get("amount") != expected_amount
            or provider_payment.get("currency") != payment.get("currency", "INR")
        ):
            raise ValueError("Payment has not been captured for the expected order amount.")

        return {
            "verified": True,
            "payment_id": payment_id,
            "signature": signature,
            "raw": provider_payment,
        }
