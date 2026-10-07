from pydantic import BaseModel
from typing import Optional

class TicketResponse(BaseModel):
    id: str
    event_id: str
    event_title: str
    venue: str
    start_time: str
    registration_id: str
    student_name: str
    roll_number: str
    department: str
    ticket_code: str  # 6-digit code e.g. "583214"
    qr_token: str
    status: str
    gate_validated_at: Optional[str] = None
    gate_location: Optional[str] = None
    food_validated_at: Optional[str] = None
    food_status: Optional[str] = "UNCLAIMED"

class TicketReissueRequest(BaseModel):
    reason: str
    new_email: Optional[str] = None
