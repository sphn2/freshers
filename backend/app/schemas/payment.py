from pydantic import BaseModel, Field
from typing import Optional, Dict, Any

class CreateOrderRequest(BaseModel):
    registration_id: str
    registration_token: Optional[str] = None

class CreateOrderResponse(BaseModel):
    gateway: str = "RAZORPAY"
    order_id: str
    amount: float
    currency: str = "INR"
    key_id: Optional[str] = None
    payment_session_id: Optional[str] = None
    redirect_url: Optional[str] = None
    environment: Optional[str] = None
    ticket_price: Optional[float] = None
    convenience_fee: Optional[float] = None
    convenience_fee_enabled: Optional[bool] = None
    registration_id: str

class VerifyPaymentRequest(BaseModel):
    registration_id: str
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    razorpay_signature: Optional[str] = None
    order_id: Optional[str] = None
    payment_id: Optional[str] = None
    signature: Optional[str] = None
    gateway: Optional[str] = None
    registration_token: Optional[str] = None

class PaymentStatusResponse(BaseModel):
    payment_id: str
    registration_id: str
    status: str
    amount: float
    ticket_id: Optional[str] = None
    ticket_code: Optional[str] = None
