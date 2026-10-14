from typing import Dict
from app.services.gateways.base import BasePaymentGateway
from app.services.gateways.razorpay_gateway import RazorpayGateway
from app.services.gateways.cashfree_gateway import CashfreeGateway
from app.services.gateways.phonepe_gateway import PhonePeGateway
from app.services.system_settings_service import system_settings_service

class GatewayFactory:
    _instances: Dict[str, BasePaymentGateway] = {}

    @classmethod
    def get_gateway(cls, gateway_name: str | None = None) -> BasePaymentGateway:
        name = (gateway_name or "").strip().upper()
        if not name or name == "DEFAULT":
            settings = system_settings_service.get_payment_gateway_settings()
            name = settings.get("default_gateway", "RAZORPAY").strip().upper()

        if name not in cls._instances:
            if name == "RAZORPAY":
                cls._instances[name] = RazorpayGateway()
            elif name == "CASHFREE":
                cls._instances[name] = CashfreeGateway()
            elif name == "PHONEPE":
                cls._instances[name] = PhonePeGateway()
            else:
                raise ValueError(f"Unsupported payment gateway: '{name}'")

        return cls._instances[name]

gateway_factory = GatewayFactory()
