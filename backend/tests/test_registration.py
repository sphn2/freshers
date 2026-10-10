import pytest
import uuid
import json
from app import create_app
from app.services.event_service import event_service
from app.services.registration_service import registration_service
from app.schemas.registration import RegistrationCreate
from app.db import db

@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client

def test_student_autofill_lookup(client):
    event = event_service.get_event_by_slug("freshers-2k26")
    res = client.get(
        f"/api/v1/events/{event['id']}/autofill/21N81A0501",
        headers={
            "Authorization": "Bearer test-token-student",
            "X-Test-User-Email": "harsha@sphoorthy.ac.in",
        },
    )
    assert res.status_code == 200
    assert res.json["full_name"] == "Sai Harsha"
    assert res.json["department"] == "CSE"

def test_successful_registration(client):
    event = event_service.get_event_by_slug("freshers-2k26")
    uid = uuid.uuid4().hex[:6]
    payload = {
        "full_name": "Kavya Sharma",
        "roll_number": f"26N81A{uid}",
        "email": f"kavya.{uid}@sphoorthy.ac.in",
        "phone": "9988776655",
        "department": "ECE",
        "college": "Sphoorthy Engineering College"
    }
    res = client.post(
        f"/api/v1/events/{event['id']}/register",
        json=payload,
        headers={"Authorization": "Bearer test-token-student"},
    )
    assert res.status_code == 201
    assert res.json["registration"]["status"] == "PENDING_PAYMENT"
    assert res.json["payment_token"]
    assert res.json["registration"]["ticket_price"] == 500
    assert res.json["payment_link_sent"] is False
    assert db.execute_one(
        "SELECT COUNT(*) AS count FROM email_logs WHERE recipient = %s",
        (payload["email"],),
    )["count"] == 0

def test_duplicate_registration_prevention(client):
    event = event_service.get_event_by_slug("freshers-2k26")
    uid = uuid.uuid4().hex[:6]
    roll = f"26N81ADUP{uid}"
    payload1 = {
        "full_name": "Kavya Original",
        "roll_number": roll,
        "email": f"kavya.orig.{uid}@sphoorthy.ac.in",
        "phone": "9988776655",
        "department": "ECE"
    }
    headers = {"Authorization": "Bearer test-token-student"}
    res1 = client.post(f"/api/v1/events/{event['id']}/register", json=payload1, headers=headers)
    assert res1.status_code == 201

    payload2 = {
        "full_name": "Kavya Duplicate",
        "roll_number": roll,
        "email": f"kavya.dup.{uid}@sphoorthy.ac.in",
        "phone": "9988776655",
        "department": "ECE"
    }
    res2 = client.post(f"/api/v1/events/{event['id']}/register", json=payload2, headers=headers)
    assert res2.status_code == 400


def test_public_registration_reuses_pending_booking_and_resends_pay_link(client):
    event = event_service.get_event_by_slug("freshers-2k26")
    uid = uuid.uuid4().hex[:8]
    payload = {
        "full_name": "Public Registration Tester",
        "roll_number": f"26N81R{uid}",
        "email": f"public.{uid}@sphoorthy.ac.in",
        "phone": "9988776655",
        "department": "ECE",
    }
    first = client.post(f"/api/v1/events/{event['id']}/register", json=payload)
    retry = client.post(f"/api/v1/events/{event['id']}/register", json=payload)

    assert first.status_code == 201
    assert retry.status_code in (200, 201)
    assert retry.json["payment_token"]
    assert retry.json["registration"]["id"] == first.json["registration"]["id"]
    assert db.execute_one(
        "SELECT COUNT(*) AS count FROM registrations WHERE id = %s",
        (first.json["registration"]["id"],),
    )["count"] == 1


def test_checkout_sends_pending_payment_email_without_blocking_registration(client):
    event = event_service.get_event_by_slug("freshers-2k26")
    uid = uuid.uuid4().hex[:8]
    payload = {
        "full_name": "Checkout Email Tester",
        "roll_number": f"26N81EMAIL{uid}",
        "email": f"checkout.email.{uid}@sphoorthy.ac.in",
        "phone": "9988776655",
        "department": "ECE",
    }
    first = client.post(f"/api/v1/events/{event['id']}/register", json=payload)
    registration_id = first.json["registration"]["id"]
    token = first.json["payment_token"]
    unauthorized = client.post(
        f"/api/v1/registrations/{registration_id}/payment-link-email",
    )
    assert unauthorized.status_code == 403

    response = client.post(
        f"/api/v1/registrations/{registration_id}/payment-link-email",
        headers={"X-Registration-Token": token},
    )
    repeated = client.post(
        f"/api/v1/registrations/{registration_id}/payment-link-email",
        headers={"X-Registration-Token": token},
    )

    assert response.status_code == 200
    assert repeated.status_code == 200
    email_logs = db.execute_query(
        """SELECT metadata FROM email_logs
           WHERE template_name = %s AND status = 'MOCKED'""",
        ("emails/registration_confirmed.html",),
    )
    assert sum(
        1
        for row in email_logs
        if (
            json.loads(row["metadata"])
            if isinstance(row["metadata"], str)
            else row["metadata"]
        ).get("registration_id") == registration_id
    ) == 1


def test_public_registration_prices_by_roll_prefix(client):
    event = event_service.get_event_by_slug("freshers-2k26")
    uid = uuid.uuid4().hex[:8]
    response = client.post(
        f"/api/v1/events/{event['id']}/register",
        json={
            "full_name": "Second Year Tester",
            "roll_number": f"25N81B{uid}",
            "email": f"second.{uid}@sphoorthy.ac.in",
            "phone": "9988776655",
            "department": "ECE",
        },
    )
    assert response.status_code == 201
    assert response.json["registration"]["ticket_price"] == 600


def test_public_registration_rejects_unknown_roll_prefix(client):
    event = event_service.get_event_by_slug("freshers-2k26")
    uid = uuid.uuid4().hex[:8]
    response = client.post(
        f"/api/v1/events/{event['id']}/register",
        json={
            "full_name": "Unknown Year Tester",
            "roll_number": f"24N81B{uid}",
            "email": f"unknown.{uid}@sphoorthy.ac.in",
            "phone": "9988776655",
            "department": "ECE",
        },
    )
    assert response.status_code == 400
    assert "not eligible" in response.json["error"]


def test_unpaid_registration_becomes_one_free_ticket_if_rate_is_changed_to_zero():
    event = event_service.get_event_by_slug("freshers-2k26")
    original_price = event["first_year_ticket_price"]
    uid = uuid.uuid4().hex[:8]
    payload = RegistrationCreate(
        event_id=event["id"],
        full_name="Fee Change Tester",
        roll_number=f"26N81F{uid}",
        email=f"fee-change.{uid}@sphoorthy.ac.in",
        phone="9988776655",
        department="ECE",
    )
    first = registration_service.register_student(payload)
    db.execute_write(
        "UPDATE events SET first_year_ticket_price = 0 WHERE id = %s",
        (event["id"],),
    )
    try:
        retried = registration_service.register_student(payload)
        assert retried["id"] == first["id"]
        assert retried["status"] == "PAID"
        assert retried["ticket_id"]
        assert db.execute_one(
            "SELECT COUNT(*) AS count FROM registrations WHERE id = %s",
            (first["id"],),
        )["count"] == 1
    finally:
        db.execute_write(
            "UPDATE events SET first_year_ticket_price = %s WHERE id = %s",
            (original_price, event["id"]),
        )
        db.execute_write("DELETE FROM tickets WHERE registration_id = %s", (first["id"],))
        db.execute_write("DELETE FROM registrations WHERE id = %s", (first["id"],))


def test_public_event_route_hides_draft_events(client):
    event = event_service.get_event_by_slug("freshers-2k26")
    original_status = event["status"]
    db.execute_write("UPDATE events SET status = %s WHERE id = %s", ("DRAFT", event["id"]))
    try:
        response = client.get(f"/api/v1/events/{event['slug']}")
        assert response.status_code == 404
    finally:
        db.execute_write(
            "UPDATE events SET status = %s WHERE id = %s",
            (original_status, event["id"]),
        )
