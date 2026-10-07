from pydantic import BaseModel, EmailStr, Field
from typing import Optional

class RegistrationCreate(BaseModel):
    event_id: str
    full_name: str = Field(..., min_length=2, max_length=255)
    roll_number: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    phone: str = Field(..., min_length=10, max_length=20)
    department: str = Field(..., min_length=2, max_length=100)
    college: str = "Sphoorthy Engineering College"

class AutoFillResponse(BaseModel):
    roll_number: str
    full_name: str
    email: str
    phone: Optional[str] = None
    department: str
    college: str = "Sphoorthy Engineering College"

class RegistrationResponse(BaseModel):
    id: str
    event_id: str
    full_name: str
    roll_number: str
    email: str
    phone: str
    department: str
    college: str
    ticket_price: float
    status: str
    payment_method: str
    created_at: str
