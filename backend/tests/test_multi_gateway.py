import pytest
import uuid
from app import create_app
from app.services.event_service import event_service
from app.services.registration_service import registration_service
from app.schemas.registration import RegistrationCreate
from app.schemas.event import EventCreate, EventUpdate

@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client

def test_super_admin_can_manage_gateway_settings(client):
    headers_super = {"Authorization": "Bearer test-token-super-admin"}
    headers_admin = {"Authorization": "Bearer test-token-admin"}

    # 1. Non-super admin cannot access PUT
    res_forbidden = client.put(
        "/api/v1/admin/settings/payment-gateways",
        json={"default_gateway": "CASHFREE"},
        headers=headers_admin,
    )
    assert res_forbidden.status_code == 403

    # 2. Super admin gets current gateway settings
    res_get = client.get(
        "/api/v1/admin/settings/payment-gateways",
        headers=headers_super,
    )
    assert res_get.status_code == 200
    assert "default_gateway" in res_get.json
    assert "gateways" in res_get.json
    assert "RAZORPAY" in res_get.json["gateways"]
    assert "CASHFREE" in res_get.json["gateways"]
    assert "PHONEPE" in res_get.json["gateways"]

    # 3. Super admin updates default to CASHFREE
    res_put = client.put(
        "/api/v1/admin/settings/payment-gateways",
        json={
            "default_gateway": "CASHFREE",
            "gateways_enabled": {"cashfree": True, "phonepe": True, "razorpay": True},
        },
        headers=headers_super,
    )
    assert res_put.status_code == 200
    assert res_put.json["settings"]["default_gateway"] == "CASHFREE"

    # Reset default back to RAZORPAY
    client.put(
        "/api/v1/admin/settings/payment-gateways",
        json={"default_gateway": "RAZORPAY"},
        headers=headers_super,
    )

def test_cashfree_order_and_verification_flow(client):
    headers = {"Authorization": "Bearer test-token-admin"}
    event = event_service.get_event_by_slug("freshers-2k26")
    
    # Update event to use CASHFREE
    event_service.update_event(
        event["id"],
        EventUpdate(payment_gateway="CASHFREE"),
        user_id="test-admin-id",
    )

    uid = uuid.uuid4().hex[:6]
    reg = registration_service.register_student(RegistrationCreate(
        event_id=event["id"],
        full_name="Cashfree Tester",
        roll_number=f"26CF{uid}",
        email=f"cashfree.{uid}@sphoorthy.ac.in",
        phone="9876543210",
        department="ECE",
    ))

    # Create Order
    res_order = client.post(
        "/api/v1/payments/create-order",
        json={"registration_id": reg["id"]},
        headers={**headers, "X-Registration-Token": reg["payment_token"]},
    )
    assert res_order.status_code == 200
    order_data = res_order.json
    assert order_data["gateway"] == "CASHFREE"
    assert "payment_session_id" in order_data
    assert "order_id" in order_data

    # Verify Cashfree Payment
    res_verify = client.post(
        "/api/v1/payments/verify",
        json={
            "registration_id": reg["id"],
            "order_id": order_data["order_id"],
            "payment_id": f"cf_mock_pay_{uid}",
            "signature": "test_signature",
            "gateway": "CASHFREE",
        },
        headers={**headers, "X-Registration-Token": reg["payment_token"]},
    )
    assert res_verify.status_code == 200
    assert res_verify.json["status"] == "PAID"
    assert "ticket_code" in res_verify.json

    # Reset event gateway back to DEFAULT
    event_service.update_event(
        event["id"],
        EventUpdate(payment_gateway="DEFAULT"),
        user_id="test-admin-id",
    )

def test_phonepe_order_and_verification_flow(client):
    headers = {"Authorization": "Bearer test-token-admin"}
    event = event_service.get_event_by_slug("freshers-2k26")
    
    # Update event to use PHONEPE
    event_service.update_event(
        event["id"],
        EventUpdate(payment_gateway="PHONEPE"),
        user_id="test-admin-id",
    )

    uid = uuid.uuid4().hex[:6]
    reg = registration_service.register_student(RegistrationCreate(
        event_id=event["id"],
        full_name="PhonePe Tester",
        roll_number=f"26PE{uid}",
        email=f"phonepe.{uid}@sphoorthy.ac.in",
        phone="9876543210",
        department="CSE",
    ))

    # Create Order
    res_order = client.post(
        "/api/v1/payments/create-order",
        json={"registration_id": reg["id"]},
        headers={**headers, "X-Registration-Token": reg["payment_token"]},
    )
    assert res_order.status_code == 200
    order_data = res_order.json
    assert order_data["gateway"] == "PHONEPE"
    assert "redirect_url" in order_data
    assert "order_id" in order_data

    # Verify PhonePe Payment
    res_verify = client.post(
        "/api/v1/payments/verify",
        json={
            "registration_id": reg["id"],
            "order_id": order_data["order_id"],
            "payment_id": f"pe_mock_pay_{uid}",
            "signature": "test_signature",
            "gateway": "PHONEPE",
        },
        headers={**headers, "X-Registration-Token": reg["payment_token"]},
    )
    assert res_verify.status_code == 200
    assert res_verify.json["status"] == "PAID"
    assert "ticket_code" in res_verify.json

    # Reset event gateway back to DEFAULT
    event_service.update_event(
        event["id"],
        EventUpdate(payment_gateway="DEFAULT"),
        user_id="test-admin-id",
    )

def test_cashfree_webhook_flow(client):
    headers = {"Authorization": "Bearer test-token-admin"}
    event = event_service.get_event_by_slug("freshers-2k26")
    event_service.update_event(
        event["id"],
        EventUpdate(payment_gateway="CASHFREE"),
        user_id="test-admin-id",
    )

    uid = uuid.uuid4().hex[:6]
    reg = registration_service.register_student(RegistrationCreate(
        event_id=event["id"],
        full_name="Webhook Tester",
        roll_number=f"26WH{uid}",
        email=f"webhook.{uid}@sphoorthy.ac.in",
        phone="9876543210",
        department="CSE",
    ))

    # Create Order
    res_order = client.post(
        "/api/v1/payments/create-order",
        json={"registration_id": reg["id"]},
        headers={**headers, "X-Registration-Token": reg["payment_token"]},
    )
    assert res_order.status_code == 200
    order_data = res_order.json

    # Simulate Cashfree Webhook callback
    webhook_payload = {
        "type": "PAYMENT_SUCCESS_WEBHOOK",
        "data": {
            "order": {
                "order_id": order_data["order_id"],
                "order_amount": order_data["amount"],
            },
            "payment": {
                "cf_payment_id": f"cf_wh_{uid}",
                "payment_status": "SUCCESS",
            },
        },
    }

    res_wh = client.post(
        "/api/v1/webhooks/cashfree",
        json=webhook_payload,
        headers={
            "x-webhook-signature": "test_signature",
            "x-webhook-timestamp": "1729000000",
        },
    )
    assert res_wh.status_code == 200
    assert res_wh.json["status"] == "PAID"
    assert "ticket_code" in res_wh.json

    # Reset event gateway back to DEFAULT
    event_service.update_event(
        event["id"],
        EventUpdate(payment_gateway="DEFAULT"),
        user_id="test-admin-id",
    )

