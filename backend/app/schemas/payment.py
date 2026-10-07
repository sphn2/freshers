from pydantic import BaseModel, Field
from typing import Optional

class CreateOrderRequest(BaseModel):
    registration_id: str

class CreateOrderResponse(BaseModel):
    order_id: str
    amount: float
    currency: str
    key_id: str
    registration_id: str

class VerifyPaymentRequest(BaseModel):
    registration_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str

class PaymentStatusResponse(BaseModel):
    payment_id: str
    registration_id: str
    status: str
    amount: float
    ticket_id: Optional[str] = None
    ticket_code: Optional[str] = None
