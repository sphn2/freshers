from datetime import datetime, timezone

from app.db import db


def _as_utc_datetime(value) -> datetime:
    timestamp = value if isinstance(value, datetime) else datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=timezone.utc)
    return timestamp.astimezone(timezone.utc)


def ensure_registration_window_open(event: dict, now: datetime) -> None:
    if event["status"] not in ("PUBLISHED", "LIVE"):
        raise ValueError(f"Registration unavailable. Event status is {event['status']}.")
    registration_override = event.get("registration_open")
    if registration_override is not None and not bool(registration_override):
        raise ValueError("Registration is currently closed by the event organizer.")

    if not bool(registration_override):
        registration_start = event.get("registration_start")
        if registration_start and now < _as_utc_datetime(registration_start):
            raise ValueError("Registration has not opened yet.")

        registration_end = event.get("registration_end")
        if registration_end and now > _as_utc_datetime(registration_end):
            raise ValueError("Registration closed. Registration deadline has passed.")


def ensure_event_capacity_available(event: dict) -> None:
    count_row = db.execute_one(
        "SELECT COUNT(*) as total FROM registrations WHERE event_id = %s AND status != 'CANCELLED'",
        (event["id"],),
    )
    current_count = count_row["total"] if count_row else 0
    if current_count >= event["capacity"]:
        raise ValueError("Event capacity reached. No further registrations allowed.")
