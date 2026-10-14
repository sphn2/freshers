import base64
import hashlib
import json
import uuid
from typing import Dict, Any
import requests
from flask import current_app
from app.config import config
from app.services.gateways.base import BasePaymentGateway
from app.services.audit_service import audit_service

class PhonePeGateway(BasePaymentGateway):
    @property
    def name(self) -> str:
        return "PHONEPE"

    def _get_credentials(self):
        if not config.PHONEPE_MERCHANT_ID or not config.PHONEPE_SALT_KEY:
            raise ValueError("PhonePe payments are not configured.")
        return config.PHONEPE_MERCHANT_ID, config.PHONEPE_SALT_KEY, str(config.PHONEPE_SALT_INDEX or "1")

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
        clean_reg_id = registration_id.replace("-", "")[:8]
        order_id = f"TXN_{clean_reg_id}_{uuid.uuid4().hex[:6]}"

        client_app_url = self._get_client_app_url()
        from urllib.parse import quote
        token_qs = f"&token={quote(token)}" if token else ""

        if current_app.config.get("TESTING"):
            redirect_url = f"{client_app_url}/checkout/{registration_id}?order_id={order_id}&gateway=PHONEPE{token_qs}"
        else:
            merchant_id, salt_key, salt_index = self._get_credentials()
            amount_in_paise = int(round(total_amount * 100))
            return_url = (
                f"{client_app_url}/checkout/{registration_id}"
                f"?order_id={order_id}&gateway=PHONEPE{token_qs}"
            )
            callback_url = f"{config.APP_URL.rstrip('/')}/api/v1/payments/webhook/phonepe"

            raw_phone = (registration.get("phone") or "9999999999").strip()
            phone_digits = "".join(filter(str.isdigit, raw_phone))
            phone = phone_digits[-10:] if len(phone_digits) >= 10 else "9999999999"

            payload_dict = {
                "merchantId": merchant_id,
                "merchantTransactionId": order_id,
                "merchantUserId": f"MUID_{clean_reg_id}",
                "amount": amount_in_paise,
                "redirectUrl": return_url,
                "redirectMode": "REDIRECT",
                "callbackUrl": callback_url,
                "mobileNumber": phone,
                "paymentInstrument": {
                    "type": "PAY_PAGE",
                },
            }

            payload_bytes = json.dumps(payload_dict).encode("utf-8")
            base64_payload = base64.b64encode(payload_bytes).decode("utf-8")
            sign_string = base64_payload + "/pg/v1/pay" + salt_key
            sha256_hash = hashlib.sha256(sign_string.encode("utf-8")).hexdigest()
            x_verify = f"{sha256_hash}###{salt_index}"

            api_endpoint = f"{config.PHONEPE_HOST_URL.rstrip('/')}/pg/v1/pay"
            headers = {
                "Content-Type": "application/json",
                "X-VERIFY": x_verify,
                "Accept": "application/json",
            }

            try:
                resp = requests.post(
                    api_endpoint,
                    json={"request": base64_payload},
                    headers=headers,
                    timeout=15,
                )
                res_data = resp.json()
                if resp.status_code != 200 or not res_data.get("success"):
                    err_msg = res_data.get("message") or resp.text
                    audit_service.log(
                        "PAYMENT_ORDER_FAILED",
                        "registration",
                        registration_id,
                        details={"gateway": "PHONEPE", "response": err_msg},
                    )
                    raise ValueError(f"PhonePe order creation failed: {err_msg}")

                redirect_info = (
                    res_data.get("data", {})
                    .get("instrumentResponse", {})
                    .get("redirectInfo", {})
                )
                redirect_url = redirect_info.get("url")
                if not redirect_url:
                    raise ValueError("PhonePe did not return a payment redirect URL.")
            except Exception as exc:
                audit_service.log(
                    "PAYMENT_ORDER_FAILED",
                    "registration",
                    registration_id,
                    details={"gateway": "PHONEPE", "error": str(exc)},
                )
                raise ValueError(f"Unable to create the PhonePe order: {exc}") from exc

        return {
            "gateway": "PHONEPE",
            "order_id": order_id,
            "redirect_url": redirect_url,
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
            raise ValueError("Missing PhonePe transaction ID for verification.")

        if current_app.config.get("TESTING"):
            if signature and signature != "test_signature":
                raise ValueError("Invalid test payment signature.")
            return {
                "verified": True,
                "payment_id": payment_id or f"pe_mock_{uuid.uuid4().hex[:8]}",
                "signature": signature or "test_signature",
                "raw": {"status": "TEST_PAID"},
            }

        merchant_id, salt_key, salt_index = self._get_credentials()
        path = f"/pg/v1/status/{merchant_id}/{order_id}"
        sign_string = path + salt_key
        sha256_hash = hashlib.sha256(sign_string.encode("utf-8")).hexdigest()
        x_verify = f"{sha256_hash}###{salt_index}"

        status_url = f"{config.PHONEPE_HOST_URL.rstrip('/')}{path}"
        headers = {
            "Content-Type": "application/json",
            "X-VERIFY": x_verify,
            "X-MERCHANT-ID": merchant_id,
            "Accept": "application/json",
        }

        try:
            resp = requests.get(status_url, headers=headers, timeout=15)
            res_data = resp.json()
        except Exception as exc:
            current_app.logger.exception("Could not confirm payment status with PhonePe.")
            raise ValueError("Unable to confirm payment status with PhonePe.") from exc

        code = res_data.get("code")
        data_block = res_data.get("data") or {}
        if code != "PAYMENT_SUCCESS" or not res_data.get("success"):
            state = data_block.get("state") or code
            raise ValueError(f"PhonePe payment not completed. Status: '{state}'")

        actual_payment_id = (
            payment_id
            or data_block.get("transactionId")
            or f"pe_paid_{order_id}"
        )

        return {
            "verified": True,
            "payment_id": actual_payment_id,
            "signature": signature or "PHONEPE_API_VERIFIED",
            "raw": res_data,
        }
