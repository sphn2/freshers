from datetime import datetime, timedelta, timezone
import uuid

import pytest

from app import create_app
from app.db import db
from app.schemas.event import EventCreate
from app.schemas.registration import RegistrationCreate
from app.services.event_service import event_service
from app.services.registration_service import registration_service


def test_event_creation_persists_year_specific_prices():
    app = create_app()
    with app.app_context():
        suffix = uuid.uuid4().hex[:8]
        now = datetime.now(timezone.utc)
        event = event_service.create_event(EventCreate(
            title=f"Pricing Test {suffix}",
            slug=f"pricing-test-{suffix}",
            venue="Test Venue",
            start_time=now + timedelta(days=3),
            end_time=now + timedelta(days=3, hours=2),
            registration_start=now - timedelta(days=1),
            registration_end=now + timedelta(days=2),
            capacity=10,
            ticket_price=250,
            first_year_ticket_price=510,
            second_year_ticket_price=620,
            status="DRAFT",
        ))
        try:
            assert event["first_year_ticket_price"] == 510
            assert event["second_year_ticket_price"] == 620
        finally:
            db.execute_write("DELETE FROM events WHERE id = %s", (event["id"],))


def test_manual_registration_override_open_and_close():
    app = create_app()
    with app.app_context():
        event = event_service.get_event_by_slug("freshers-2k26")
        original = {
            key: event[key]
            for key in ("status", "registration_start", "registration_end", "registration_open")
        }
        now = datetime.now(timezone.utc)
        db.execute_write(
            """UPDATE events SET status = %s, registration_start = %s,
               registration_end = %s, registration_open = %s WHERE id = %s""",
            (
                "PUBLISHED",
                (now + timedelta(days=5)).isoformat(),
                (now - timedelta(days=1)).isoformat(),
                True,
                event["id"],
            ),
        )
        user_id = uuid.uuid4().hex
        request = RegistrationCreate(
            event_id=event["id"],
            full_name="Manual Open Tester",
            roll_number=f"26N81M{user_id[:8]}",
            email=f"manual-open.{user_id[:8]}@sphoorthy.ac.in",
            phone="9876543218",
            department="CIVIL",
        )

        try:
            registration = registration_service.register_student(request)
            assert registration["status"] == "PENDING_PAYMENT"

            db.execute_write(
                "UPDATE events SET registration_open = %s WHERE id = %s",
                (False, event["id"]),
            )
            request.email = f"manual-closed.{user_id[:8]}@sphoorthy.ac.in"
            request.roll_number = f"26N81C{user_id[:8]}"
            with pytest.raises(ValueError, match="closed by the event organizer"):
                registration_service.register_student(request)

            db.execute_write(
                "UPDATE events SET registration_open = %s WHERE id = %s",
                (None, event["id"]),
            )
            request.email = f"scheduled.{user_id[:8]}@sphoorthy.ac.in"
            request.roll_number = f"26N81S{user_id[:8]}"
            with pytest.raises(ValueError, match="not opened yet"):
                registration_service.register_student(request)
        finally:
            db.execute_write(
                """UPDATE events SET status = %s, registration_start = %s,
                   registration_end = %s, registration_open = %s WHERE id = %s""",
                (
                    original["status"],
                    original["registration_start"],
                    original["registration_end"],
                    original["registration_open"],
                    event["id"],
                ),
            )


def test_event_manager_cannot_update_event_or_toggle_registrations():
    app = create_app()
    with app.app_context():
        event = event_service.get_event_by_slug("freshers-2k26")
        manager_id = str(uuid.uuid4())
        db.execute_write(
            "INSERT INTO event_managers (id, event_id, user_id, created_at) VALUES (%s, %s, %s, %s)",
            (str(uuid.uuid4()), event["id"], manager_id, datetime.now(timezone.utc).isoformat()),
        )
        with app.test_client() as client:
            headers = {
                "Authorization": "Bearer test-token-event-manager",
                "X-Test-User-Id": manager_id,
            }
            res = client.patch(
                f"/api/v1/admin/events/{event['id']}",
                json={"registration_open": False},
                headers=headers,
            )
        try:
            assert res.status_code == 403
            assert "Forbidden" in res.json["error"]
        finally:
            db.execute_write(
                "DELETE FROM event_managers WHERE user_id = %s AND event_id = %s",
                (manager_id, event["id"]),
            )


def test_edit_registration_email_and_resend_ticket():
    app = create_app()
    with app.app_context():
        event = event_service.get_event_by_slug("freshers-2k26")
        reg_id = str(uuid.uuid4())
        ticket_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        
        db.execute_write(
            """INSERT INTO registrations (id, event_id, full_name, roll_number, email, phone, department, ticket_price, status, created_at)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (reg_id, event["id"], "Test Student", "26N81A0599", "old.email@sphoorthy.ac.in", "9876543210", "CSE", 500.0, "PAID", now)
        )
        db.execute_write(
            """INSERT INTO tickets (id, event_id, registration_id, ticket_code, qr_token, status, created_at)
               VALUES (%s, %s, %s, %s, %s, %s, %s)""",
            (ticket_id, event["id"], reg_id, "TEST99", "qr_token_test_99", "ISSUED", now)
        )

        with app.test_client() as client:
            headers = {"Authorization": "Bearer test-token-admin"}
            
            # Edit email
            edit_res = client.patch(
                f"/api/v1/admin/registrations/{reg_id}/email",
                json={"email": "new.email@sphoorthy.ac.in"},
                headers=headers,
            )
            assert edit_res.status_code == 200
            assert edit_res.json["email"] == "new.email@sphoorthy.ac.in"

            # Verify DB updated
            updated_reg = db.execute_one("SELECT email FROM registrations WHERE id = %s", (reg_id,))
            assert updated_reg["email"] == "new.email@sphoorthy.ac.in"

            # Resend ticket
            resend_res = client.post(
                f"/api/v1/admin/registrations/{reg_id}/resend-ticket",
                headers=headers,
            )
            assert resend_res.status_code == 200
            assert "re-sent" in resend_res.json["message"]

        db.execute_write("DELETE FROM tickets WHERE id = %s", (ticket_id,))
        db.execute_write("DELETE FROM registrations WHERE id = %s", (reg_id,))
