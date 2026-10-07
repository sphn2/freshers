import pytest
import concurrent.futures
import threading
from app import create_app
from app.services.event_service import event_service
from app.services.registration_service import registration_service
from app.services.ticket_service import ticket_service
from app.schemas.registration import RegistrationCreate
from app.schemas.validation import GateValidationRequest
from app.services.validation_service import validation_service
from app.db import db

import uuid

def test_atomic_concurrent_gate_validation():
    app = create_app()
    with app.app_context():
        event = event_service.get_event_by_slug("freshers-2k26")
        unique_id = str(uuid.uuid4())[:8]
        reg = registration_service.register_student(RegistrationCreate(
            event_id=event["id"],
            full_name="Concurrency Tester",
            roll_number=f"26N81A{unique_id}",
            email=f"concurrency.test.{unique_id}@sphoorthy.ac.in",
            phone="9876543218",
            department="CIVIL"
        ))
        db.execute_write(
            "UPDATE registrations SET status = 'PAID' WHERE id = %s", (reg["id"],)
        )
        ticket = ticket_service.issue_ticket(reg["id"])

        req = GateValidationRequest(
            event_id=event["id"],
            ticket_code=ticket["ticket_code"],
            gate_location="Gate 1 High Traffic"
        )

        results = []

        def execute_validation(staff_name):
            with app.app_context():
                res = validation_service.validate_gate(req, staff_user_id=staff_name)
                return res.status

        # Fire 2 parallel threads simultaneously
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            future1 = executor.submit(execute_validation, "Staff_Gate_A")
            future2 = executor.submit(execute_validation, "Staff_Gate_B")
            
            results.append(future1.result())
            results.append(future2.result())

        # Assert exactly one VALID and one ALREADY_USED
        assert results.count("VALID") == 1, f"Expected exactly 1 VALID status, got {results}"
        assert results.count("ALREADY_USED") == 1, f"Expected exactly 1 ALREADY_USED status, got {results}"


def test_concurrent_registrations_cannot_exceed_event_capacity():
    app = create_app()
    with app.app_context():
        event = event_service.get_event_by_slug("freshers-2k26")
        original_capacity = event["capacity"]
        active_count = db.execute_one(
            "SELECT COUNT(*) AS total FROM registrations WHERE event_id = %s AND status != 'CANCELLED'",
            (event["id"],),
        )["total"]
        db.execute_write(
            "UPDATE events SET capacity = %s WHERE id = %s",
            (active_count + 1, event["id"]),
        )
        start = threading.Barrier(2)

        def register(index):
            with app.app_context():
                unique_id = str(uuid.uuid4())[:8]
                request = RegistrationCreate(
                    event_id=event["id"],
                    full_name=f"Capacity Tester {index}",
                    roll_number=f"26N81A{unique_id}",
                    email=f"capacity.{unique_id}@sphoorthy.ac.in",
                    phone="9876543218",
                    department="CIVIL",
                )
                start.wait()
                try:
                    registration_service.register_student(request)
                    return True
                except ValueError:
                    return False

        try:
            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
                results = list(executor.map(register, (1, 2)))
            assert results.count(True) == 1
            final_count = db.execute_one(
                "SELECT COUNT(*) AS total FROM registrations WHERE event_id = %s AND status != 'CANCELLED'",
                (event["id"],),
            )["total"]
            assert final_count == active_count + 1
        finally:
            db.execute_write(
                "UPDATE events SET capacity = %s WHERE id = %s",
                (original_capacity, event["id"]),
            )
