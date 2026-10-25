import pytest
from app import create_app
from app.services.system_settings_service import system_settings_service
from app.services.registration_service import registration_service
from app.services.event_service import event_service
from app.schemas.registration import RegistrationCreate

@pytest.fixture
def client():
    app = create_app()
    with app.test_client() as c:
        with app.app_context():
            yield c

def test_get_public_banners(client):
    res = client.get("/api/v1/banners")
    assert res.status_code == 200
    data = res.get_json()
    assert "registrations_closed" in data
    assert "registrations_closed_text" in data
    assert "maintenance_mode" in data
    assert "maintenance_mode_text" in data

def test_admin_can_toggle_registrations_closed(client):
    headers = {
        "X-Test-User-Role": "ADMIN",
        "X-Test-User-Id": "test-admin-1",
        "X-Test-User-Email": "admin@sphoorthy.ac.in",
    }
    # Update registrations closed
    res = client.put(
        "/api/v1/admin/settings/banners",
        headers=headers,
        json={
            "registrations_closed": True,
            "registrations_closed_text": "Custom Closed Notice: Contact Organizers.",
        },
    )
    assert res.status_code == 200
    data = res.get_json()["settings"]
    assert data["registrations_closed"] is True
    assert data["registrations_closed_text"] == "Custom Closed Notice: Contact Organizers."

    # Restore
    client.put(
        "/api/v1/admin/settings/banners",
        headers=headers,
        json={"registrations_closed": False},
    )

def test_admin_cannot_toggle_maintenance_mode(client):
    headers = {
        "X-Test-User-Role": "ADMIN",
        "X-Test-User-Id": "test-admin-1",
        "X-Test-User-Email": "admin@sphoorthy.ac.in",
    }
    res = client.put(
        "/api/v1/admin/settings/banners",
        headers=headers,
        json={"maintenance_mode": True},
    )
    assert res.status_code == 403
    assert "Super Admin" in res.get_json()["error"]

def test_super_admin_can_toggle_maintenance_mode(client):
    headers = {
        "X-Test-User-Role": "SUPER_ADMIN",
        "X-Test-User-Id": "test-super-1",
        "X-Test-User-Email": "super@sphoorthy.ac.in",
    }
    res = client.put(
        "/api/v1/admin/settings/banners",
        headers=headers,
        json={
            "maintenance_mode": True,
            "maintenance_mode_text": "Live in 15 mins for redeployment.",
        },
    )
    assert res.status_code == 200
    data = res.get_json()["settings"]
    assert data["maintenance_mode"] is True
    assert data["maintenance_mode_text"] == "Live in 15 mins for redeployment."

    # Restore
    client.put(
        "/api/v1/admin/settings/banners",
        headers=headers,
        json={"maintenance_mode": False},
    )

def test_registration_blocked_when_maintenance_mode_active(client):
    super_headers = {
        "X-Test-User-Role": "SUPER_ADMIN",
        "X-Test-User-Id": "test-super-1",
    }
    # Turn on maintenance mode
    client.put("/api/v1/admin/settings/banners", headers=super_headers, json={"maintenance_mode": True})

    try:
        event = event_service.get_event_by_slug("freshers-2k26")
        res = client.post(
            f"/api/v1/events/{event['id']}/register",
            json={
                "full_name": "Test Student",
                "roll_number": "26N81A0501",
                "email": "teststudent@sphoorthy.ac.in",
                "phone": "9876543210",
                "department": "CSE",
                "college": "Sphoorthy Engineering College",
            },
        )
        assert res.status_code == 400
        assert "maintenance" in res.get_json()["error"].lower()
    finally:
        client.put("/api/v1/admin/settings/banners", headers=super_headers, json={"maintenance_mode": False})

def test_registration_blocked_when_registrations_closed_active(client):
    admin_headers = {
        "X-Test-User-Role": "ADMIN",
        "X-Test-User-Id": "test-admin-1",
    }
    # Turn on registrations closed
    client.put(
        "/api/v1/admin/settings/banners",
        headers=admin_headers,
        json={
            "registrations_closed": True,
            "registrations_closed_text": "Registrations are closed. For more details or spot registrations contact the Freshers organizing Team.",
        },
    )

    try:
        event = event_service.get_event_by_slug("freshers-2k26")
        res = client.post(
            f"/api/v1/events/{event['id']}/register",
            json={
                "full_name": "Test Student",
                "roll_number": "26N81A0501",
                "email": "teststudent@sphoorthy.ac.in",
                "phone": "9876543210",
                "department": "CSE",
                "college": "Sphoorthy Engineering College",
            },
        )
        assert res.status_code == 400
        assert "registrations are closed" in res.get_json()["error"].lower()
    finally:
        client.put("/api/v1/admin/settings/banners", headers=admin_headers, json={"registrations_closed": False})
