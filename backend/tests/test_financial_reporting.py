import uuid
from datetime import datetime, timezone
import pytest

from app import create_app
from app.db import db
from app.services.report_service import report_service


@pytest.fixture
def app():
    app = create_app()
    return app


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def sample_event():
    event_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    db.execute_write(
        """INSERT INTO events (id, title, slug, venue, start_time, end_time,
                               registration_start, registration_end, capacity, ticket_price, status)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
        (
            event_id,
            "Financial Test Gala",
            f"gala-{event_id[:8]}",
            "Main Auditorium",
            now,
            now,
            now,
            now,
            1000,
            500.0,
            "PUBLISHED",
        ),
    )
    return event_id


def test_daily_revenue_report_and_collector_breakdown(sample_event):
    event_id = sample_event
    today_date = "2026-10-14"
    timestamp_today = f"{today_date}T10:00:00+00:00"

    # 1. Create an online paid registration + payment + ticket
    reg_id_online = str(uuid.uuid4())
    db.execute_write(
        """INSERT INTO registrations (id, event_id, full_name, roll_number, email, phone, department, ticket_price, status, payment_method, created_at)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
        (
            reg_id_online,
            event_id,
            "Online Student",
            f"26N81A{str(uuid.uuid4())[:4]}",
            f"online.{reg_id_online[:6]}@sphoorthy.ac.in",
            "9876543210",
            "CSE",
            500.0,
            "PAID",
            "ONLINE",
            timestamp_today,
        ),
    )
    pay_id = str(uuid.uuid4())
    db.execute_write(
        """INSERT INTO payments (id, registration_id, amount, status, payment_method, created_at)
           VALUES (%s, %s, %s, %s, %s, %s)""",
        (pay_id, reg_id_online, 500.0, "PAID", "RAZORPAY", timestamp_today),
    )
    t_id_online = str(uuid.uuid4())
    db.execute_write(
        """INSERT INTO tickets (id, event_id, registration_id, ticket_code, qr_token, status, created_at)
           VALUES (%s, %s, %s, %s, %s, %s, %s)""",
        (t_id_online, event_id, reg_id_online, "ONL001", str(uuid.uuid4()), "ISSUED", timestamp_today),
    )

    # 2. Create an offline cash registration + offline_collection + ticket
    collector_id = str(uuid.uuid4())
    db.execute_write(
        """INSERT INTO profiles (id, email, full_name, created_at)
           VALUES (%s, %s, %s, %s)""",
        (collector_id, "collector@sphoorthy.ac.in", "Collector Sam", timestamp_today),
    )

    reg_id_cash = str(uuid.uuid4())
    db.execute_write(
        """INSERT INTO registrations (id, event_id, full_name, roll_number, email, phone, department, ticket_price, status, payment_method, created_at)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
        (
            reg_id_cash,
            event_id,
            "Cash Student",
            f"26N81A{str(uuid.uuid4())[:4]}",
            f"cash.{reg_id_cash[:6]}@sphoorthy.ac.in",
            "9876543211",
            "ECE",
            500.0,
            "OFFLINE_PAID",
            "CASH",
            timestamp_today,
        ),
    )
    coll_id = str(uuid.uuid4())
    db.execute_write(
        """INSERT INTO offline_collections (id, collector_id, event_id, registration_id, amount, payment_method, receipt_number, created_at)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
        (coll_id, collector_id, event_id, reg_id_cash, 500.0, "CASH", "RCPT-OFF-001", timestamp_today),
    )
    t_id_cash = str(uuid.uuid4())
    db.execute_write(
        """INSERT INTO tickets (id, event_id, registration_id, ticket_code, qr_token, status, created_at)
           VALUES (%s, %s, %s, %s, %s, %s, %s)""",
        (t_id_cash, event_id, reg_id_cash, "CSH001", str(uuid.uuid4()), "ISSUED", timestamp_today),
    )

    # 3. Test report_service.get_daily_revenue_report
    report = report_service.get_daily_revenue_report(event_id=event_id)
    assert len(report["online"]) >= 1
    online_row = [r for r in report["online"] if r["date"] == today_date][0]
    assert online_row["channel"] == "ONLINE"
    assert online_row["tickets_issued"] >= 1
    assert online_row["first_year_tickets"] >= 1
    assert online_row["second_year_tickets"] == 0
    assert online_row["amount"] >= 500.0
    assert online_row["cumulative_tickets"] >= 1
    assert online_row["cumulative_amount"] >= 500.0

    assert len(report["cash"]) >= 1
    cash_row = [r for r in report["cash"] if r["date"] == today_date][0]
    assert cash_row["channel"] == "CASH"
    assert cash_row["tickets_issued"] >= 1
    assert cash_row["first_year_tickets"] >= 1
    assert cash_row["second_year_tickets"] == 0
    assert cash_row["amount"] >= 500.0
    assert cash_row["cumulative_tickets"] >= 1
    assert cash_row["cumulative_amount"] >= 500.0

    assert report["totals"]["total_online_tickets"] >= 1
    assert report["totals"]["total_online_first_year_tickets"] >= 1
    assert report["totals"]["total_cash_tickets"] >= 1
    assert report["totals"]["total_cash_first_year_tickets"] >= 1
    assert report["totals"]["total_tickets"] >= 2
    assert report["totals"]["total_first_year_tickets"] >= 2
    assert report["totals"]["total_second_year_tickets"] == 0
    assert report["totals"]["total_amount"] >= 1000.0

    # 4. Test report_service.get_daily_collector_breakdown
    breakdown = report_service.get_daily_collector_breakdown(event_id=event_id, target_date=today_date)
    assert len(breakdown) >= 1
    matching_collector = [c for c in breakdown if c["collector_id"] == collector_id][0]
    assert matching_collector["collector_name"] == "Collector Sam"
    assert matching_collector["collector_email"] == "collector@sphoorthy.ac.in"
    assert matching_collector["tickets_count"] >= 1
    assert matching_collector["total_cash"] >= 500.0


def test_settlement_lifecycle(sample_event):
    event_id = sample_event
    test_date = f"2026-11-{str(uuid.uuid4().int)[:2].zfill(2)}"
    admin_id = str(uuid.uuid4())

    # 1. Create settlement
    record = report_service.create_settlement(
        event_id=event_id,
        settlement_date=test_date,
        total_online_amount=15000.0,
        total_cash_amount=5000.0,
        total_tickets_issued=40,
        created_by=admin_id,
    )
    assert record["id"] is not None
    assert record["settlement_date"] == test_date
    assert record["total_amount"] == 20000.0
    assert record["receipt_number"].startswith("RCPT-")
    assert bool(record["is_settled"]) is False

    # 2. Prevent duplicate settlement for same date + event
    with pytest.raises(ValueError, match="already exists"):
        report_service.create_settlement(
            event_id=event_id,
            settlement_date=test_date,
            total_online_amount=0,
            total_cash_amount=0,
            total_tickets_issued=0,
            created_by=admin_id,
        )

    # 3. Retrieve list and by ID
    s_list = report_service.get_settlement_list(event_id=event_id)
    assert any(s["id"] == record["id"] for s in s_list)

    s_single = report_service.get_settlement_by_id(record["id"])
    assert s_single["id"] == record["id"]
    assert s_single["event_title"] == "Financial Test Gala"

    # 4. Mark as settled
    settled_record = report_service.mark_settlement_settled(
        settlement_id=record["id"],
        settled_by=admin_id,
        receiver_name="Sphoorthy College Trust",
        bank_name="State Bank of India",
        account_number="123456789012",
        ifsc_code="SBIN0001234",
        transaction_id="UTR998877665544",
        transaction_date=test_date,
        notes="Transferred to college bank account",
        authorized_by_name="Dr. Director",
    )
    assert bool(settled_record["is_settled"]) is True
    assert settled_record["transaction_id"] == "UTR998877665544"
    assert settled_record["bank_name"] == "State Bank of India"
    assert settled_record["receiver_name"] == "Sphoorthy College Trust"
    assert settled_record["settled_at"] is not None

    # 5. Immutability: Attempting to settle again must raise ValueError
    with pytest.raises(ValueError, match="already been marked as settled"):
        report_service.mark_settlement_settled(
            settlement_id=record["id"],
            settled_by=admin_id,
            receiver_name="Duplicate",
            bank_name="Duplicate",
            account_number="1111",
            ifsc_code="IFSC",
            transaction_id="UTR000",
            transaction_date=test_date,
            notes="",
            authorized_by_name="",
        )


def test_api_admin_financial_endpoints(client, sample_event):
    event_id = sample_event

    # 1. Access without auth -> 401
    res = client.get(f"/api/v1/admin/reports/daily-revenue?event_id={event_id}")
    assert res.status_code == 401

    # 2. Student role -> 403 Forbidden
    res = client.get(
        f"/api/v1/admin/reports/daily-revenue?event_id={event_id}",
        headers={"Authorization": "Bearer test-token-student"},
    )
    assert res.status_code == 403

    # 3. Admin role can access daily-revenue
    res = client.get(
        f"/api/v1/admin/reports/daily-revenue?event_id={event_id}",
        headers={"Authorization": "Bearer test-token-admin"},
    )
    assert res.status_code == 200
    assert "online" in res.json
    assert "cash" in res.json
    assert "totals" in res.json

    # 4. Admin role can access daily-collectors
    res = client.get(
        f"/api/v1/admin/reports/daily-collectors?event_id={event_id}",
        headers={"Authorization": "Bearer test-token-admin"},
    )
    assert res.status_code == 200
    assert "collectors" in res.json

    # 5. Regular Admin cannot create settlement (Super Admin only)
    res = client.post(
        "/api/v1/admin/settlements",
        headers={"Authorization": "Bearer test-token-admin"},
        json={
            "event_id": event_id,
            "settlement_date": "2026-10-25",
            "total_online_amount": 1000,
            "total_cash_amount": 500,
            "total_tickets_issued": 3,
        },
    )
    assert res.status_code == 403

    # 6. Super Admin CAN create settlement
    res = client.post(
        "/api/v1/admin/settlements",
        headers={"Authorization": "Bearer test-token-super_admin"},
        json={
            "event_id": event_id,
            "settlement_date": "2026-10-25",
            "total_online_amount": 1000,
            "total_cash_amount": 500,
            "total_tickets_issued": 3,
        },
    )
    assert res.status_code == 201
    settlement_id = res.json["settlement"]["id"]
    assert res.json["settlement"]["total_amount"] == 1500.0

    # 7. Admin can list settlements and view single settlement
    res = client.get(
        f"/api/v1/admin/settlements?event_id={event_id}",
        headers={"Authorization": "Bearer test-token-admin"},
    )
    assert res.status_code == 200
    assert any(s["id"] == settlement_id for s in res.json["settlements"])

    res = client.get(
        f"/api/v1/admin/settlements/{settlement_id}",
        headers={"Authorization": "Bearer test-token-admin"},
    )
    assert res.status_code == 200
    assert res.json["settlement"]["id"] == settlement_id

    # 8. Mark settled validation failure (missing required bank fields)
    res = client.patch(
        f"/api/v1/admin/settlements/{settlement_id}/settle",
        headers={"Authorization": "Bearer test-token-super_admin"},
        json={"receiver_name": "Incomplete"},
    )
    assert res.status_code == 400
    assert "Missing required fields" in res.json["error"]

    # 9. Super Admin marks as settled
    res = client.patch(
        f"/api/v1/admin/settlements/{settlement_id}/settle",
        headers={"Authorization": "Bearer test-token-super_admin"},
        json={
            "receiver_name": "Sphoorthy College Accounts",
            "bank_name": "HDFC Bank",
            "account_number": "50100012345678",
            "ifsc_code": "HDFC0001234",
            "transaction_id": "UTR554433221100",
            "transaction_date": "2026-10-25",
            "notes": "Verified by accounts section",
            "authorized_by_name": "Dean Admin",
        },
    )
    assert res.status_code == 200
    assert res.json["settlement"]["is_settled"] is True
    assert res.json["settlement"]["transaction_id"] == "UTR554433221100"


def test_daily_report_and_payment_date_alignment(sample_event):
    event_id = sample_event
    reg_date = "2026-10-20"
    pay_date = "2026-10-25"
    reg_timestamp = f"{reg_date}T10:00:00+00:00"
    pay_timestamp = f"{pay_date}T15:30:00+00:00"

    # Student registers on Day 1 (Oct 20) with PENDING_PAYMENT
    reg_id = str(uuid.uuid4())
    db.execute_write(
        """INSERT INTO registrations (id, event_id, full_name, roll_number, email, phone, department, ticket_price, status, payment_method, created_at, updated_at)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
        (reg_id, event_id, "Delayed Pay Student", f"26N81A{str(uuid.uuid4())[:4]}", f"delayed.{reg_id[:6]}@sphoorthy.ac.in", "9988776655", "CSE", 500.0, "PENDING_PAYMENT", "ONLINE", reg_timestamp, reg_timestamp),
    )

    # Initial order created on Day 1
    pay_id = str(uuid.uuid4())
    db.execute_write(
        """INSERT INTO payments (id, registration_id, amount, status, payment_method, razorpay_order_id, created_at, updated_at)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
        (pay_id, reg_id, 503.79, "CREATED", "RAZORPAY", f"order_{str(uuid.uuid4())[:8]}", reg_timestamp, reg_timestamp),
    )

    # Payment succeeds on Day 2 (Oct 25)
    db.execute_write(
        """UPDATE payments SET status = 'PAID', razorpay_payment_id = %s, updated_at = %s WHERE id = %s""",
        (f"pay_{str(uuid.uuid4())[:8]}", pay_timestamp, pay_id),
    )
    # Ticket issued on Day 2 (Oct 25)
    t_id = str(uuid.uuid4())
    db.execute_write(
        """INSERT INTO tickets (id, event_id, registration_id, ticket_code, qr_token, status, created_at, updated_at)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
        (t_id, event_id, reg_id, "DLY001", str(uuid.uuid4()), "ISSUED", pay_timestamp, pay_timestamp),
    )
    # Registration updated to PAID with created_at set to payment date
    db.execute_write(
        "UPDATE registrations SET status = 'PAID', created_at = %s, updated_at = %s WHERE id = %s",
        (pay_timestamp, pay_timestamp, reg_id),
    )

    # Verify Daily Revenue Report groups the booking on Oct 25 (payment date), NOT Oct 20
    report = report_service.get_daily_revenue_report(event_id=event_id)
    online_dates = [r["date"] for r in report["online"]]
    assert pay_date in online_dates
    assert reg_date not in online_dates

    oct25_row = [r for r in report["online"] if r["date"] == pay_date][0]
    assert oct25_row["tickets_issued"] >= 1
    assert oct25_row["amount"] >= 500.0

    # Verify Payments Report attributes the created_at/date to the payment completion timestamp
    payments_rep = report_service.get_payments_report(event_id=event_id)
    target_payment = [p for p in payments_rep if p["id"] == pay_id][0]
    assert target_payment["created_at"] == pay_timestamp
    assert target_payment["paid_at"] == pay_timestamp


def test_daily_revenue_ist_timezone_boundary(sample_event):
    """
    Test that a payment made at 23:56 UTC (which is 05:26 AM next day in IST)
    is grouped under the NEXT DAY (IST date) and not previous UTC day.
    """
    event_id = sample_event
    utc_timestamp = "2026-10-26T23:56:25+00:00"
    expected_ist_day = "2026-10-27"

    reg_id = str(uuid.uuid4())
    db.execute_write(
        """INSERT INTO registrations (id, event_id, full_name, roll_number, email, phone, department, ticket_price, status, payment_method, created_at, updated_at)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
        (reg_id, event_id, "IST Test Student", "25N81A66N5", f"ist.{reg_id[:6]}@sphoorthy.ac.in", "9988771122", "CSE", 600.0, "PAID", "ONLINE", utc_timestamp, utc_timestamp),
    )
    pay_id = str(uuid.uuid4())
    db.execute_write(
        """INSERT INTO payments (id, registration_id, amount, status, payment_method, razorpay_order_id, created_at, updated_at)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
        (pay_id, reg_id, 603.79, "PAID", "RAZORPAY", f"order_{str(uuid.uuid4())[:8]}", utc_timestamp, utc_timestamp),
    )
    t_id = str(uuid.uuid4())
    db.execute_write(
        """INSERT INTO tickets (id, event_id, registration_id, ticket_code, qr_token, status, created_at, updated_at)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
        (t_id, event_id, reg_id, "IST001", str(uuid.uuid4()), "ISSUED", utc_timestamp, utc_timestamp),
    )

    report = report_service.get_daily_revenue_report(event_id=event_id)
    oct27_rows = [r for r in report["online"] if r["date"] == expected_ist_day]
    assert len(oct27_rows) == 1
    assert oct27_rows[0]["second_year_tickets"] == 1
    assert oct27_rows[0]["amount"] == 600.0


