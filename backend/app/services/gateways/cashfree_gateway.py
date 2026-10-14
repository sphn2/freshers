import uuid
from typing import Dict, Any
import requests
from flask import current_app
from app.config import config
from app.services.gateways.base import BasePaymentGateway
from app.services.audit_service import audit_service

class CashfreeGateway(BasePaymentGateway):
    @property
    def name(self) -> str:
        return "CASHFREE"

    def _get_base_url(self) -> str:
        is_prod = config.CASHFREE_ENV.strip().upper() in ("PROD", "PRODUCTION")
        return "https://api.cashfree.com/pg" if is_prod else "https://sandbox.cashfree.com/pg"

    def _get_headers(self) -> Dict[str, str]:
        if not config.CASHFREE_APP_ID or not config.CASHFREE_SECRET_KEY:
            raise ValueError("Cashfree payments are not configured.")
        return {
            "x-client-id": config.CASHFREE_APP_ID,
            "x-client-secret": config.CASHFREE_SECRET_KEY,
            "x-api-version": config.CASHFREE_API_VERSION or "2023-08-01",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def _get_client_app_url(self) -> str:
        try:
            from flask import request
            origin = request.headers.get("Origin") or request.headers.get("Referer")
            if origin:
                from urllib.parse import urlparse
                p = urlparse(origin)
                if p.scheme and p.netloc:
                    return f"{p.scheme}://{p.netloc}".rstrip("/")
        except Exception:
            pass
        return config.APP_URL.rstrip("/")

    def create_order(
        self,
        registration: Dict[str, Any],
        total_amount: float,
        ticket_price: float,
        fee_amount: float,
        fee_enabled: bool,
        token: str | None = None,
    ) -> Dict[str, Any]:
        registration_id = registration["id"]
        clean_reg_id = registration_id.replace("-", "")[:12]
        order_id = f"cf_{clean_reg_id}_{uuid.uuid4().hex[:6]}"

        is_prod = config.CASHFREE_ENV.strip().upper() in ("PROD", "PRODUCTION")
        environment = "production" if is_prod else "sandbox"

        if current_app.config.get("TESTING"):
            session_id = f"session_test_{uuid.uuid4().hex[:16]}"
        else:
            base_url = self._get_base_url()
            client_app_url = self._get_client_app_url()
            from urllib.parse import quote
            token_qs = f"&token={quote(token)}" if token else ""
            return_url = (
                f"{client_app_url}/checkout/{registration_id}"
                f"?order_id={{order_id}}&gateway=CASHFREE{token_qs}"
            )
            raw_phone = (registration.get("phone") or "9999999999").strip()
            # Ensure 10 digits
            phone_digits = "".join(filter(str.isdigit, raw_phone))
            phone = phone_digits[-10:] if len(phone_digits) >= 10 else "9999999999"

            body = {
                "order_id": order_id,
                "order_amount": round(total_amount, 2),
                "order_currency": "INR",
                "customer_details": {
                    "customer_id": f"cust_{clean_reg_id}",
                    "customer_name": registration.get("full_name") or "Student",
                    "customer_email": registration.get("email") or "events@sphoorthy.ac.in",
                    "customer_phone": phone,
                },
                "order_meta": {
                    "return_url": return_url,
                },
                "order_note": f"Registration {registration_id}",
            }

            try:
                resp = requests.post(
                    f"{base_url}/orders",
                    json=body,
                    headers=self._get_headers(),
                    timeout=15,
                )
                if resp.status_code not in (200, 201):
                    err_msg = resp.text
                    audit_service.log(
                        "PAYMENT_ORDER_FAILED",
                        "registration",
                        registration_id,
                        details={"gateway": "CASHFREE", "status_code": resp.status_code, "response": err_msg},
                    )
                    raise ValueError(f"Cashfree order creation failed: {err_msg}")
                res_data = resp.json()
                session_id = res_data.get("payment_session_id")
                if not session_id:
                    raise ValueError("Cashfree did not return a payment_session_id.")
            except Exception as exc:
                audit_service.log(
                    "PAYMENT_ORDER_FAILED",
                    "registration",
                    registration_id,
                    details={"gateway": "CASHFREE", "error": str(exc)},
                )
                raise ValueError(f"Unable to create the Cashfree order: {exc}") from exc

        return {
            "gateway": "CASHFREE",
            "order_id": order_id,
            "payment_session_id": session_id,
            "environment": environment,
            "amount": total_amount,
            "ticket_price": ticket_price,
            "convenience_fee": fee_amount,
            "convenience_fee_enabled": fee_enabled,
            "currency": "INR",
            "registration_id": registration_id,
        }

    def verify_payment(
        self,
        payment: Dict[str, Any],
        payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        order_id = payload.get("order_id") or payload.get("gateway_order_id") or payment.get("gateway_order_id") or payment.get("razorpay_order_id")
        payment_id = payload.get("payment_id") or payload.get("gateway_payment_id")
        signature = payload.get("signature") or payload.get("gateway_signature")

        if not order_id:
            raise ValueError("Missing Cashfree order ID for verification.")

        if current_app.config.get("TESTING"):
            if signature and signature != "test_signature":
                raise ValueError("Invalid test payment signature.")
            return {
                "verified": True,
                "payment_id": payment_id or f"cf_mock_{uuid.uuid4().hex[:8]}",
                "signature": signature or "test_signature",
                "raw": {"status": "TEST_PAID"},
            }

        base_url = self._get_base_url()
        headers = self._get_headers()

        try:
            resp = requests.get(
                f"{base_url}/orders/{order_id}",
                headers=headers,
                timeout=15,
            )
            if resp.status_code != 200:
                raise ValueError(f"Failed to fetch order status from Cashfree: {resp.text}")
            order_data = resp.json()
        except Exception as exc:
            current_app.logger.exception("Could not confirm payment status with Cashfree.")
            raise ValueError("Unable to confirm payment status with Cashfree.") from exc

        order_status = order_data.get("order_status")
        if order_status != "PAID":
            raise ValueError(f"Payment is not confirmed. Cashfree status is '{order_status}'.")

        # Try to retrieve transaction payment ID
        actual_payment_id = payment_id
        if not actual_payment_id:
            try:
                payments_resp = requests.get(
                    f"{base_url}/orders/{order_id}/payments",
                    headers=headers,
                    timeout=10,
                )
                if payments_resp.status_code == 200:
                    payments_list = payments_resp.json()
                    if isinstance(payments_list, list) and len(payments_list) > 0:
                        successful = [p for p in payments_list if p.get("payment_status") == "SUCCESS"]
                        if successful:
                            actual_payment_id = str(successful[0].get("cf_payment_id") or successful[0].get("payment_id"))
            except Exception:
                pass

        if not actual_payment_id:
            actual_payment_id = f"cf_paid_{order_id}"

        return {
            "verified": True,
            "payment_id": actual_payment_id,
            "signature": signature or "CASHFREE_API_VERIFIED",
            "raw": order_data,
        }
