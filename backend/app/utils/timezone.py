from datetime import datetime, timezone, timedelta

# Indian Standard Time (IST) is UTC + 5:30
IST = timezone(timedelta(hours=5, minutes=30))


def now_ist() -> datetime:
    """Return current datetime in IST."""
    return datetime.now(IST)


def now_ist_iso() -> str:
    """Return current datetime in IST formatted as ISO 8601 string (with +05:30 offset)."""
    return datetime.now(IST).isoformat()


def to_ist_datetime(val) -> datetime | None:
    """Convert a UTC or offset datetime or ISO string to an aware IST datetime."""
    if val is None:
        return None
    if isinstance(val, str):
        try:
            val = datetime.fromisoformat(val.replace("Z", "+00:00"))
        except Exception:
            return None
    if isinstance(val, datetime):
        if val.tzinfo is None:
            val = val.replace(tzinfo=timezone.utc)
        return val.astimezone(IST)
    return None


def to_ist_date_str(val) -> str:
    """Convert datetime or ISO string to YYYY-MM-DD date string in IST."""
    dt = to_ist_datetime(val)
    return dt.strftime("%Y-%m-%d") if dt else ""


def format_ist_display(val) -> str:
    """Format datetime or ISO string for human display in IST (e.g., 2026-10-27 10:30 AM)."""
    dt = to_ist_datetime(val)
    return dt.strftime("%Y-%m-%d %I:%M:%S %p") if dt else ""
