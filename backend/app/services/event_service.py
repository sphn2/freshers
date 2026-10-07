import uuid
from datetime import datetime, timezone
from app.db import db
from app.schemas.event import EventCreate, EventUpdate
from app.services.audit_service import audit_service

class EventService:
    @staticmethod
    def _normalize_event(event):
        if event is None:
            return None
        for field in (
            "allow_online",
            "allow_offline",
            "allow_autofill",
            "registration_open",
            "gate_validation_enabled",
            "food_validation_enabled",
        ):
            if event.get(field) is not None:
                event[field] = bool(event[field])
        return event

    @staticmethod
    def get_all_events(status_filter: str = None):
        if status_filter:
            events = db.execute_query("SELECT * FROM events WHERE status = %s ORDER BY start_time ASC", (status_filter,))
        else:
            events = db.execute_query("SELECT * FROM events ORDER BY start_time ASC")
        return [EventService._normalize_event(event) for event in events]

    @staticmethod
    def get_event_by_slug(slug: str):
        return EventService._normalize_event(db.execute_one("SELECT * FROM events WHERE slug = %s", (slug,)))

    @staticmethod
    def get_public_event_by_slug(slug: str):
        return EventService._normalize_event(db.execute_one(
            "SELECT * FROM events WHERE slug = %s AND status IN ('PUBLISHED', 'LIVE')",
            (slug,),
        ))

    @staticmethod
    def get_event_by_id(event_id: str):
        return EventService._normalize_event(db.execute_one("SELECT * FROM events WHERE id = %s", (event_id,)))

    @staticmethod
    def create_event(data: EventCreate, created_by_user_id: str = None):
        event_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        
        # Check slug uniqueness
        existing = db.execute_one("SELECT id FROM events WHERE slug = %s", (data.slug,))
        if existing:
            raise ValueError(f"Event with slug '{data.slug}' already exists.")

        # Use status from the create payload (DRAFT or PUBLISHED)
        event_status = getattr(data, 'status', 'DRAFT') or 'DRAFT'

        db.execute_write(
            """INSERT INTO events (
                id, title, slug, description, event_type, logo_url, banner_url, venue,
                start_time, end_time, registration_start, registration_end, capacity,
                ticket_price, first_year_ticket_price, second_year_ticket_price, other_ticket_price,
                allow_online, allow_offline, allow_autofill,
                registration_open, gate_validation_enabled, food_validation_enabled, status,
                created_by, created_at, updated_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s::boolean, %s::boolean, %s::boolean,
                %s::boolean, %s::boolean, %s::boolean, %s, %s, %s, %s
            )""",
            (
                event_id, data.title, data.slug, data.description, data.event_type,
                data.logo_url, data.banner_url, data.venue,
                data.start_time.isoformat(), data.end_time.isoformat(),
                data.registration_start.isoformat(), data.registration_end.isoformat(),
                data.capacity, data.ticket_price,
                data.first_year_ticket_price, data.second_year_ticket_price, data.other_ticket_price,
                bool(data.allow_online), bool(data.allow_offline), bool(data.allow_autofill),
                data.registration_open,
                bool(data.gate_validation_enabled), bool(data.food_validation_enabled),
                event_status, created_by_user_id, now, now
            )
        )
        
        audit_service.log("CREATE_EVENT", "event", event_id, created_by_user_id, {"title": data.title, "slug": data.slug, "status": event_status})
        return EventService.get_event_by_id(event_id)

    @staticmethod
    def update_event(event_id: str, data: EventUpdate, user_id: str = None):
        event = EventService.get_event_by_id(event_id)
        if not event:
            raise ValueError("Event not found.")

        fields = []
        params = []
        for key, value in data.model_dump(exclude_unset=True).items():
            if value is not None or key == "other_ticket_price":
                if isinstance(value, datetime):
                    value = value.isoformat()
                elif isinstance(value, bool):
                    value = bool(value)
                    fields.append(f"{key} = %s::boolean")
                    params.append(value)
                    continue
                fields.append(f"{key} = %s")
                params.append(value)

        if not fields:
            return event

        fields.append("updated_at = %s")
        params.append(datetime.now(timezone.utc).isoformat())
        params.append(event_id)

        query = f"UPDATE events SET {', '.join(fields)} WHERE id = %s"
        db.execute_write(query, tuple(params))
        
        audit_service.log("UPDATE_EVENT", "event", event_id, user_id, data.model_dump(exclude_unset=True))
        return EventService.get_event_by_id(event_id)

event_service = EventService()
