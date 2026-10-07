from pydantic import BaseModel, EmailStr, Field
from typing import Optional

class OfflineRegistrationRequest(BaseModel):
    event_id: str
    full_name: str = Field(..., min_length=2, max_length=255)
    roll_number: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    phone: str = Field(..., min_length=10, max_length=20)
    department: str = Field(..., min_length=2, max_length=100)
    college: str = "Sphoorthy Engineering College"
    amount_paid: float = Field(..., ge=0.0)
    receipt_number: Optional[str] = None
    notes: Optional[str] = None

class OfflineRegistrationResponse(BaseModel):
    registration_id: str
    ticket_id: str
    ticket_code: str
    student_name: str
    amount_paid: float
    collector_id: str
    created_at: str
