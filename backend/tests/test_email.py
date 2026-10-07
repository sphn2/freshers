from email import message_from_string
from email.policy import default

from app.config import config
from app.services.email_service import EmailService


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
