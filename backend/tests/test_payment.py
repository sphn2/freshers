import pytest
import uuid
from app import create_app
from app.services.event_service import event_service
from app.services.registration_service import registration_service
from app.schemas.registration import RegistrationCreate

@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client

def test_payment_flow_and_idempotency(client):
    event = event_service.get_event_by_slug("freshers-2k26")
    uid = uuid.uuid4().hex[:6]
    reg_data = RegistrationCreate(
        event_id=event["id"],
        full_name="Payment Tester",
        roll_number=f"26N81PAY{uid}",
        email=f"payment.{uid}@sphoorthy.ac.in",
        phone="9123456780",
        department="CSE"
    )
    reg = registration_service.register_student(reg_data)

    # 1. Create Order
    headers = {"Authorization": "Bearer test-token-admin"}
    res_order = client.post(
        "/api/v1/payments/create-order",
        json={"registration_id": reg["id"]},
        headers={**headers, "X-Registration-Token": reg["payment_token"]},
    )
    assert res_order.status_code == 200
    assert "order_id" in res_order.json

    order_id = res_order.json["order_id"]

    # 2. Verify Payment
    verify_payload = {
        "registration_id": reg["id"],
        "razorpay_order_id": order_id,
        "razorpay_payment_id": f"pay_mock_{uid}",
        "razorpay_signature": "test_signature"
    }
    res_verify = client.post(
        "/api/v1/payments/verify",
        json=verify_payload,
        headers={**headers, "X-Registration-Token": reg["payment_token"]},
    )
    assert res_verify.status_code == 200
    assert res_verify.json["status"] == "PAID"
    assert "ticket_id" in res_verify.json
    assert len(res_verify.json["ticket_code"]) == 6

    # 3. Repeat verify to test idempotency
    res_repeat = client.post("/api/v1/payments/verify", json=verify_payload, headers=headers)
    assert res_repeat.status_code == 200
    assert res_repeat.json["ticket_code"] == res_verify.json["ticket_code"]


def test_guest_can_pay_and_open_ticket_with_scoped_capability(client):
    event = event_service.get_event_by_slug("freshers-2k26")
    uid = uuid.uuid4().hex[:8]
    registration = registration_service.register_student(RegistrationCreate(
        event_id=event["id"],
        full_name="Guest Payment Tester",
        roll_number=f"26N81G{uid}",
        email=f"guest.{uid}@sphoorthy.ac.in",
        phone="9123456780",
        department="CSE",
    ))
    registration_id = registration["id"]
    token = registration["payment_token"]
    assert "payment_access_token_hash" not in registration

    denied = client.post(
        "/api/v1/payments/create-order",
        json={"registration_id": registration_id},
    )
    assert denied.status_code == 403

    headers = {"X-Registration-Token": token}
    order = client.post(
        "/api/v1/payments/create-order",
        json={"registration_id": registration_id},
        headers=headers,
    )
    assert order.status_code == 200
    paid = client.post(
        "/api/v1/payments/verify",
        json={
            "registration_id": registration_id,
            "razorpay_order_id": order.json["order_id"],
            "razorpay_payment_id": f"guest_pay_{uid}",
            "razorpay_signature": "test_signature",
        },
        headers=headers,
    )
    assert paid.status_code == 200

    ticket = client.get(
        f"/api/v1/tickets/{paid.json['ticket_id']}",
        headers=headers,
    )
    assert ticket.status_code == 200
    assert ticket.json["ticket"]["registration_id"] == registration_id


def test_webhook_payment_failed_ignored_if_already_paid(client, monkeypatch):
    """
    Ensure that if a student is already PAID or ticket is issued,
    a subsequent or retried payment.failed webhook never sends a payment failure email.
    """
    from app.db import db
    from app.services.email_service import email_service
    sent_emails = []
    monkeypatch.setattr(email_service, "send_email", lambda *args, **kwargs: sent_emails.append(kwargs) or True)

    event = event_service.get_event_by_slug("freshers-2k26")
    uid = uuid.uuid4().hex[:8]
    registration = registration_service.register_student(RegistrationCreate(
        event_id=event["id"],
        full_name="Webhook Tester",
        roll_number=f"26N81W{uid}",
        email=f"webhook.{uid}@sphoorthy.ac.in",
        phone="9123456780",
        department="CSE",
    ))
    reg_id = registration["id"]
    token = registration["payment_token"]

    order = client.post(
        "/api/v1/payments/create-order",
        json={"registration_id": reg_id},
        headers={"X-Registration-Token": token},
    )
    order_id = order.json["order_id"]

    # Fulfill payment
    paid = client.post(
        "/api/v1/payments/verify",
        json={
            "registration_id": reg_id,
            "razorpay_order_id": order_id,
            "razorpay_payment_id": f"wh_pay_{uid}",
            "razorpay_signature": "test_signature",
        },
        headers={"X-Registration-Token": token},
    )
    assert paid.status_code == 200
    sent_emails.clear()

    # Razorpay sends payment.failed webhook for an earlier attempt on the same order
    webhook_payload = {
        "event": "payment.failed",
        "payload": {
            "payment": {
                "entity": {
                    "id": f"pay_failed_{uid}",
                    "order_id": order_id,
                }
            }
        }
    }
    res = client.post("/api/v1/webhooks/razorpay", json=webhook_payload)
    assert res.status_code == 200
    assert res.json.get("event") in ("ALREADY_PAID", "TICKET_ALREADY_ISSUED")
    # MUST NOT send any payment failure email!
    assert len(sent_emails) == 0


def test_webhook_payment_failed_idempotency_prevents_duplicate_emails(client, monkeypatch):
    """
    Ensure that if Razorpay retries payment.failed multiple times,
    at most ONE email is sent and duplicate retries are safely acknowledged without spamming.
    """
    from app.services.email_service import email_service
    sent_emails = []
    monkeypatch.setattr(email_service, "send_email", lambda *args, **kwargs: sent_emails.append(kwargs) or True)

    event = event_service.get_event_by_slug("freshers-2k26")
    uid = uuid.uuid4().hex[:8]
    registration = registration_service.register_student(RegistrationCreate(
        event_id=event["id"],
        full_name="Retry Tester",
        roll_number=f"26N81R{uid}",
        email=f"retry.{uid}@sphoorthy.ac.in",
        phone="9123456780",
        department="CSE",
    ))
    reg_id = registration["id"]
    token = registration["payment_token"]

    order = client.post(
        "/api/v1/payments/create-order",
        json={"registration_id": reg_id},
        headers={"X-Registration-Token": token},
    )
    order_id = order.json["order_id"]
    sent_emails.clear()

    webhook_payload = {
        "event": "payment.failed",
        "payload": {
            "payment": {
                "entity": {
                    "id": f"pay_failed_{uid}",
                    "order_id": order_id,
                }
            }
        }
    }

    # First webhook attempt
    res1 = client.post("/api/v1/webhooks/razorpay", json=webhook_payload)
    assert res1.status_code == 200
    assert len(sent_emails) == 1
    assert sent_emails[0]["template_name"] == "emails/payment_failed.html"

    # Razorpay retries 5 minutes later
    res2 = client.post("/api/v1/webhooks/razorpay", json=webhook_payload)
    assert res2.status_code == 200
    assert res2.json.get("event") in ("ALREADY_FAILED", "ALREADY_NOTIFIED")
    # Must STILL be only 1 email, never duplicated!
    assert len(sent_emails) == 1


def test_admin_resend_pay_mail_for_pending_and_paid(client, monkeypatch):
    """
    Ensure admin/coordinator 'Resend Pay Mail' works for pending payment,
    but protects already-paid students from duplicate payment links.
    """
    from app.services.email_service import email_service
    sent_emails = []
    monkeypatch.setattr(email_service, "send_email", lambda *args, **kwargs: sent_emails.append(kwargs) or True)

    event = event_service.get_event_by_slug("freshers-2k26")
    uid = uuid.uuid4().hex[:8]
    registration = registration_service.register_student(RegistrationCreate(
        event_id=event["id"],
        full_name="Admin Resend Tester",
        roll_number=f"26N81A{uid}",
        email=f"adminresend.{uid}@sphoorthy.ac.in",
        phone="9123456780",
        department="CSE",
    ))
    reg_id = registration["id"]
    token = registration["payment_token"]
    admin_headers = {"Authorization": "Bearer test-token-admin"}

    # 1. Admin clicks 'Resend Pay Mail' when status is PENDING_PAYMENT
    sent_emails.clear()
    res1 = client.post(
        f"/api/v1/admin/registrations/{reg_id}/resend-mail",
        json={"mail_type": "PAYMENT"},
        headers=admin_headers,
    )
    assert res1.status_code == 200
    assert len(sent_emails) == 1
    assert sent_emails[0]["template_name"] == "emails/registration_confirmed.html"

    # 2. Student pays and ticket is issued
    order = client.post(
        "/api/v1/payments/create-order",
        json={"registration_id": reg_id},
        headers=admin_headers,
    )
    assert order.status_code == 200
    client.post(
        "/api/v1/payments/verify",
        json={
            "registration_id": reg_id,
            "razorpay_order_id": order.json["order_id"],
            "razorpay_payment_id": f"pay_{uid}",
            "razorpay_signature": "test_signature",
        },
        headers=admin_headers,
    )

    # 3. Admin clicks 'Resend Pay Mail' on already-paid student -> should be blocked!
    sent_emails.clear()
    res2 = client.post(
        f"/api/v1/admin/registrations/{reg_id}/resend-mail",
        json={"mail_type": "PAYMENT"},
        headers=admin_headers,
    )
    assert res2.status_code == 400
    assert "already paid" in res2.json["error"].lower()
    assert len(sent_emails) == 0


