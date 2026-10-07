from datetime import datetime, timedelta, timezone
import uuid

import pytest
from pydantic import ValidationError

from app import create_app
from app.db import db
from app.schemas.offline import OfflineRegistrationRequest
from app.services.event_service import event_service
from app.services.offline_service import offline_service
from app.services.ticket_service import ticket_service


def test_offline_registration_uses_backend_amount_paid_field():
    with pytest.raises(ValidationError):
        OfflineRegistrationRequest(
            event_id=str(uuid.uuid4()),
            full_name="Offline Field Test",
            roll_number="25N81A0001",
            email="offline.field.test@sphoorthy.ac.in",
            phone="9876543218",
            department="CSE",
            amount_collected=600,
        )


def make_request(event_id: str, amount: float) -> OfflineRegistrationRequest:
    unique_id = str(uuid.uuid4())[:8]
    return OfflineRegistrationRequest(
        event_id=event_id,
        full_name="Offline Capacity Test",
        roll_number=f"26N81AO{unique_id}",
        email=f"offline.{unique_id}@sphoorthy.ac.in",
        phone="9876543218",
        department="CIVIL",
        amount_paid=amount,
    )


def prepare_event(event_id: str) -> dict:
    event = event_service.get_event_by_id(event_id)
    original = {
        key: event[key]
        for key in (
            "registration_start",
            "registration_end",
            "status",
            "capacity",
            "allow_offline",
            "registration_open",
        )
    }
    now = datetime.now(timezone.utc)
    db.execute_write(
        """UPDATE events SET registration_start = %s, registration_end = %s,
           status = %s, allow_offline = %s, registration_open = %s WHERE id = %s""",
        (
            (now - timedelta(days=1)).isoformat(),
            (now + timedelta(days=1)).isoformat(),
            "PUBLISHED",
            True,
            None,
            event_id,
        ),
    )
    return original


def restore_event(event_id: str, original: dict) -> None:
    db.execute_write(
        """UPDATE events SET registration_start = %s, registration_end = %s,
           status = %s, capacity = %s, allow_offline = %s,
           registration_open = %s WHERE id = %s""",
        (
            original["registration_start"],
            original["registration_end"],
            original["status"],
            original["capacity"],
            original["allow_offline"],
            original["registration_open"],
            event_id,
        ),
    )


def test_offline_registration_respects_registration_window_and_rolls_back():
    app = create_app()
    with app.app_context():
        event = event_service.get_event_by_slug("freshers-2k26")
        original = prepare_event(event["id"])
        request = make_request(event["id"], event["first_year_ticket_price"])
        future_start = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
        db.execute_write(
            "UPDATE events SET registration_start = %s WHERE id = %s",
            (future_start, event["id"]),
        )

        try:
            with pytest.raises(ValueError, match="Registration has not opened yet"):
                offline_service.register_offline_cash(request, "test-collector")
            assert db.execute_one(
                "SELECT id FROM registrations WHERE LOWER(email) = LOWER(%s)",
                (str(request.email),),
            ) is None
        finally:
            restore_event(event["id"], original)


def test_offline_registration_respects_event_capacity():
    app = create_app()
    with app.app_context():
        event = event_service.get_event_by_slug("freshers-2k26")
        original = prepare_event(event["id"])
        active_count = db.execute_one(
            "SELECT COUNT(*) AS total FROM registrations WHERE event_id = %s AND status != 'CANCELLED'",
            (event["id"],),
        )["total"]
        db.execute_write(
            "UPDATE events SET capacity = %s WHERE id = %s",
            (active_count, event["id"]),
        )

        try:
            with pytest.raises(ValueError, match="Event capacity reached"):
                offline_service.register_offline_cash(
                    make_request(event["id"], event["first_year_ticket_price"]),
                    "test-collector",
                )
        finally:
            restore_event(event["id"], original)


def test_offline_registration_commits_before_ticket_notification(monkeypatch):
    app = create_app()
    with app.app_context():
        event = event_service.get_event_by_slug("freshers-2k26")
        original = prepare_event(event["id"])
        request = make_request(event["id"], event["first_year_ticket_price"])
        notifications = []

        def assert_committed_before_email(ticket):
            registration = db.execute_one(
                "SELECT status FROM registrations WHERE id = %s",
                (ticket["registration_id"],),
            )
            assert registration["status"] == "OFFLINE_PAID"
            notifications.append(ticket["id"])

        monkeypatch.setattr(ticket_service, "send_ticket_email", assert_committed_before_email)
        try:
            response = offline_service.register_offline_cash(request, "test-collector")
            assert response.ticket_id in notifications
            assert db.execute_one(
                "SELECT id FROM offline_collections WHERE registration_id = %s",
                (response.registration_id,),
            ) is not None
            assert db.execute_one(
                "SELECT id FROM tickets WHERE id = %s AND registration_id = %s",
                (response.ticket_id, response.registration_id),
            ) is not None
        finally:
            restore_event(event["id"], original)


def test_offline_registration_rolls_back_if_ticket_issue_fails(monkeypatch):
    app = create_app()
    with app.app_context():
        event = event_service.get_event_by_slug("freshers-2k26")
        original = prepare_event(event["id"])
        request = make_request(event["id"], event["first_year_ticket_price"])
        attempted_ids = []

        def fail_ticket_issue(registration_id, send_notification=True):
            attempted_ids.append(registration_id)
            raise RuntimeError("ticket generation failed")

        monkeypatch.setattr(ticket_service, "issue_ticket", fail_ticket_issue)
        try:
            with pytest.raises(RuntimeError, match="ticket generation failed"):
                offline_service.register_offline_cash(request, "test-collector")
            assert len(attempted_ids) == 1
            assert db.execute_one(
                "SELECT id FROM registrations WHERE id = %s",
                (attempted_ids[0],),
            ) is None
            assert db.execute_one(
                "SELECT id FROM offline_collections WHERE registration_id = %s",
                (attempted_ids[0],),
            ) is None
        finally:
            restore_event(event["id"], original)
