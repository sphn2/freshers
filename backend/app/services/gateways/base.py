from abc import ABC, abstractmethod
from typing import Dict, Any

class BasePaymentGateway(ABC):
    """
    Abstract base class for all supported payment gateway adapters.
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Returns the uppercase gateway identifier (e.g. 'RAZORPAY', 'CASHFREE', 'PHONEPE')."""
        pass

    @abstractmethod
    def create_order(
        self,
        registration: Dict[str, Any],
        total_amount: float,
        ticket_price: float,
        fee_amount: float,
        fee_enabled: bool,
        token: str | None = None,
    ) -> Dict[str, Any]:
        """
        Creates an order with the provider and returns structured payment initialization details.
        """
        pass

    @abstractmethod
    def verify_payment(
        self,
        payment: Dict[str, Any],
        payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Verifies payment validity with provider (via signature or status verification query).
        Returns: { "verified": bool, "payment_id": str, "signature": str, "raw": dict }
        """
        pass
