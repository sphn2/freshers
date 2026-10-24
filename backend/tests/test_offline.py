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


from werkzeug.security import generate_password_hash

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
            pin="123456",
        )


def make_request(event_id: str, amount: float, pin: str = "123456") -> OfflineRegistrationRequest:
    unique_id = str(uuid.uuid4())[:8]
    return OfflineRegistrationRequest(
        event_id=event_id,
        full_name="Offline Capacity Test",
        roll_number=f"26N81AO{unique_id}",
        email=f"offline.{unique_id}@sphoorthy.ac.in",
        phone="9876543218",
        department="CIVIL",
        amount_paid=amount,
        pin=pin,
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
    db.execute_write(
        """INSERT INTO profiles (id, email, full_name, pin_hash)
           VALUES (%s, %s, %s, %s)
           ON CONFLICT (id) DO UPDATE SET pin_hash = EXCLUDED.pin_hash""",
        ("test-collector", "test-collector@sphoorthy.ac.in", "Test Collector", generate_password_hash("123456")),
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


def test_offline_endpoints_require_offline_collector_privilege():
    app = create_app()
    with app.test_client() as client:
        # User has only EVENT_MANAGER role, with Cash Desk toggle OFF
        unauthorized_headers = {
            "Authorization": "Bearer test-token-event-manager",
            "X-Test-User-Roles": "EVENT_MANAGER",
        }
        summary_res = client.get("/api/v1/offline/summary", headers=unauthorized_headers)
        assert summary_res.status_code == 403
        assert "Forbidden" in summary_res.json["error"]

        reg_res = client.post("/api/v1/offline/registrations", json={}, headers=unauthorized_headers)
        assert reg_res.status_code == 403
        assert "Forbidden" in reg_res.json["error"]

        # User has OFFLINE_COLLECTOR role (Cash Desk toggle ON)
        authorized_headers = {
            "Authorization": "Bearer test-token-collector",
            "X-Test-User-Roles": "OFFLINE_COLLECTOR",
        }
        auth_summary_res = client.get("/api/v1/offline/summary", headers=authorized_headers)
        assert auth_summary_res.status_code == 200


def test_offline_registration_reuses_online_pending_payment(monkeypatch):
    app = create_app()
    with app.app_context():
        event = event_service.get_event_by_slug("freshers-2k26")
        original = prepare_event(event["id"])
        monkeypatch.setattr(ticket_service, "send_ticket_email", lambda ticket: None)

        unique_suffix = str(uuid.uuid4())[:8]
        roll = f"26N81A{unique_suffix}"
        email = f"pending.{unique_suffix}@sphoorthy.ac.in"
        reg_id = str(uuid.uuid4())
        pay_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        # Simulate student who tried online booking and abandoned before payment
        db.execute_write(
            """INSERT INTO registrations (
                id, event_id, user_id, full_name, roll_number, email, phone,
                department, college, ticket_price, status, payment_method, created_at, updated_at
            ) VALUES (%s, %s, NULL, %s, %s, %s, %s, %s, %s, %s, 'PENDING_PAYMENT', 'ONLINE', %s, %s)""",
            (
                reg_id, event["id"], "Pending Student", roll, email,
                "9876543210", "CSE", "Sphoorthy Engineering College",
                float(event["first_year_ticket_price"]), now, now,
            ),
        )
        db.execute_write(
            """INSERT INTO payments (
                id, registration_id, amount, status, payment_method, created_at, updated_at
            ) VALUES (%s, %s, %s, 'CREATED', 'RAZORPAY', %s, %s)""",
            (pay_id, reg_id, float(event["first_year_ticket_price"]), now, now),
        )

        try:
            # Collector at cash desk issues ticket to the same student
            req = OfflineRegistrationRequest(
                event_id=event["id"],
                full_name="Pending Student Updated",
                roll_number=roll,
                email=email,
                phone="9876543210",
                department="CSE",
                amount_paid=event["first_year_ticket_price"],
                pin="123456",
            )
            res = offline_service.register_offline_cash(req, "test-collector")

            # Registration ID should be reused (not duplicated)
            assert res.registration_id == reg_id
            assert res.ticket_code is not None

            # Database record updated to OFFLINE_PAID / CASH
            updated_reg = db.execute_one("SELECT * FROM registrations WHERE id = %s", (reg_id,))
            assert updated_reg["status"] == "OFFLINE_PAID"
            assert updated_reg["payment_method"] == "CASH"
            assert updated_reg["full_name"] == "Pending Student Updated"

            # Pending payment marked FAILED
            payment_row = db.execute_one("SELECT * FROM payments WHERE id = %s", (pay_id,))
            assert payment_row["status"] == "FAILED"

            # Offline collection recorded
            coll = db.execute_one("SELECT * FROM offline_collections WHERE registration_id = %s", (reg_id,))
            assert coll is not None
            assert coll["collector_id"] == "test-collector"

            # Trying to issue ticket again should raise error
            with pytest.raises(ValueError, match="A confirmed ticket already exists"):
                offline_service.register_offline_cash(req, "test-collector")
        finally:
            restore_event(event["id"], original)

