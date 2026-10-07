from email import message_from_string
from email.policy import default

from app.config import config
from app.services.email_service import EmailService
from app.db import db


def test_ticket_email_embeds_qr_as_inline_mime_image(monkeypatch):
    sent = {}

    class FakeSMTP:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def starttls(self):
            pass

        def login(self, *args):
            pass

        def sendmail(self, sender, recipient, message):
            sent["message"] = message

    monkeypatch.setattr(config, "SMTP_USERNAME", "smtp-user")
    monkeypatch.setattr(config, "SMTP_PASSWORD", "smtp-password")
    monkeypatch.setattr("app.services.email_service.smtplib.SMTP", FakeSMTP)
    monkeypatch.setattr(
        "app.services.email_service.db.execute_write",
        lambda *args, **kwargs: 1,
    )

    service = EmailService()
    delivered = service.send_email(
        recipient="student@example.com",
        subject="Your event ticket",
        template_name="emails/ticket_issued.html",
        context={
            "student_name": "Test Student",
            "event_title": "Test Event",
            "ticket_code": "123456",
            "roll_number": "26TEST0001",
            "department": "CSE",
            "venue": "Main Hall",
            "event_time": "2026-10-07 10:00",
            "qr_image": "cid:ticket-qr",
            "ticket_url": "https://example.com/tickets/test",
        },
        inline_images={"ticket-qr": b"\x89PNG\r\n\x1a\nimage-data"},
        metadata={"registration_id": "registration-test"},
    )

    message = message_from_string(sent["message"], policy=default)
    images = [part for part in message.walk() if part.get_content_type() == "image/png"]
    html_parts = [
        part for part in message.walk()
        if part.get_content_type() == "text/html"
    ]

    assert delivered is True
    assert message.get_content_type() == "multipart/related"
    inline_images = [part for part in images if part.get_content_disposition() == "inline"]
    attached_images = [part for part in images if part.get_content_disposition() == "attachment"]
    assert len(inline_images) == 1
    assert inline_images[0]["Content-ID"] == "<ticket-qr>"
    assert inline_images[0].get_filename() == "ticket-qr.png"
    assert len(attached_images) == 1
    assert attached_images[0].get_filename() == "ticket-qr.png"
    assert len(html_parts) == 1
    assert 'src="cid:ticket-qr"' in html_parts[0].get_content()


def test_outbox_worker_sends_one_queued_email_without_inline_smtp(monkeypatch):
    service = EmailService()
    sent = []
    db.execute_write("DELETE FROM email_outbox")
    job_id = service.enqueue_email(
        recipient="student@example.com",
        subject="Food Coupon Claimed — Test Event",
        template_name="emails/food_validated.html",
        context={
            "student_name": "Test Student",
            "event_title": "Test Event",
            "ticket_code": "123456",
            "food_location": "Counter A",
            "validated_at": "2026-10-07T00:00:00+00:00",
        },
    )
    monkeypatch.setattr(
        service,
        "send_email",
        lambda **kwargs: sent.append(kwargs) or True,
    )

    result = service.process_next_queued_email()

    assert result == {"processed": True, "status": "SENT"}
    assert len(sent) == 1
    assert sent[0]["recipient"] == "student@example.com"
    assert sent[0]["context"]["ticket_code"] == "123456"
    row = db.execute_one(
        "SELECT status, attempts FROM email_outbox WHERE id = %s",
        (job_id,),
    )
    assert row == {"status": "SENT", "attempts": 1}


def test_outbox_worker_retries_failed_email(monkeypatch):
    service = EmailService()
    db.execute_write("DELETE FROM email_outbox")
    job_id = service.enqueue_email(
        recipient="student@example.com",
        subject="Ticket Validated — Test Event",
        template_name="emails/gate_validated.html",
        context={
            "student_name": "Test Student",
            "event_title": "Test Event",
            "ticket_code": "123456",
            "gate_location": "Gate 1",
            "validated_at": "2026-10-07T00:00:00+00:00",
        },
    )
    monkeypatch.setattr(service, "send_email", lambda **kwargs: False)

    result = service.process_next_queued_email()

    assert result == {"processed": True, "status": "PENDING"}
    row = db.execute_one(
        "SELECT status, attempts, last_error FROM email_outbox WHERE id = %s",
        (job_id,),
    )
    assert row == {
        "status": "PENDING",
        "attempts": 1,
        "last_error": "Email delivery failed",
    }


def test_email_outbox_worker_requires_bearer_secret(monkeypatch):
    from app import create_app
    from app.config import config

    secret = "worker-secret-for-tests-at-least-32"
    monkeypatch.setattr(config, "EMAIL_OUTBOX_WORKER_SECRET", secret)
    monkeypatch.setattr(
        "app.api.v1.email_outbox.email_service.process_next_queued_email",
        lambda: {"processed": False, "status": "EMPTY"},
    )
    app = create_app()
    with app.test_client() as client:
        unauthorized = client.post("/api/v1/internal/email-outbox/process")
        assert unauthorized.status_code == 401

        authorized = client.post(
            "/api/v1/internal/email-outbox/process",
            headers={"Authorization": f"Bearer {secret}"},
        )
        assert authorized.status_code == 200
        assert authorized.json == {"processed": False, "status": "EMPTY"}
