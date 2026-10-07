from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class EventCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=255)
    slug: str = Field(..., min_length=3, max_length=255)
    description: Optional[str] = None
    event_type: str = "GENERAL"
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    venue: str = Field(..., min_length=3, max_length=255)
    start_time: datetime
    end_time: datetime
    registration_start: datetime
    registration_end: datetime
    capacity: int = Field(..., ge=1)
    ticket_price: float = Field(0.0, ge=0.0)
    first_year_ticket_price: float = Field(500.0, ge=0.0)
    second_year_ticket_price: float = Field(600.0, ge=0.0)
    other_ticket_price: Optional[float] = Field(None, ge=0.0)
    allow_online: bool = True
    allow_offline: bool = True
    allow_autofill: bool = True
    registration_open: Optional[bool] = None
    gate_validation_enabled: bool = True
    food_validation_enabled: bool = True
    status: str = "DRAFT"

class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    venue: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    registration_start: Optional[datetime] = None
    registration_end: Optional[datetime] = None
    capacity: Optional[int] = None
    ticket_price: Optional[float] = None
    first_year_ticket_price: Optional[float] = Field(None, ge=0.0)
    second_year_ticket_price: Optional[float] = Field(None, ge=0.0)
    other_ticket_price: Optional[float] = Field(None, ge=0.0)
    status: Optional[str] = None
    allow_online: Optional[bool] = None
    allow_offline: Optional[bool] = None
    allow_autofill: Optional[bool] = None
    registration_open: Optional[bool] = None
    gate_validation_enabled: Optional[bool] = None
    food_validation_enabled: Optional[bool] = None

class EventResponse(BaseModel):
    id: str
    title: str
    slug: str
    description: Optional[str] = None
    event_type: str
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    venue: str
    start_time: str
    end_time: str
    registration_start: str
    registration_end: str
    capacity: int
    ticket_price: float
    first_year_ticket_price: float = 500.0
    second_year_ticket_price: float = 600.0
    other_ticket_price: Optional[float] = None
    allow_online: bool
    allow_offline: bool
    allow_autofill: bool
    registration_open: Optional[bool] = None
    gate_validation_enabled: bool
    food_validation_enabled: bool
    status: str
    created_at: str
