import uuid

import pytest

from app import create_app
from app.db import db
from app.schemas.registration import RegistrationCreate
from app.services.event_service import event_service
from app.services.registration_service import registration_service
from app.services.ticket_service import ticket_service


@pytest.fixture
def client():
    app = create_app()
    with app.test_client() as test_client:
        yield test_client


def test_gate_and_food_validation(client):
    event = event_service.get_event_by_slug("freshers-2k26")
    unique_id = str(uuid.uuid4())[:8]
    registration = registration_service.register_student(RegistrationCreate(
        event_id=event["id"],
        full_name="Gate Validation Tester",
        roll_number=f"26N81A{unique_id}",
        email=f"gate.test.{unique_id}@sphoorthy.ac.in",
        phone="9876543219",
        department="EEE",
    ))
    db.execute_write(
        "UPDATE registrations SET status = 'PAID' WHERE id = %s",
        (registration["id"],),
    )
    ticket = ticket_service.issue_ticket(registration["id"])
    gate_headers = {"Authorization": "Bearer test-token-gate-staff"}
    food_headers = {"Authorization": "Bearer test-token-food-staff"}

    gate_payload = {
        "event_id": event["id"],
        "ticket_code": ticket["ticket_code"],
        "gate_location": "Gate 2 Main",
    }
    queued_email_count = db.execute_one(
        """SELECT COUNT(*) AS count FROM email_outbox
           WHERE recipient = %s
             AND template_name IN (
               'emails/gate_validated.html',
               'emails/food_validated.html'
           )""",
        (f"gate.test.{unique_id}@sphoorthy.ac.in",),
    )["count"]
    first_gate = client.post(
        "/api/v1/validation/gate", json=gate_payload, headers=gate_headers
    )
    assert first_gate.status_code == 200
    assert first_gate.json["status"] == "VALID"
    assert first_gate.json["student_name"] == "Gate Validation Tester"

    scanned_gate = client.post(
        "/api/v1/validation/gate",
        json={
            "event_id": event["id"],
            "qr_token": ticket["qr_token"],
            "gate_location": "Gate 2 Main",
        },
        headers=gate_headers,
    )
    assert scanned_gate.status_code == 200
    assert scanned_gate.json["status"] == "ALREADY_USED"

    duplicate_gate = client.post(
        "/api/v1/validation/gate", json=gate_payload, headers=gate_headers
    )
    assert duplicate_gate.status_code == 200
    assert duplicate_gate.json["status"] == "ALREADY_USED"

    food_payload = {
        "event_id": event["id"],
        "qr_token": ticket["qr_token"],
        "food_location": "Counter B",
    }
    first_food = client.post(
        "/api/v1/validation/food", json=food_payload, headers=food_headers
    )
    assert first_food.status_code == 200
    assert first_food.json["status"] == "VALID"

    duplicate_food = client.post(
        "/api/v1/validation/food", json=food_payload, headers=food_headers
    )
    assert duplicate_food.status_code == 200
    assert duplicate_food.json["status"] == "FOOD_ALREADY_CLAIMED"
    queued_emails = db.execute_query(
        """SELECT template_name, recipient, context, status FROM email_outbox
           WHERE recipient = %s
             AND template_name IN (
               'emails/gate_validated.html',
               'emails/food_validated.html'
           )
           ORDER BY template_name""",
        (f"gate.test.{unique_id}@sphoorthy.ac.in",),
    )
    assert len(queued_emails) == 2
    assert all(email["status"] == "PENDING" for email in queued_emails)
    assert {email["template_name"] for email in queued_emails} == {
        "emails/gate_validated.html",
        "emails/food_validated.html",
    }
    assert db.execute_one(
        """SELECT COUNT(*) AS count FROM email_outbox
           WHERE recipient = %s
             AND template_name IN (
               'emails/gate_validated.html',
               'emails/food_validated.html'
           )""",
        (f"gate.test.{unique_id}@sphoorthy.ac.in",),
    )["count"] == queued_email_count + 2


def test_event_manager_validation_is_limited_to_assigned_events(client):
    event = event_service.get_event_by_slug("freshers-2k26")
    manager_id = str(uuid.uuid4())
    db.execute_write(
        "INSERT INTO event_managers (id, event_id, user_id, created_at) VALUES (%s, %s, %s, %s)",
        (str(uuid.uuid4()), event["id"], manager_id, "2026-10-07T00:00:00+00:00"),
    )
    headers = {
        "Authorization": "Bearer test-token-event-manager",
        "X-Test-User-Id": manager_id,
    }
    try:
        allowed = client.post(
            "/api/v1/validation/gate",
            json={"event_id": event["id"], "ticket_code": "123456"},
            headers=headers,
        )
        denied = client.post(
            "/api/v1/validation/food",
            json={"event_id": str(uuid.uuid4()), "ticket_code": "123456"},
            headers=headers,
        )
        assert allowed.status_code == 200
        assert allowed.json["status"] == "INVALID_TICKET"
        assert denied.status_code == 403
    finally:
        db.execute_write(
            "DELETE FROM event_managers WHERE user_id = %s AND event_id = %s",
            (manager_id, event["id"]),
        )
