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
