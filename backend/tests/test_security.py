import csv
import hashlib
import hmac
import io
import json
import time

import jwt
import pytest

from app.config import config
from app.db import db
from app.middleware.auth import _decode_supabase_token
from app.services.payment_service import PaymentService
from app.services.report_service import ReportService
from app.utils.security import generate_signed_qr_token, verify_signed_qr_token


def test_supabase_token_requires_expected_issuer_and_audience(monkeypatch):
    secret = "test-supabase-jwt-secret"
    project_url = "https://test-project.supabase.co"
    monkeypatch.setattr(config, "SUPABASE_JWKS_URL", "")
    monkeypatch.setattr(config, "SUPABASE_JWT_SECRET", secret)
    monkeypatch.setattr(config, "SUPABASE_URL", project_url)

    claims = {
        "exp": int(time.time()) + 300,
        "iat": int(time.time()),
        "sub": "user-123",
        "aud": "authenticated",
        "iss": f"{project_url}/auth/v1",
    }
    valid_token = jwt.encode(claims, secret, algorithm="HS256")
    assert _decode_supabase_token(valid_token)["sub"] == "user-123"

    for invalid_claim in ({"iss": "https://attacker.example"}, {"aud": "anon"}):
        token = jwt.encode({**claims, **invalid_claim}, secret, algorithm="HS256")
        with pytest.raises(jwt.PyJWTError):
            _decode_supabase_token(token)


def test_signed_qr_rejects_tampering():
    token = generate_signed_qr_token("ticket-123", "event-456")
    verified = verify_signed_qr_token(token)
    assert verified is not None
    assert verified["tid"] == "ticket-123"
    assert verified["eid"] == "event-456"

    tampered = token[:-1] + ("0" if token[-1] != "0" else "1")
    assert verify_signed_qr_token(tampered) is None


def test_csv_export_escapes_spreadsheet_formulas(monkeypatch):
    row = {
        "id": "registration-1",
        "event_title": "Event",
        "full_name": "=HYPERLINK(\"https://attacker.example\")",
        "roll_number": "+cmd|' /C calc'!A0",
        "email": "student@example.com\n@SUM(A1:A2)",
        "phone": "1234567890",
        "department": "CSE",
        "college": "College",
        "status": "PAID",
        "payment_method": "ONLINE",
        "ticket_price": 250,
        "created_at": "2026-01-01T00:00:00Z",
    }
    monkeypatch.setattr(
        ReportService,
        "get_registrations_report",
        staticmethod(lambda event_id=None, limit=5000: [row]),
    )

    exported = ReportService.export_registrations_csv()
    result = next(csv.reader(io.StringIO(exported)))[0]
    assert result == "Registration ID"
    exported_row = list(csv.reader(io.StringIO(exported)))[1]
    assert exported_row[2] == "'=HYPERLINK(\"https://attacker.example\")"
    assert exported_row[3].startswith("'+cmd")
    assert exported_row[4] == "student@example.com @SUM(A1:A2)"


def test_webhook_does_not_fulfill_authorized_payment(monkeypatch):
    secret = "test-razorpay-webhook-secret"
    payment = {
        "id": "payment-record-1",
        "registration_id": "registration-1",
        "amount": 250.0,
        "currency": "INR",
    }
    event = {
        "event": "payment.captured",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay-1",
                    "order_id": "order-1",
                    "status": "authorized",
                    "amount": 25000,
                    "currency": "INR",
                }
            }
        },
    }
    raw_body = json.dumps(event).encode()
    signature = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    fulfilled = []
    monkeypatch.setattr(config, "RAZORPAY_WEBHOOK_SECRET", secret)
    monkeypatch.setattr(db, "execute_one", lambda query, params=(): payment)
    monkeypatch.setattr(
        PaymentService,
        "_fulfill_payment",
        staticmethod(lambda *args: fulfilled.append(args)),
    )

    with pytest.raises(ValueError, match="Captured payment does not match"):
        PaymentService.process_webhook(raw_body, signature)
    assert fulfilled == []
