from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator


StaffRole = Literal["ADMIN", "EVENT_MANAGER", "GATE_STAFF", "FOOD_STAFF", "OFFLINE_COLLECTOR"]


class StaffAccountCreate(BaseModel):
    email: str = Field(..., min_length=5, max_length=254)
    full_name: str = Field(..., min_length=2, max_length=255)
    password: str = Field(..., min_length=12, max_length=128)
    role: StaffRole
    event_id: Optional[str] = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized.count("@") != 1 or "." not in normalized.rsplit("@", 1)[-1]:
            raise ValueError("Enter a valid email address.")
        return normalized

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, value: str) -> str:
        normalized = value.strip()
        if len(normalized) < 2:
            raise ValueError("Enter the staff member's full name.")
        return normalized

    @field_validator("event_id")
    @classmethod
    def validate_event_id(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None
