from pydantic import BaseModel, EmailStr, Field, field_validator
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
    pin: str = Field(..., min_length=6, max_length=6)
    receipt_number: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("pin")
    @classmethod
    def validate_pin(cls, value: str) -> str:
        s = value.strip()
        if len(s) != 6 or not s.isdigit():
            raise ValueError("PIN must be exactly 6 digits.")
        return s

class OfflineRegistrationResponse(BaseModel):
    registration_id: str
    ticket_id: str
    ticket_code: str
    student_name: str
    amount_paid: float
    collector_id: str
    created_at: str
