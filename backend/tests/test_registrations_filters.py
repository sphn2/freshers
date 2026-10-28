import csv
import io
import uuid
from datetime import datetime, timezone

from app import create_app
from app.db import db
from app.services.event_service import event_service
from app.services.report_service import ReportService


def test_registrations_filters_and_export():
    app = create_app()
    with app.app_context():
        # Get or pick an event
        event = event_service.get_event_by_slug("freshers-2k26")
        event_id = event["id"]
        unique_id = uuid.uuid4().hex[:6]

        # Create test records:
        # 1. 1st year (26...), CSE, PAID, Gate Validated, Food Claimed
        reg1_id = str(uuid.uuid4())
        roll1 = f"26CSE{unique_id}"
        # 2. 2nd year (25...), ECE, OFFLINE_PAID, Not Gate Validated, Food Not Claimed
        reg2_id = str(uuid.uuid4())
        roll2 = f"25ECE{unique_id}"
        # 3. 3rd year (24...), CIVIL, PENDING_PAYMENT, No ticket
        reg3_id = str(uuid.uuid4())
        roll3 = f"24CIV{unique_id}"

        now = datetime.now(timezone.utc).isoformat()
        db.execute_write(
            """INSERT INTO registrations (id, event_id, full_name, roll_number, email, phone, department, ticket_price, status, payment_method, created_at)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (reg1_id, event_id, f"Student First {unique_id}", roll1, f"first_{unique_id}@sphoorthy.edu", "9999900001", "CSE", 500, "PAID", "ONLINE", now)
        )
        t1_id = str(uuid.uuid4())
        db.execute_write(
            """INSERT INTO tickets (id, registration_id, event_id, ticket_code, qr_token, status, gate_validated_at, created_at)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
            (t1_id, reg1_id, event_id, f"TK1{unique_id[:3]}", str(uuid.uuid4()), "VALIDATED", now, now)
        )
        db.execute_write(
            """INSERT INTO food_entitlements (id, ticket_id, event_id, status, food_validated_at, created_at)
               VALUES (%s, %s, %s, %s, %s, %s)""",
            (str(uuid.uuid4()), t1_id, event_id, "CLAIMED", now, now)
        )

        db.execute_write(
            """INSERT INTO registrations (id, event_id, full_name, roll_number, email, phone, department, ticket_price, status, payment_method, created_at)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (reg2_id, event_id, f"Student Second {unique_id}", roll2, f"second_{unique_id}@sphoorthy.edu", "9999900002", "ECE", 600, "OFFLINE_PAID", "CASH", now)
        )
        t2_id = str(uuid.uuid4())
        db.execute_write(
            """INSERT INTO tickets (id, registration_id, event_id, ticket_code, qr_token, status, created_at)
               VALUES (%s, %s, %s, %s, %s, %s, %s)""",
            (t2_id, reg2_id, event_id, f"TK2{unique_id[:3]}", str(uuid.uuid4()), "ISSUED", now)
        )
        db.execute_write(
            """INSERT INTO food_entitlements (id, ticket_id, event_id, status, created_at)
               VALUES (%s, %s, %s, %s, %s)""",
            (str(uuid.uuid4()), t2_id, event_id, "PENDING", now)
        )

        db.execute_write(
            """INSERT INTO registrations (id, event_id, full_name, roll_number, email, phone, department, ticket_price, status, payment_method, created_at)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (reg3_id, event_id, f"Student Third {unique_id}", roll3, f"third_{unique_id}@sphoorthy.edu", "9999900003", "CIVIL", 600, "PENDING_PAYMENT", "ONLINE", now)
        )

        try:
            # 1. Search filter: search roll number
            res_search = ReportService.get_registrations_report(event_id=event_id, search=roll1)
            assert any(r["id"] == reg1_id for r in res_search)
            assert not any(r["id"] == reg2_id for r in res_search)

            # 2. Year filter: 1st year
            res_year1 = ReportService.get_registrations_report(event_id=event_id, search=unique_id, year=["1st Year"])
            assert any(r["id"] == reg1_id for r in res_year1)
            assert not any(r["id"] == reg2_id for r in res_year1)

            # 3. Multiple departments filter: CSE and ECE
            res_depts = ReportService.get_registrations_report(event_id=event_id, search=unique_id, department=["CSE", "ECE"])
            reg_ids = [r["id"] for r in res_depts]
            assert reg1_id in reg_ids
            assert reg2_id in reg_ids
            assert reg3_id not in reg_ids

            # 4. Multiple payment statuses: PAID and OFFLINE_PAID
            res_status = ReportService.get_registrations_report(event_id=event_id, search=unique_id, status=["PAID", "OFFLINE_PAID"])
            reg_ids_status = [r["id"] for r in res_status]
            assert reg1_id in reg_ids_status
            assert reg2_id in reg_ids_status
            assert reg3_id not in reg_ids_status

            # 5. Gate validated filter: VALIDATED
            res_gate = ReportService.get_registrations_report(event_id=event_id, search=unique_id, gate_status="VALIDATED")
            assert any(r["id"] == reg1_id for r in res_gate)
            assert not any(r["id"] == reg2_id for r in res_gate)

            # Gate not validated: NOT_VALIDATED
            res_no_gate = ReportService.get_registrations_report(event_id=event_id, search=unique_id, gate_status="NOT_VALIDATED")
            assert not any(r["id"] == reg1_id for r in res_no_gate)
            assert any(r["id"] == reg2_id for r in res_no_gate)

            # 6. Food claimed filter: CLAIMED
            res_food = ReportService.get_registrations_report(event_id=event_id, search=unique_id, food_status="CLAIMED")
            assert any(r["id"] == reg1_id for r in res_food)
            assert not any(r["id"] == reg2_id for r in res_food)

            # Food not claimed: NOT_CLAIMED
            res_no_food = ReportService.get_registrations_report(event_id=event_id, search=unique_id, food_status="NOT_CLAIMED")
            assert not any(r["id"] == reg1_id for r in res_no_food)
            assert any(r["id"] == reg2_id for r in res_no_food)

            # 7. Export CSV with active filters
            csv_str = ReportService.export_registrations_csv(
                event_id=event_id,
                search=unique_id,
                year=["1st Year"],
                department=["CSE"],
                status=["PAID"],
                gate_status="VALIDATED",
                food_status="CLAIMED"
            )
            rows = list(csv.reader(io.StringIO(csv_str)))
            # Header
            header = rows[0]
            assert "Academic Year" in header
            # Content should have only 1 row corresponding to reg1
            data_rows = rows[1:]
            assert len(data_rows) == 1
            assert data_rows[0][0] == reg1_id
            assert data_rows[0][3] == roll1
            assert data_rows[0][7] == "1st Year"
            assert data_rows[0][6] == "CSE"

        finally:
            db.execute_write("DELETE FROM registrations WHERE id IN (%s, %s, %s)", (reg1_id, reg2_id, reg3_id))


def test_super_admin_and_event_manager_access():
    app = create_app()
    client = app.test_client()

    with app.app_context():
        event = event_service.get_event_by_slug("freshers-2k26")
        event_id = event["id"]

        # 1. Super Admin access without event_id (All events)
        res_super = client.get(
            "/api/v1/admin/reports/registrations?search=test",
            headers={"Authorization": "Bearer test-token-super-admin"}
        )
        assert res_super.status_code == 200
        assert "registrations" in res_super.get_json()

        # Super Admin CSV export
        res_super_csv = client.get(
            "/api/v1/admin/reports/registrations/csv?search=test",
            headers={"Authorization": "Bearer test-token-super-admin"}
        )
        assert res_super_csv.status_code == 200
        assert "text/csv" in res_super_csv.content_type

        # 2. Event Manager access:
        # Without event_id -> should return 400
        res_em_no_event = client.get(
            "/api/v1/admin/reports/registrations",
            headers={"Authorization": "Bearer test-token-event-manager"}
        )
        assert res_em_no_event.status_code == 400

        # Assign event to the test event manager user
        # Note test-token-event-manager user id is 00000000-0000-0000-0000-000000000001
        manager_id = "00000000-0000-0000-0000-000000000001"
        db.execute_write(
            "INSERT OR IGNORE INTO event_managers (id, event_id, user_id, created_at) VALUES (%s, %s, %s, %s)",
            (str(uuid.uuid4()), event_id, manager_id, datetime.now(timezone.utc).isoformat())
        )

        try:
            # Event Manager with assigned event_id -> should return 200
            res_em = client.get(
                f"/api/v1/admin/reports/registrations?event_id={event_id}&departments=CSE,ECE&statuses=PAID",
                headers={"Authorization": "Bearer test-token-event-manager"}
            )
            assert res_em.status_code == 200
            assert "registrations" in res_em.get_json()

            # Event Manager CSV export with assigned event_id -> should return 200
            res_em_csv = client.get(
                f"/api/v1/admin/reports/registrations/csv?event_id={event_id}&department=CSE",
                headers={"Authorization": "Bearer test-token-event-manager"}
            )
            assert res_em_csv.status_code == 200
            assert "text/csv" in res_em_csv.content_type
        finally:
            db.execute_write("DELETE FROM event_managers WHERE event_id = %s AND user_id = %s", (event_id, manager_id))

