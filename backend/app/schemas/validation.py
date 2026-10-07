from pydantic import BaseModel, Field
from typing import Optional

class GateValidationRequest(BaseModel):
    event_id: str
    qr_token: Optional[str] = None
    ticket_code: Optional[str] = Field(None, min_length=6, max_length=6)
    gate_location: str = "Gate 1"

class GateValidationResponse(BaseModel):
    status: str  # VALID / ALREADY_USED / INVALID_TICKET
    message: str
    ticket_code: Optional[str] = None
    student_name: Optional[str] = None
    roll_number: Optional[str] = None
    department: Optional[str] = None
    gate_location: Optional[str] = None
    validated_at: Optional[str] = None

class FoodValidationRequest(BaseModel):
    event_id: str
    qr_token: Optional[str] = None
    ticket_code: Optional[str] = Field(None, min_length=6, max_length=6)
    food_location: str = "Food Counter 1"

class FoodValidationResponse(BaseModel):
    status: str  # VALID / FOOD_ALREADY_CLAIMED / INVALID_TICKET
    message: str
    ticket_code: Optional[str] = None
    student_name: Optional[str] = None
    roll_number: Optional[str] = None
    department: Optional[str] = None
    food_location: Optional[str] = None
    validated_at: Optional[str] = None
